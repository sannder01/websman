/* jQuery 3.7.1 is loaded before this file. Ready waits for the existing form markup.
 * Rewrite 3: .val(), .find(), .on() and .toggleClass() replace value/querySelector/
 * addEventListener/classList. DOM updates are shorter; the pricing rules are unchanged
 * and are not shorter merely because the UI now uses jQuery. */
$(async function () {
  'use strict';
  await window.PixelCart?.ready;
  const form = $('#booking-form');
  if (!form.length) return;
  const effectDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160;
  function node(tag, text = '', classes = '') {
    return $(`<${tag}>`).text(text).addClass(classes);
  }
  // The contact field is created in code; the frozen HTML and CSS stay intact.
  const emailWrap = node('div');
  emailWrap.append(node('label', 'E-mail (необязательно)').attr('for', 'booking-email'));
  emailWrap.append(node('input', '', 'form-control').attr({
    id: 'booking-email', name: 'email', type: 'email', maxlength: '254',
    autocomplete: 'email', 'aria-describedby': 'booking-email-help booking-email-error'
  }));
  emailWrap.append(node('p', 'Если укажете адрес, он войдёт в заявку администратору.', 'form-text').attr('id', 'booking-email-help'));
  emailWrap.append(node('p', '', 'field-error').attr('id', 'booking-email-error').prop('hidden', true));
  $('#booking-phone').parent().after(emailWrap);
  $('.booking-heading > p').text('Рассчитайте визит и отправьте заявку. Места подтвердит клуб.');
  $('#booking-phone-help').text('Телефон с кодом страны. Имя и телефон получит администратор для подтверждения брони.');
  $('.booking-actions + p').text('Реальную бронь и условия визита подтвердит администратор клуба.');
  $('#booking-review-actions .form-text').text('Отправим заявку администратору. Дождитесь подтверждения мест.');
  const ids = ['room', 'guests', 'duration', 'date', 'time', 'nearby', 'seat', 'game', 'name', 'phone', 'email', 'package', 'submit', 'reset', 'errors', 'status', 'total', 'price-note', 'summary', 'result', 'result-title', 'copy', 'cart-items', 'cart-note', 'mode', 'success', 'edit', 'cancel', 'end', 'mobile-next', 'mobile-total', 'mobile-submit'];
  const ui = Object.fromEntries(ids.map(id => [id, $("#" + `booking-${id}`)]));
  if (ids.some(id => !ui[id].length)) return;
  const storageKey = 'pixel-assignment-visit-draft-v1';
  const confirmationKey = 'pixel-assignment-demo-booking-v1';
  const rooms = {
    standard: {
      name: 'Standard',
      capacity: 20,
      hourly: 900
    },
    duo: {
      name: 'Duo',
      capacity: 2,
      hourly: 1000
    },
    vip: {
      name: 'VIP',
      capacity: 5,
      hourly: 1500
    }
  };
  const games = {
    cs2: 'Counter-Strike 2',
    fortnite: 'Fortnite',
    minecraft: 'Minecraft',
    dota2: 'Dota 2',
    valorant: 'Valorant',
    gtav: 'GTA V',
    gtaonline: 'GTA Online',
    pubg: 'PUBG',
    apex: 'Apex Legends',
    lol: 'League of Legends',
    rust: 'Rust',
    roblox: 'Roblox',
    fc: 'EA Sports FC',
    cod: 'Call of Duty',
    r6: 'Rainbow Six Siege',
    overwatch2: 'Overwatch 2',
    rocketleague: 'Rocket League',
    warthunder: 'War Thunder',
    ets2: 'Euro Truck Simulator 2',
    chrome: 'Google Chrome'
  };
  const seats = new Map();
  for (const [room, prefix] of [['standard', 'pc'], ['duo', 'duo'], ['vip', 'vip']]) {
    for (let i = 1; i <= rooms[room].capacity; i += 1) {
      const number = String(i).padStart(2, '0');
      seats.set(`${prefix}-${number}`, {
        room,
        label: `${rooms[room].name} · ПК ${number}`
      });
    }
  }
  const money = new Intl.NumberFormat('ru-RU');
  const clubClock = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty',
    calendar: 'iso8601',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const displayDate = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
  const labels = new Map([[ui.room, 'Зал'], [ui.guests, 'Число игроков'], [ui.duration, 'Длительность'], [ui.date, 'Дата'], [ui.time, 'Время'], [ui.mode, 'Тариф'], [ui.package, 'Пакет'], [ui.seat, 'Пожелание по ПК'], [ui.game, 'Игра'], [ui.name, 'Имя'], [ui.phone, 'Телефон'], [ui.email, 'E-mail']]);
  // Every validated field gets its own adjacent error, including optional selects.
  labels.forEach((label, field) => {
    const errorId = `${field.attr('id')}-error`;
    if (!$(`#${errorId}`).length) node('p', '', 'field-error').attr('id', errorId).prop('hidden', true).insertAfter(field);
    const descriptions = new Set((field.attr('aria-describedby') || '').split(/\s+/).filter(Boolean));
    descriptions.add(errorId);
    field.attr('aria-describedby', [...descriptions].join(' '));
  });
  let preparedPlan = null;
  let savedRecord = null;
  let reviewed = false;
  let sending = false;
  let deliveryAvailable = false;
  let validationAttempted = false;
  const reviewSubmit = $('#booking-review-submit');
  reviewSubmit.text('Забронировать');
  const mobile = window.matchMedia('(max-width: 767px)');
  const layout = $('.booking-layout');
  const showSaved = $('#booking-show-saved');
  const reviewActions = $('#booking-review-actions');
  let cart = {
    items: [],
    total: 0,
    count: 0,
    persistenceAvailable: true
  };
  let cartAvailable = false;
  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }
  function clubNow() {
    const parts = Object.fromEntries(clubClock.formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
      second: Number(parts.second)
    };
  }
  function validDate(value) {
    if (typeof value !== 'string' || !(/^\d{4}-\d{2}-\d{2}$/).test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1000 || year > 9999) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  function validTime(value) {
    return typeof value === 'string' && (/^(?:[01]\d|2[0-3]):[0-5]\d$/).test(value);
  }
  function integer(value, minimum, maximum) {
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  }
  function isPast(date, time, now = clubNow()) {
    return date < now.date || date === now.date && (time < now.time || time === now.time && now.second > 0);
  }
  function announce(message) {
    ui.status.text(message);
  }
  function hideResult() {
    preparedPlan = null;
    savedRecord = null;
    ui.result.prop("hidden", true);
    ui.success.prop("hidden", true);
    layout.prop("hidden", false);
    showSaved.prop("hidden", true);
    ui['mobile-next'].prop("hidden", false);
    ui.copy.prop("disabled", true);
    ui.summary.val('');
  }
  function editing() {
    reviewed = false;
    layout.prop("hidden", false);
    ui.result.prop("hidden", true);
    ui.success.prop("hidden", true);
    ui['mobile-next'].prop("hidden", false);
    reviewActions.prop("hidden", true);
    showSaved.prop("hidden", !savedRecord);
    ui.submit.text(mobile.matches ? 'Проверить план →' : 'Забронировать');
  }
  $(mobile).on('change', () => {
    ui.submit.text(mobile.matches ? 'Проверить план →' : 'Забронировать');
    reviewActions.prop("hidden", !mobile.matches || !reviewed);
    ui['mobile-next'].prop("hidden", !ui.result.prop("hidden") || mobile.matches && reviewed);
  });
  function clearErrors() {
    ui.errors.prop("hidden", true);
    ui.errors.text('');
    labels.forEach((label, field) => field.removeAttr('aria-invalid'));
  }
  function showErrors() {
    const invalidFields = [...labels.keys()].filter(field => !field.is(':disabled') && !field.get(0).validity.valid);
    labels.forEach((label, field) => {
      if (invalidFields.includes(field)) field.attr('aria-invalid', 'true'); else field.removeAttr('aria-invalid');
    });
    for (const field of invalidFields) {
      const details = field.closest('details');
      if (details.length) details.prop("open", true);
    }
    const messages = invalidFields.map(field => `${labels.get(field) || 'Поле'}: ${field.get(0).validationMessage}`);
    ui.errors.text(messages.length ? `Проверьте данные. ${messages.join(' ')}` : 'Проверьте данные визита.');
    ui.errors.prop("hidden", false);
  }
  function packageRooms() {
    return [...new Set(cart.items.map(item => String(item.id || '').split('-')[0]))];
  }
  function refreshConstraints() {
    if (sending) return;
    ui.name.get(0).setCustomValidity(ui.name.val().trim() ? '' : 'Введите имя: от 2 до 80 символов.');
    const name = ui.name.val().trim();
    if (ui.name.val() && (name.length < 2 || name.length > 80 || (/[\p{Cc}\p{Cf}]/u).test(name))) ui.name.get(0).setCustomValidity('Укажите имя: от 2 до 80 символов.');
    ui.phone.get(0).setCustomValidity(ui.phone.val().trim() ? '' : 'Введите телефон с кодом страны, например +7 700 000 00 00.');
    const phone = ui.phone.val().trim();
    const digits = phone.replace(/\D/g, '');
    if (phone && (!(/^[+\d ()-]+$/).test(phone) || digits.length < 10 || digits.length > 15 || digits.startsWith('0'))) ui.phone.get(0).setCustomValidity('Укажите телефон с кодом страны, например +7 700 000 00 00.');
    const email = ui.email.val().trim();
    ui.email.get(0).setCustomValidity(email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      ? 'Укажите e-mail в формате name@example.com или оставьте поле пустым.' : '');
    // required/type/min/max stay as the browser's first defence. A visitor can bypass
    // JavaScript entirely, so booking_server.py independently validates every request.
    const now = clubNow();
    const room = has(rooms, ui.room.val()) ? rooms[ui.room.val()] : null;
    ui.room.get(0).setCustomValidity(room ? '' : 'Выберите Standard, Duo или VIP.');
    const packageMode = ui.mode.val() === 'packages';
    ui.mode.get(0).setCustomValidity(!['hourly', 'packages'].includes(ui.mode.val()) ? 'Выберите способ расчёта.' : packageMode && (!window.PixelPackagePricing || !window.PixelCart?.getCatalog().length) ? 'Прайс не загрузился. Обновите страницу или выберите почасовой тариф.' : '');
    ui.package.prop("disabled", !packageMode);
    ui.package.prop("required", packageMode);
    $('#booking-package-wrap').prop("hidden", !packageMode);
    const selectedPackage = window.PixelCart?.getCatalog().find(item => item.id === ui.package.val());
    $('#booking-package-condition').text(selectedPackage?.condition || '');
    const quote = packageMode ? packageQuote() : null;
    ui.package.get(0).setCustomValidity(packageMode && !quote?.ok ? quoteError(quote?.code) : '');
    const hint = $('#booking-mode-hint');
    hint.prop("hidden", packageMode);
    hint.text(packageMode ? '' : 'Почасовой тариф рассчитывается по числу ПК и часов.');
    ui.guests.prop("max", room ? String(room.capacity) : '20');
    ui.guests.get(0).setCustomValidity('');
    const guests = Number(ui.guests.val());
    if (ui.guests.val() && !integer(guests, 1, room ? room.capacity : 20)) {
      ui.guests.get(0).setCustomValidity(room && guests > room.capacity ? `В ${room.name} ${room.capacity} ПК. Уменьшите число игроков или выберите другой зал.` : 'Укажите целое число игроков от 1.');
    }
    ui.duration.prop("disabled", false);
    $('#booking-duration-wrap').prop("hidden", false);
    $('#booking-nearby-wrap').prop("hidden", Number(ui.guests.val()) <= 1);
    if (Number(ui.guests.val()) <= 1) ui.nearby.prop("checked", false);
    ui.duration.get(0).setCustomValidity('');
    if (ui.duration.val() && !integer(Number(ui.duration.val()), 1, 12)) {
      ui.duration.get(0).setCustomValidity('Укажите целое число часов от 1 до 12.');
    }
    ui.date.prop("min", now.date);
    ui.date.get(0).setCustomValidity('');
    if (ui.date.val() && !validDate(ui.date.val())) {
      ui.date.get(0).setCustomValidity('Укажите существующую календарную дату.');
    } else if (ui.date.val() && ui.date.val() < now.date) {
      ui.date.get(0).setCustomValidity('Выберите сегодняшнюю или будущую дату.');
    }
    ui.time.prop("min", ui.date.val() === now.date ? now.time : '');
    ui.time.get(0).setCustomValidity('');
    if (ui.time.val() && !validTime(ui.time.val())) {
      ui.time.get(0).setCustomValidity('Укажите время в формате часы:минуты.');
    } else if (validDate(ui.date.val()) && validTime(ui.time.val()) && isPast(ui.date.val(), ui.time.val(), now)) {
      ui.time.get(0).setCustomValidity('Время начала уже прошло в Астане. Выберите будущие дату и время.');
    }
    ui.seat.get(0).setCustomValidity('');
    if (ui.seat.val() && !seats.has(ui.seat.val())) {
      ui.seat.get(0).setCustomValidity('Выберите ПК из списка или оставьте пожелание пустым.');
    } else if (ui.seat.val() && seats.get(ui.seat.val()).room !== ui.room.val()) {
      ui.seat.get(0).setCustomValidity('Этот ПК находится в другом зале. Измените зал или пожелание по ПК.');
    }
    ui.game.get(0).setCustomValidity(ui.game.val() && !has(games, ui.game.val()) ? 'Выберите игру из списка или оставьте поле пустым.' : '');
  }
  function hourlyEstimate(plan) {
    const room = has(rooms, plan.room) ? rooms[plan.room] : null;
    if (!room || room.hourly === null || !integer(plan.guests, 1, room.capacity) || !integer(plan.duration, 1, 12)) return null;
    return room.hourly * plan.guests * plan.duration;
  }
  function packageQuote(plan = collectPlan()) {
    return window.PixelPackagePricing?.calculate(plan, window.PixelCart?.getCatalog() || [], rooms);
  }
  function quoteError(code) {
    return ({
      package: 'Выберите пакет выбранного зала.',
      manual: 'Студенческий тариф согласуется по телефону.',
      inputs: 'Проверьте число игроков и длительность.',
      'date-time': 'Укажите дату и время для проверки интервала пакета.',
      weekday: 'Этот пакет действует только по будням. Измените дату или тариф.',
      window: 'Визит не пересекается с интервалом пакета. Измените время или тариф.'
    })[code] || 'Пакетный расчёт недоступен. Выберите почасовой тариф.';
  }
  function timeAmount(minutes) {
    return `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ''}`;
  }
  function quoteLines(quote) {
    const item = window.PixelCart.getCatalog().find(p => p.id === quote.packageId);
    return [`Пакеты «${item.title}» для ${quote.quantity} ПК: ${money.format(quote.unitPrice)} ₸ × ${quote.quantity} = ${money.format(quote.packageTotal)} ₸.`, `Покрыто пакетом: ${timeAmount(quote.coveredMinutes)} на каждом ПК.`, `Доплата: ${quote.extraHours} ч × ${quote.quantity} ПК = ${money.format(quote.extraTotal)} ₸.`, `Неиспользовано: ${timeAmount(quote.unusedMinutes)} на каждом ПК. Дальнейшее использование подтвердит клуб.`, ...quote.assumedWindow ? ['Для ночного Duo в модели принят интервал 22:00–08:00; клуб его отдельно не опубликовал.'] : [], 'Расчёт по модели сайта: один пакет на ПК; доплата округляется до часа вверх; остаток не зачтён на будущие визиты. Условия и сумму подтверждает клуб.'];
  }
  function packageFormula(quote) {
    return `Пакеты ${money.format(quote.packageTotal)} ₸ + доплата ${money.format(quote.extraTotal)} ₸ =`;
  }
  function renderPackageFacts(target, quote) {
    const item = window.PixelCart.getCatalog().find(p => p.id === quote.packageId);
    const facts = [['Пакет', `${item.title} · ${quote.quantity} ПК`], ['Покрыто', `${timeAmount(quote.coveredMinutes)} на каждом ПК`], ['Остаток', `${timeAmount(quote.unusedMinutes)} на каждом ПК`], ['Почасовой визит', `${money.format(quote.hourlyTotal)} ₸ за всех`]];
    target.empty();
    for (const [label, value] of facts) {
      const row = $("<div>");
      const dt = $("<dt>");
      dt.text(label);
      const dd = $("<dd>");
      dd.text(value);
      row.append(dt, dd);
      target.append(row);
    }
  }
  function endTime(plan) {
    if (!validDate(plan.date) || !validTime(plan.time) || !integer(Number(plan.duration), 1, 12)) return '';
    const end = new Date(`${plan.date}T${plan.time}:00+05:00`);
    end.setTime(end.getTime() + Number(plan.duration) * 3600000);
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Asia/Almaty',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }).format(end);
  }
  function renderEstimate() {
    const packages = ui.mode.val() === 'packages';
    const hourly = hourlyEstimate({
      room: ui.room.val(),
      guests: Number(ui.guests.val()),
      duration: Number(ui.duration.val())
    });
    const quote = packages ? packageQuote() : null;
    const estimate = packages ? quote?.ok ? quote.total : null : hourly;
    ui.total.text(estimate === null ? '—' : `${money.format(estimate)} ₸`);
    ui['mobile-total'].text(ui.total.text());
    $('#booking-total-label').text(packages ? 'Предварительно за весь визит' : 'Стоимость всего визита');
    $('#booking-packages-section').prop("hidden", !packages || !quote?.ok);
    const formula = $('#booking-package-formula');
    formula.prop("hidden", !packages || !quote?.ok);
    formula.text(quote?.ok ? packageFormula(quote) : '');
    ui['price-note'].text(packages ? quote?.ok ? 'По модели сайта. Условия и сумму подтвердит клуб.' : quoteError(quote?.code) : estimate === null ? 'Укажите допустимое число ПК и часов.' : `${money.format(rooms[ui.room.val()].hourly)} ₸ × ${ui.guests.val()} ПК × ${ui.duration.val()} ч. Без пакетов и скидок.`);
    const end = endTime(collectPlan());
    ui.end.text(end ? `Окончание: ${end} · время Астаны` : '');
    if (quote?.ok) {
      renderPackageFacts(ui['cart-items'], quote);
      ui['cart-note'].text(quote.extraHours ? `Доплата за ${quote.extraHours} ч на каждом ПК.` : 'Весь визит покрыт пакетом.');
      if (quote.assumedWindow) ui['cart-note'].text(ui['cart-note'].text() + ' Интервал ночного Duo принят по модели сайта: 22:00–08:00.');
      $('#booking-package-math').text(`${money.format(quote.unitPrice)} ₸ × ${quote.quantity} ПК = ${money.format(quote.packageTotal)} ₸ за пакеты. Доплата: ${quote.extraHours} ч × ${money.format(rooms[ui.room.val()].hourly)} ₸ × ${quote.quantity} ПК = ${money.format(quote.extraTotal)} ₸.`);
    }
    $('#booking-mobile-label').text(packages ? 'Предварительно' : 'Весь визит');
    renderReview();
  }
  function fillReview(target, plan, contact = null) {
    const date = validDate(plan.date) ? displayDate.format(new Date(`${plan.date}T12:00:00Z`)) : 'Выберите дату';
    const facts = [['Зал', rooms[plan.room]?.name || 'Выберите зал'], ['Игроки', `${plan.guests || '—'} · столько же ПК`], ['Начало', `${date}${plan.time ? `, ${plan.time}` : ' · выберите время'}`], ['Часы', `${plan.duration || '—'} ч · время Астаны`], ['Окончание', endTime(plan) || 'Укажите дату, время и часы']];
    if (plan.seat) facts.push(['Место', `${seats.get(plan.seat)?.label} · пожелание`]);
    if (plan.nearby) facts.push(['Посадка', 'Рядом · пожелание']);
    if (plan.game) facts.push(['Игра', games[plan.game]]);
    if (contact?.name) facts.push(['Имя', contact.name]);
    if (contact?.phone) facts.push(['Телефон', contact.phone]);
    if (contact?.email) facts.push(['E-mail', contact.email]);
    target.empty();
    for (const [name, value] of facts) {
      const row = $("<div>");
      const dt = $("<dt>");
      dt.text(name);
      const dd = $("<dd>");
      dd.text(value);
      row.append(dt, dd);
      target.append(row);
    }
  }
  function renderReview() {
    const plan = collectPlan();
    fillReview($('#booking-review'), plan, collectContact());
    const hardware = {
      standard: '20 ПК · RTX 4060 · 280 Гц',
      duo: '2 ПК · RTX 4060 · 310 Гц',
      vip: '5 ПК · RTX 4070 Ti · 360 Гц'
    };
    $('#room-capacity-note').text(hardware[plan.room]);
  }
  function renderInlineErrors(includeEmpty) {
    for (const [field] of labels) {
      const error = $("#" + `${field.attr("id")}-error`);
      if (!error.length) continue;
      const invalid = !field.is(':disabled') && !field.get(0).validity.valid && (includeEmpty || validationAttempted || !!field.val());
      if (invalid) {
        error.stop(true, true).text(field.get(0).validationMessage).prop('hidden', false).show();
      } else {
        // Clear corrected feedback immediately; fade the old space before hiding it.
        error.text('').stop(true, true).fadeOut(effectDuration, function () {
          $(this).prop('hidden', true).removeAttr('style');
        });
      }
      field.toggleClass('is-invalid', invalid);
      if (invalid) field.attr('aria-invalid', 'true'); else field.removeAttr('aria-invalid');
    }
  }
  function renderPackagePicker(snapshot) {
    const target = $('#package-options');
    const catalog = window.PixelCart?.getCatalog() || [];
    if (ui.package.attr("data-room") !== ui.room.val()) {
      // jQuery returns null for an empty select; native select.value returned ''.
      const previous = (ui.package.val() || '').replace(/^[^-]+-/, `${ui.room.val()}-`);
      ui.package.empty();
      for (const item of catalog.filter(p => p.room === ui.room.val() && p.kind !== 'hourly')) {
        const option = $("<option>");
        option.val(item.id);
        option.text(`${item.title} · ${money.format(item.price)} ₸ / ПК${item.manualOnly ? ' · по телефону' : ''}`);
        option.prop("disabled", !!item.manualOnly);
        ui.package.append(option);
      }
      if (catalog.some(p => p.id === previous && !p.manualOnly)) ui.package.val(previous);
      ui.package.attr("data-room", ui.room.val());
    }
    target.empty();
    for (const item of catalog.filter(item => item.room === ui.room.val())) {
      const quantity = snapshot?.items.find(p => p.id === item.id)?.quantity || 0;
      if (item.id.endsWith('1-hour') && !quantity) continue;
      const row = $("<div>");
      row.addClass('package-option');
      const detail = $("<div>");
      const title = $("<h3>");
      title.text(item.title);
      const price = $("<strong>");
      price.text(`${money.format(item.price)} ₸ / пакет`);
      const note = $("<p>");
      note.text(item.condition);
      detail.append(title, price, note);
      if (item.id.endsWith('3-hours') || item.id.endsWith('5-hours')) {
        const compare = $("<p>");
        const hours = item.id.endsWith('3-hours') ? 3 : 5;
        compare.text(`Для сравнения: ${hours} ч почасово — ${money.format(rooms[ui.room.val()].hourly * hours)} ₸ / ПК.`);
        detail.append(compare);
      }
      if (quantity) {
        const subtotal = $("<p>");
        subtotal.text(`${quantity} × ${money.format(item.price)} ₸ = ${money.format(quantity * item.price)} ₸`);
        detail.append(subtotal);
      }
      row.append(detail);
      row.toggleClass('active', quantity > 0);
      if (!item.manualOnly) row.append(packageCounter(item, quantity));
      target.append(row);
    }
    $('#package-selection-status').text(cart.count ? `В корзине: ${cart.count} пакетов · ${money.format(cart.total)} ₸. Для расчёта визита нажмите «В план» у нужного пакета.` : 'Корзина пуста. Добавьте пакет кнопкой «+» или рассчитайте визит почасово.');
    renderCartActions();
  }
  function packageCounter(item, quantity) {
    const M = window.PixelMain;
    const actions = node('div', '', 'd-flex flex-column gap-2');
    const counter = node('div', '', 'package-counter');
    for (const delta of [-1, 1]) {
      const button = node('button', delta < 0 ? '−' : '+');
      button.prop("type", 'button');
      button.attr("data-quantity", `${item.id}:${delta}`);
      button.attr('aria-label', `${delta < 0 ? 'Уменьшить' : 'Добавить'}: ${item.name}`);
      button.prop("disabled", delta < 0 ? quantity === 0 : quantity >= rooms[item.room].capacity);
      button.on('click', () => {
        window.PixelCart.setQuantity(item.id, quantity + delta);
        announce(`${item.name}: ${quantity + delta} шт. в корзине.`);
        const next = $('[data-quantity]').filter(function () {
          return $(this).attr('data-quantity') === `${item.id}:${delta}`;
        }).first();
        if (next.length && !next.prop("disabled")) next.get(0).focus();
      });
      if (delta === 1) counter.append(node('output', String(quantity)));
      counter.append(button);
    }
    actions.append(counter);
    if (quantity > 0) {
      const remove = node('button', 'Удалить', 'text-button');
      remove.prop("type", 'button');
      remove.attr('aria-label', `Удалить: ${item.name}`);
      remove.on('click', () => {
        window.PixelCart.setQuantity(item.id, 0);
        announce(`${item.name}: удалено из корзины.`);
        $('#cart-clear').get(0).focus();
      });
      actions.append(remove);
      if (item.kind !== 'hourly') {
        const apply = node('button', 'В план', 'btn btn-outline-light');
        apply.prop("type", 'button');
        apply.attr('aria-label', `В план: ${item.name}`);
        apply.on('click', () => {
          ui.mode.val('packages');
          ui.package.val(item.id);
          ui.guests.val(String(quantity));
          onChange();
          $('#package-picker').prop("open", false);
          announce(`${item.name}: выбран для ${quantity} игроков. Проверьте дату и время визита.`);
          ui.date.get(0).focus();
        });
        actions.append(apply);
      }
    }
    return actions;
  }
  function renderCartActions() {
    const M = window.PixelMain;
    let actions = $('#cart-actions');
    if (!actions.length) {
      actions = node('div', '', 'd-flex flex-wrap gap-3 my-3');
      actions.attr("id", 'cart-actions');
      const checkout = node('button', 'Подтвердить выбор', 'btn btn-outline-light');
      checkout.prop("type", 'button');
      checkout.attr("id", 'cart-checkout');
      const clear = node('button', 'Очистить корзину', 'text-button');
      clear.prop("type", 'button');
      clear.attr("id", 'cart-clear');
      const receipt = node('div', '', 'small my-3');
      receipt.attr("id", 'cart-receipt');
      receipt.attr('role', 'status');
      checkout.on('click', () => {
        const snapshot = window.PixelCart.getSnapshot();
        if (!snapshot.count) return;
        receipt.empty();
        const title = node('p', `Демонстрационный выбор № ${M.reference()}`);
        const list = $("<ul>");
        for (const item of snapshot.items) list.append(node('li', `${item.name}: ${item.quantity} × ${M.money(item.price)} = ${M.money(item.quantity * item.price)}`));
        receipt.append(title, list, node('p', `Всего: ${snapshot.count} · ${M.money(snapshot.total)}. Данные не отправлены на сервер; реальный заказ, оплата и бронь не созданы.`));
        receipt.addClass('success-message');
      });
      clear.on('click', () => {
        window.PixelCart.replaceItems([]);
        announce('Корзина очищена.');
        $('#package-picker').find('summary').first().get(0).focus();
      });
      actions.append(checkout, clear);
      $('#package-selection-status').after(actions, receipt);
    }
    $('#cart-checkout').prop("disabled", cart.count === 0);
    $('#cart-clear').prop("disabled", cart.count === 0);
    const receipt = $('#cart-receipt');
    receipt.empty();
    receipt.removeClass('success-message');
  }
  function saveDraft() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(collectPlan()));
      return true;
    } catch {
      announce('Сохранение в браузере недоступно. Не закрывайте страницу до копирования деталей.');
      return false;
    }
  }
  function readDraft() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      if (!value || typeof value !== 'object' || !has(rooms, value.room)) return {};
      const safe = {
        ...value
      };
      for (const key of ['guests', 'duration']) {
        const raw = String(value[key] ?? '');
        safe[key] = (/^\d{0,3}$/).test(raw) ? raw : '';
      }
      safe.date = validDate(value.date) ? value.date : '';
      safe.time = validTime(value.time) ? value.time : '';
      safe.seat = seats.has(value.seat) ? value.seat : '';
      safe.game = has(games, value.game) ? value.game : '';
      return {
        draft: safe
      };
    } catch {
      return {};
    }
  }
  function applyDraft(draft) {
    for (const key of ['room', 'guests', 'duration', 'date', 'time', 'seat', 'game']) {
      ui[key].val(typeof draft[key] === 'string' || typeof draft[key] === 'number' ? String(draft[key]) : '');
    }
    ui.nearby.prop("checked", draft.nearby === true);
    ui.mode.val(draft.mode === 'packages' ? 'packages' : 'hourly');
    renderPackagePicker(window.PixelCart?.getSnapshot());
    if (draft.packageId && ui.package.find('option:not(:disabled)').filter(function () {
      return $(this).val() === draft.packageId;
    }).length) ui.package.val(draft.packageId);
  }
  function filterSeats() {
    ui.seat.find('optgroup').each(function () {
      const group = $(this);
      const matching = group.prop("label") === rooms[ui.room.val()]?.name;
      group.prop("hidden", !matching);
      group.children().prop('disabled', !matching);
    });
    if (ui.seat.val() && seats.get(ui.seat.val())?.room !== ui.room.val()) ui.seat.val('');
  }
  function applyQuery() {
    const query = new URLSearchParams(window.location.search);
    const messages = [];
    const roomValue = query.get('room');
    const seatValue = query.get('seat');
    const gameValue = query.get('game');
    const queryRoom = roomValue !== null && has(rooms, roomValue) ? roomValue : null;
    if (query.has('room') && !queryRoom) messages.push('Зал из ссылки не распознан.');
    if (queryRoom) ui.room.val(queryRoom);
    if (seatValue !== null) {
      const seat = seats.get(seatValue);
      if (!seat) messages.push('ПК из ссылки не распознан.'); else if (queryRoom && seat.room !== queryRoom) {
        messages.push('ПК из ссылки относится к другому залу; он не выбран.');
        if (ui.seat.val() && seats.get(ui.seat.val())?.room !== queryRoom) {
          ui.seat.val('');
          messages.push('Пожелание по ПК из предыдущего плана сброшено: выбран другой зал.');
        }
      } else {
        if (!queryRoom) ui.room.val(seat.room);
        ui.seat.val(seatValue);
        messages.push('Номер ПК добавлен в пожелания.');
      }
    } else if (queryRoom && ui.seat.val() && seats.get(ui.seat.val())?.room !== queryRoom) {
      ui.seat.val('');
      messages.push('Пожелание по ПК из предыдущего плана сброшено: выбран другой зал.');
    }
    for (const [key, maximum] of [['guests', rooms[ui.room.val()]?.capacity || 20], ['duration', 12]]) {
      if (!query.has(key)) continue;
      const raw = query.get(key);
      if ((/^\d{1,2}$/).test(raw) && integer(Number(raw), 1, maximum)) ui[key].val(raw); else messages.push(key === 'guests' ? 'Число игроков из ссылки не подходит выбранному залу.' : 'Длительность из ссылки должна быть от 1 до 12 часов.');
    }
    if (gameValue !== null) {
      if (has(games, gameValue)) ui.game.val(gameValue); else messages.push('Игра из ссылки не распознана.');
    }
    return messages.join(' ');
  }
  function revealPreferences() {
    if (window.location.hash === '#preferences') $('#preferences').prop("open", true);
    for (const field of [ui.seat, ui.game]) {
      const details = field.val() ? field.closest('details') : null;
      if (details?.length) details.prop("open", true);
    }
  }
  function clearEntryQuery() {
    try {
      const url = new URL(window.location.href);
      for (const key of ['room', 'seat', 'game', 'mode', 'guests', 'duration']) url.searchParams.delete(key);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {}
  }
  function collectPlan() {
    const item = window.PixelCart?.getCatalog().find(p => p.id === ui.package.val());
    return {
      version: 2,
      mode: ui.mode.val(),
      room: ui.room.val(),
      guests: ui.guests.val(),
      duration: ui.duration.val(),
      date: ui.date.val(),
      time: ui.time.val(),
      nearby: ui.nearby.prop("checked"),
      seat: ui.seat.val(),
      game: ui.game.val(),
      packageCatalogVersion: 2,
      ...ui.mode.val() === 'packages' ? {
        pricingPolicy: window.PixelPackagePricing?.policy,
        packageId: ui.package.val()
      } : {},
      packages: ui.mode.val() === 'packages' && item ? [{
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: Number(ui.guests.val())
      }] : []
    };
  }
  function collectContact() {
    let digits = ui.phone.val().replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8') && !ui.phone.val().trim().startsWith('+')) digits = '7' + digits.slice(1);
    return {
      name: ui.name.val().trim(),
      phone: digits ? '+' + digits : '',
      ...(ui.email.val().trim() ? {email: ui.email.val().trim()} : {})
    };
  }
  function makeSummary(plan) {
    const lines = ['План визита PIXEL', `Зал: ${rooms[plan.room].name}.`, `Игроки / ПК: ${plan.guests}.`, `Начало: ${plan.date}, ${plan.time} (Астана).`];
    if (plan.mode === 'packages') {
      const quote = plan.pricingPolicy === window.PixelPackagePricing?.policy ? packageQuote(plan) : null;
      lines.push(`Планируемая длительность: ${plan.duration} ч. Окончание: ${endTime(plan)}.`, 'Выбранные пакеты:');
      for (const item of plan.packages || cart.items) lines.push(`${item.name}: ${item.quantity} × ${money.format(item.price)} ₸.`);
      if (quote?.ok) lines.push(...quoteLines(quote), `Предварительно за весь визит: ${money.format(quote.total)} ₸.`); else lines.push(`Стоимость пакетов по старому прайсу: ${money.format((plan.packages || cart.items).reduce((sum, item) => sum + item.price * item.quantity, 0))} ₸. Это не стоимость сеанса.`, 'Применимость пакетов к визиту нужно уточнить у клуба.');
    } else {
      lines.push(`Длительность: ${plan.duration} ч. Окончание: ${endTime(plan)}.`, `Стоимость: ${money.format(hourlyEstimate({
        ...plan,
        guests: Number(plan.guests),
        duration: Number(plan.duration)
      }))} ₸.`);
    }
    if (plan.nearby) lines.push('Пожелание: сидеть рядом.');
    if (plan.seat) lines.push(`Пожелание: ${seats.get(plan.seat)?.label || ''}.`);
    if (plan.game) lines.push(`Игра: ${games[plan.game] || ''}.`);
    lines.push('Астана, проспект Мәңгілік Ел, 36.', '', 'Места и условия визита подтверждает администратор клуба.');
    return lines.join('\n');
  }
  function showConfirmation(record, focus = false) {
    announce('');
    savedRecord = record;
    preparedPlan = record.plan;
    const request = record.kind === 'request';
    const test = request && record.receipt?.status === 'test';
    ui['result-title'].text(request ? test ? 'Проверка завершена' : 'Заявка отправлена' : 'Сохранённый план');
    ui.success.find('p').first().text(request ? test ? 'Тестовый режим: заявка не отправлена администратору; реальные места не забронированы.' : 'Заявка отправлена администратору. Дождитесь подтверждения мест и условий по телефону.' : 'Это локальная копия плана. Она не отправлена администратору.');
    ui.summary.val(record.summary + (record.contact ? `\nИмя: ${record.contact.name}.\nТелефон: ${record.contact.phone}.`
      + (record.contact.email ? `\nE-mail: ${record.contact.email}.` : '') : '') + (request ? `\n${test ? 'Демонстрационный план' : 'Заявка отправлена'}. Номер: ${record.receipt.reference}.` : ''));
    ui.edit.text(request && !test ? 'Подготовить другой визит' : 'Изменить план');
    $('#booking-cancel-note').prop("hidden", !request || test);
    ui.result.prop("hidden", false);
    ui.copy.prop("disabled", false);
    ui.success.prop("hidden", false);
    ui.success.addClass('success-message');
    layout.prop("hidden", true);
    showSaved.prop("hidden", true);
    fillReview($('#booking-saved-review'), record.plan, record.contact);
    const price = $('#booking-saved-price');
    price.empty();
    const packages = record.plan.mode === 'packages';
    const quote = packages && record.plan.pricingPolicy === window.PixelPackagePricing?.policy ? packageQuote(record.plan) : null;
    const packageItems = Array.isArray(record.plan.packages) ? record.plan.packages : [];
    const amount = quote?.ok ? quote.total : packages ? packageItems.reduce((sum, item) => sum + item.price * item.quantity, 0) : hourlyEstimate({
      ...record.plan,
      guests: Number(record.plan.guests),
      duration: Number(record.plan.duration)
    });
    const label = $("<p>");
    label.addClass('form-text');
    label.text(quote?.ok ? 'Предварительно за весь визит' : packages ? 'Стоимость выбранных пакетов' : 'Стоимость сеанса');
    const total = $("<strong>");
    total.text(`${money.format(amount)} ₸`);
    price.append(label);
    if (quote?.ok) {
      const formula = $("<p>");
      formula.addClass('package-formula');
      formula.text(packageFormula(quote));
      price.append(formula);
    }
    price.append(total);
    if (quote?.ok) {
      const note = $("<p>");
      note.addClass('form-text');
      note.text('По модели сайта. Условия и сумму подтвердит клуб.');
      const facts = $("<dl>");
      facts.addClass('review-list package-facts');
      renderPackageFacts(facts, quote);
      const details = $("<details>");
      details.addClass('package-method');
      const heading = $("<summary>");
      heading.text('Как посчитали');
      const list = $("<ul>");
      for (const line of quoteLines(quote)) {
        const row = $("<li>");
        row.text(line);
        list.append(row);
      }
      details.append(heading, list);
      price.append(note, facts, details);
    } else if (packages) {
      const list = $("<ul>");
      for (const item of packageItems) {
        const row = $("<li>");
        row.text(typeof item === 'string' ? item : `${item.name} · ${item.quantity} шт. · ${money.format(item.price * item.quantity)} ₸`);
        list.append(row);
      }
      const note = $("<p>");
      note.addClass('form-text');
      note.text('Это сумма пакетов, не стоимость сеанса. Применение к визиту уточните у клуба.');
      price.append(list, note);
    }
    ui['mobile-next'].prop("hidden", true);
    $('#booking-copy-details').prop("open", false);
    // Reveal the confirmed result, then move focus only after the panel finishes.
    ui.result.stop(true, true).hide().fadeIn(effectDuration, function () {
      // Let the existing hidden attribute control later edit/reset transitions again.
      $(this).removeAttr('style');
      if (focus) {
        $(this).find('#booking-result-title').get(0).focus({preventScroll: true});
        $(this).get(0).scrollIntoView({behavior: 'auto', block: 'start'});
      }
    });
  }
  function renderCart(snapshot) {
    const items = snapshot && Array.isArray(snapshot.items) ? snapshot.items.filter(item => item?.id?.startsWith(`${ui.room.val()}-`) && item && typeof item.name === 'string' && integer(item.price, 1, Number.MAX_SAFE_INTEGER) && integer(item.quantity, 1, 99) && Number.isSafeInteger(item.price * item.quantity)).map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })) : [];
    cart = {
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      persistenceAvailable: snapshot?.persistenceAvailable !== false
    };
    ui['cart-items'].empty();
    for (const item of cart.items) {
      const row = $("<li>");
      row.text(`${item.name} · ${item.quantity} шт. · ${money.format(item.price * item.quantity)} ₸`);
      ui['cart-items'].append(row);
    }
    ui['cart-note'].text(cart.count ? `Всего пакетов: ${cart.count}.` : 'Пакеты не выбраны.');
    renderPackagePicker(snapshot);
    refreshConstraints();
    renderEstimate();
  }
  function updateCart() {
    try {
      if (window.PixelCart && typeof window.PixelCart.getSnapshot === 'function') {
        cartAvailable = true;
        renderCart(window.PixelCart.getSnapshot());
        return;
      }
    } catch {
      cartAvailable = false;
    }
    cartAvailable = false;
    renderCart(null);
  }
  function onChange() {
    if (sending) return;
    editing();
    clearErrors();
    filterSeats();
    updateCart();
    refreshConstraints();
    renderEstimate();
    renderInlineErrors(false);
    saveDraft();
    if (savedRecord) {
      announce(savedRecord.receipt?.status === 'sent' ? 'Это новый план. Для изменения отправленной заявки свяжитесь с клубом.' : 'Вы меняете черновик. Отправка выполняется отдельным действием.');
    }
  }
  form.on('input', onChange);
  form.on('change', onChange);
  // Native invalid events do not bubble; bind the known controls with .on().
  form.find('input,select').on('invalid', showErrors);
  form.on('focusout', () => {
    refreshConstraints();
    renderInlineErrors(false);
  });
  form.on('submit', async event => {
    // Without this, the browser would navigate/reload instead of sending one API request.
    event.preventDefault();
    if (sending || !ui.result.prop("hidden")) return;
    form.find('input[type="text"],input[type="tel"],input[type="email"]').each(function () {
      $(this).val($(this).val().trim());
    });
    refreshConstraints();
    validationAttempted = true;
    if (!form.get(0).checkValidity()) {
      showErrors();
      renderInlineErrors(true);
      const first = [...labels.keys()].find(field => !field.get(0).validity.valid);
      first?.get(0).focus();
      return;
    }
    clearErrors();
    if (mobile.matches && !reviewed) {
      reviewed = true;
      reviewActions.prop("hidden", false);
      ui['mobile-next'].prop("hidden", true);
      const heading = $('#booking-call-title');
      heading.get(0).focus({
        preventScroll: true
      });
      $('#visit-review').get(0).scrollIntoView({
        behavior: 'auto',
        block: 'start'
      });
      return;
    }
    const plan = collectPlan(), contact = collectContact();
    sending = true;
    const controls = [...form.find('input,select,button').toArray().map(control => $(control)), reviewSubmit, $('#booking-back'), ui['mobile-submit'], showSaved];
    const disabled = controls.map(control => control.prop("disabled"));
    controls.forEach(control => {
      control.prop("disabled", true);
    });
    form.attr('aria-busy', 'true');
    reviewSubmit.add(ui.submit).text('Отправляем…');
    announce('Отправляем заявку администратору.');
    try {
      const receipt = await window.PixelBookingDelivery.send(plan, contact);
      const record = {
        kind: 'request',
        plan,
        summary: makeSummary(plan),
        receipt
      };
      saveDraft();
      // Persist only visit details and the receipt, never name, phone or email.
      try {
        localStorage.setItem(confirmationKey, JSON.stringify(record));
      } catch {}
      form.get(0).reset();
      validationAttempted = false;
      clearErrors();
      labels.forEach((label, field) => {
        field.get(0).setCustomValidity('');
        field.removeClass('is-invalid').removeAttr('aria-invalid');
        $(`#${field.attr('id')}-error`).stop(true, true).text('').prop('hidden', true);
      });
      showConfirmation({
        ...record,
        contact
      }, true);
      announce(receipt.status === 'test' ? 'Проверка завершена. Заявка администратору не отправлена.' : 'Заявка отправлена. Дождитесь звонка администратора.');
    } catch (error) {
      editing();
      announce('');
      ui.errors.text(error.message || 'Не удалось отправить заявку. Свяжитесь с клубом.');
      ui.errors.prop("hidden", false);
      for (const [key, message] of Object.entries(error.fields || ({}))) {
        const field = ui[key];
        if (!labels.has(field) || typeof message !== 'string') continue;
        field.attr('aria-invalid', 'true');
        const note = $("#" + `${field.attr("id")}-error`);
        if (note.length) {
          note.stop(true, true).text(message).prop('hidden', false).show();
          field.addClass('is-invalid');
        }
      }
      ui.errors.get(0).focus();
    } finally {
      sending = false;
      controls.forEach((control, index) => {
        control.prop("disabled", disabled[index]);
      });
      form.removeAttr('aria-busy');
      ui.submit.text(mobile.matches ? 'Проверить план →' : 'Забронировать');
      reviewSubmit.text('Забронировать');
    }
  });
  ui.edit.on('click', () => {
    const sent = savedRecord?.receipt?.status === 'sent';
    if (preparedPlan) {
      if (preparedPlan.mode === 'packages' && preparedPlan.packageCatalogVersion === 2 && Array.isArray(preparedPlan.packages)) {
        const otherRooms = window.PixelCart.getSnapshot().items.filter(item => !item.id.startsWith(`${preparedPlan.room}-`));
        window.PixelCart.replaceItems([...otherRooms, ...preparedPlan.packages]);
      }
      applyDraft(preparedPlan);
    }
    updateCart();
    editing();
    filterSeats();
    revealPreferences();
    refreshConstraints();
    renderEstimate();
    saveDraft();
    ui.room.get(0).focus();
    announce(sent ? 'Подготовьте новую заявку. Для изменения предыдущей свяжитесь с клубом.' : 'Измените параметры и проверьте план перед отправкой.');
  });
  ui.cancel.on('click', () => {
    const sent = savedRecord?.receipt?.status === 'sent';
    try {
      localStorage.removeItem(confirmationKey);
    } catch {
      announce('Не удалось удалить сохранённый план. Разрешите сохранение в браузере и повторите.');
      return;
    }
    hideResult();
    announce(sent ? 'Локальная копия удалена. Отправленная заявка не отменена: для отмены свяжитесь с клубом.' : 'Копия плана удалена с устройства. Заявка администратору не отправлялась.');
    editing();
    ui.room.get(0).focus();
  });
  ui.reset.on('click', () => {
    validationAttempted = false;
    form.get(0).reset();
    applyDraft({
      room: 'standard',
      guests: 1,
      duration: 2,
      date: '',
      time: '',
      nearby: false,
      seat: '',
      game: ''
    });
    clearErrors();
    filterSeats();
    updateCart();
    refreshConstraints();
    renderEstimate();
    renderInlineErrors(false);
    clearEntryQuery();
    saveDraft();
    editing();
    announce('Поля очищены. Сохранённый план и выбранные пакеты не изменены.');
    ui.room.get(0).focus();
  });
  ui.copy.on('click', async () => {
    if (!preparedPlan || ui.result.prop("hidden")) return;
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(ui.summary.val());
      announce('Детали плана скопированы.');
    } catch {
      $('#booking-copy-details').prop("open", true);
      ui.summary.get(0).focus();
      ui.summary.get(0).select();
      announce('Не удалось скопировать автоматически. Текст выделен: скопируйте его вручную.');
    }
  });
  showSaved.on('click', () => {
    if (savedRecord) {
      showConfirmation(savedRecord, true);
      announce('Показан сохранённый план.');
    }
  });
  $('#booking-back').on('click', () => {
    editing();
    ui.room.get(0).focus();
  });
  $('#booking-use-hourly').on('click', () => {
    ui.mode.val('hourly');
    $('#package-picker').prop("open", false);
    onChange();
    ui.name.get(0).focus();
  });
  $(window).on('focus', refreshConstraints);
  const restored = readDraft();
  if (restored.draft) applyDraft(restored.draft);
  const queryMessage = applyQuery();
  filterSeats();
  revealPreferences();
  hideResult();
  updateCart();
  const query = new URLSearchParams(window.location.search);
  if (query.get('mode') === 'packages') {
    ui.mode.val('packages');
    const selectedRooms = packageRooms();
    if (!query.has('room') && selectedRooms.length === 1 && has(rooms, selectedRooms[0])) ui.room.val(selectedRooms[0]);
    filterSeats();
    renderPackagePicker(window.PixelCart?.getSnapshot());
  }
  if (query.get('mode') === 'hourly') ui.mode.val('hourly');
  refreshConstraints();
  renderEstimate();
  saveDraft();
  const hasEntry = ['room', 'seat', 'game', 'mode', 'guests', 'duration'].some(key => query.has(key)) || !!window.location.hash;
  clearEntryQuery();
  editing();
  $(window).on('pixel:cartchange', () => {
    updateCart();
    if (!layout.prop("hidden")) {
      reviewed = false;
      reviewActions.prop("hidden", true);
      ui['mobile-next'].prop("hidden", false);
    }
  });
  try {
    const record = JSON.parse(localStorage.getItem(confirmationKey));
    if ((record?.kind === 'demo' || record?.kind === 'request' && ['sent', 'test'].includes(record.receipt?.status) && (/^[A-F0-9]{8}$/).test(record.receipt?.reference)) && typeof record.summary === 'string' && has(rooms, record.plan?.room) && validDate(record.plan.date) && validTime(record.plan.time) && integer(Number(record.plan.guests), 1, rooms[record.plan.room].capacity)) {
      savedRecord = record;
      preparedPlan = record.plan;
      if (!hasEntry && JSON.stringify(record.plan) === JSON.stringify(collectPlan())) showConfirmation(record); else showSaved.prop("hidden", false);
    }
  } catch {}
  const meaningfulDraft = restored.draft && (restored.draft.date || restored.draft.time || restored.draft.seat || restored.draft.game || restored.draft.room !== 'standard' || Number(restored.draft.guests) !== 1 || Number(restored.draft.duration) !== 2 || restored.draft.mode === 'packages');
  announce([meaningfulDraft && !layout.prop("hidden") ? 'Черновик восстановлен.' : '', queryMessage].filter(Boolean).join(' '));
  ui['mobile-submit'].prop("disabled", false);
  ui.reset.prop("disabled", false);
  window.PixelBookingDelivery.ready.then(config => {
    deliveryAvailable = config.available;
    const state = $('#booking-delivery-state');
    state.text(config.mode === 'test' ? 'Тестовый режим: заявки не отправляются администратору; реальные места не бронируются.' : config.available ? '' : 'Онлайн-заявки пока недоступны. Для брони позвоните: +7 775 351 36 93.');
    state.prop("hidden", !state.text());
    ui.submit.prop("disabled", !deliveryAvailable);
    reviewSubmit.prop("disabled", !deliveryAvailable);
  });
});
