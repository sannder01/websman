'use strict';
(() => {
  const M = window.PixelMain;
  const prices = document.getElementById('prices');
  if (!M || !prices) return;

  // Read the published equipment and prices so the comparison matches the page.
  const rooms = [...prices.querySelectorAll('.room-row')].map(article => {
    const specs = [...article.querySelectorAll('.equipment-details dl > div')].map(row => ({
      label: row.querySelector('dt').textContent.trim(),
      value: row.querySelector('dd').textContent.trim()
    }));
    return {
      id: article.id,
      name: article.querySelector('h2').textContent.trim(),
      capacity: Number.parseInt(article.querySelector('.room-specs dd').textContent, 10),
      hourly: Number(article.querySelector('.room-rate').firstChild.textContent.replace(/\D/g, '')),
      specs,
      article
    };
  });
  const selected = new Set();
  const buttons = new Map();
  const section = M.node('section', '', 'container py-4 border-top');
  section.id = 'room-comparison';
  section.setAttribute('aria-labelledby', 'comparison-title');
  const title = M.node('h2', 'Сравнить залы', 'h2 mb-3');
  title.id = 'comparison-title';
  const introduction = M.node('p', 'Добавьте залы в сравнение: увидите оборудование, вместимость и почасовую стоимость для вашей компании.', 'text-body-secondary');
  const form = M.node('form');
  form.noValidate = true;
  const fields = M.node('div', '', 'row g-3 align-items-end');

  function createField(id, label, value, maximum, errorText) {
    const wrap = M.node('div', '', 'col-12 col-md-4');
    const caption = M.node('label', label, 'form-label');
    caption.htmlFor = id;
    const input = M.node('input', '', 'form-control');
    Object.assign(input, {id, type: 'number', min: '1', max: String(maximum), step: '1', value: String(value), required: true});
    const error = M.node('p', '', 'invalid-feedback');
    error.id = `${id}-error`;
    input.setAttribute('aria-describedby', error.id);
    wrap.append(caption, input, error);
    fields.append(wrap);
    return {input, error, maximum, errorText};
  }

  const guests = createField('comparison-guests', 'Игроки / ПК', 2, 20, 'Введите целое число игроков от 1 до 20.');
  const duration = createField('comparison-duration', 'Длительность, часов', 2, 12, 'Введите целое число часов от 1 до 12.');
  const actions = M.node('div', '', 'col-12 col-md-4 d-flex flex-wrap gap-2');
  const calculate = M.node('button', 'Пересчитать', 'btn btn-primary');
  calculate.type = 'submit';
  const clear = M.node('button', 'Очистить сравнение', 'btn btn-outline-light');
  clear.id = 'comparison-clear';
  clear.type = 'button';
  actions.append(calculate, clear);
  fields.append(actions);
  form.append(fields);
  const status = M.node('p', '', 'small text-body-secondary mt-3');
  status.id = 'comparison-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const results = M.node('div', '', 'row g-3');
  results.id = 'comparison-results';
  const note = M.node('p', 'Сравниваем почасовой тариф без пакетов и скидок. Это предварительный расчёт: наличие мест и итоговые условия подтвердит администратор.', 'small text-body-secondary mt-3 mb-0');
  section.append(title, introduction, form, status, results, note);
  prices.before(section);

  function validNumber(field) {
    const value = Number(field.input.value);
    return field.input.value.trim() !== '' && Number.isInteger(value) && value >= 1 && value <= field.maximum;
  }

  function validateFields() {
    let firstInvalid = null;
    for (const field of [guests, duration]) {
      const valid = validNumber(field);
      field.input.classList.toggle('is-invalid', !valid);
      field.input.setAttribute('aria-invalid', String(!valid));
      field.error.textContent = valid ? '' : field.errorText;
      if (!valid && !firstInvalid) firstInvalid = field.input;
    }
    return firstInvalid;
  }

  function estimate(room, players, hours) {
    return players <= room.capacity ? room.hourly * players * hours : null;
  }

  function renderCard(room, players, hours, cheapest, valid) {
    const column = M.node('div', '', 'col-12 col-lg-4');
    const card = M.node('article', '', 'card pixel-device-card h-100 p-3');
    card.dataset.comparisonRoom = room.id;
    const heading = M.node('h3', room.name, 'h3');
    const list = M.node('dl', '', 'mb-3');
    const details = [
      {label: 'Игровых мест', value: String(room.capacity)},
      {label: 'За один ПК в час', value: M.money(room.hourly)},
      ...room.specs
    ];
    for (const item of details) {
      list.append(M.node('dt', item.label, 'small text-body-secondary fw-normal'), M.node('dd', item.value));
    }
    const total = valid ? estimate(room, players, hours) : null;
    const amount = M.node('p', '', 'fw-bold');
    amount.dataset.comparisonTotal = room.id;
    const feedback = M.node('p', '', 'small text-body-secondary');
    if (!valid) {
      amount.textContent = 'Проверьте параметры расчёта';
    } else if (total === null) {
      amount.textContent = `Для ${players} игроков не подходит`;
      feedback.textContent = `В зале ${room.capacity} мест. Уменьшите число игроков или выберите другой зал.`;
    } else {
      amount.textContent = `Вся компания: ${M.money(total)}`;
      feedback.textContent = `${M.money(room.hourly)} × ${players} ПК × ${hours} ч. `;
      feedback.textContent += total === cheapest ? 'Самая низкая цена среди подходящих выбранных залов.' : `На ${M.money(total - cheapest)} дороже самого доступного выбранного зала.`;
    }
    const choose = M.node('a', 'Перейти к плану визита', 'btn btn-primary mt-auto');
    if (valid && total !== null) {
      const query = new URLSearchParams({room: room.id, mode: 'hourly', guests: String(players), duration: String(hours)});
      choose.href = `booking.html?${query}`;
    } else {
      choose.classList.add('disabled');
      choose.setAttribute('aria-disabled', 'true');
    }
    const remove = M.node('button', 'Убрать из сравнения', 'btn btn-outline-light mt-2');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Убрать ${room.name} из сравнения`);
    remove.addEventListener('click', () => toggleRoom(room.id, true));
    card.append(heading, list, amount, feedback, choose, remove);
    column.append(card);
    return column;
  }

  function renderComparison(message = '') {
    const valid = validNumber(guests) && validNumber(duration);
    const players = Number(guests.input.value);
    const hours = Number(duration.input.value);
    const chosen = rooms.filter(room => selected.has(room.id));
    const totals = valid ? chosen.map(room => estimate(room, players, hours)).filter(total => total !== null) : [];
    const cheapest = totals.length ? Math.min(...totals) : null;
    results.replaceChildren(...chosen.map(room => renderCard(room, players, hours, cheapest, valid)));
    if (chosen.length === 0) {
      results.append(M.node('p', 'Сравнение пока пусто. Нажмите «В сравнение» под ценой нужного зала ниже.', 'col-12 text-body-secondary'));
    }
    clear.disabled = chosen.length === 0;
    let feedback = `Выбрано залов: ${chosen.length} из ${rooms.length}.`;
    if (chosen.length === 1) feedback += ' Добавьте ещё один зал для сравнения.';
    if (chosen.length && !valid) feedback += ' Исправьте число игроков и длительность.';
    else if (chosen.length && totals.length === 0) feedback += ' Ни один из выбранных залов не вмещает вашу компанию.';
    status.textContent = `${message} ${feedback}`.trim();
    return chosen.length;
  }

  function toggleRoom(id, restoreFocus = false) {
    const room = rooms.find(item => item.id === id);
    if (!room) return;
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    const active = selected.has(id);
    const button = buttons.get(id);
    button.textContent = active ? 'Убрать из сравнения' : 'В сравнение';
    button.classList.toggle('btn-primary', active);
    button.classList.toggle('btn-outline-light', !active);
    button.setAttribute('aria-pressed', String(active));
    renderComparison(`${room.name} ${active ? 'добавлен в сравнение.' : 'убран из сравнения.'}`);
    if (restoreFocus) button.focus();
  }

  for (const room of rooms) {
    const button = M.node('button', 'В сравнение', 'btn btn-outline-light');
    button.type = 'button';
    button.dataset.compareRoom = room.id;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-controls', results.id);
    button.setAttribute('aria-label', `Сравнить зал ${room.name}`);
    button.addEventListener('click', () => toggleRoom(room.id));
    room.article.querySelector('.room-choose').append(button);
    buttons.set(room.id, button);
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const invalid = validateFields();
    renderComparison(invalid ? 'Не удалось рассчитать: проверьте поля.' : 'Стоимость обновлена.');
    invalid?.focus();
  });
  for (const field of [guests, duration]) {
    field.input.addEventListener('input', () => { validateFields(); renderComparison(); });
  }
  clear.addEventListener('click', () => {
    for (const id of [...selected]) toggleRoom(id);
    renderComparison('Сравнение очищено.');
    buttons.get(rooms[0].id)?.focus();
  });
  renderComparison();
})();
