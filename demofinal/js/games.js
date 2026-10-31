'use strict';
// Rewrite 1: .find(), .clone(), .append() and delegated .on() replace querySelector,
// cloneNode, append and per-button addEventListener. Rendering is shorter; storage logic is unchanged.
$(function () {
  const $search = $('#games-search');
  if (!$search.length) return;
  const $category = $('#games-category');
  const $tools = $('#games-tools');
  const $results = $('#games-results');
  const $empty = $('#games-empty');
  const $games = $('#games-list');
  const $apps = $('#apps-list');
  const catalog = [];
  $('#games-list > [data-game-id], #apps-list > [data-game-id]').each(function () {
    const $card = $(this);
    catalog.push({
      id: $card.attr('data-game-id'),
      name: $card.find('h2').text(),
      category: $card.attr('data-game-category'),
      aliases: $card.attr('data-game-search'),
      template: $card.clone()
    });
  });
  const storageKey = 'pixel-favorite-games-v1';
  const knownIds = new Set(catalog.map(item => item.id));
  let storageAvailable = true;
  let storageWarning = '';
  let favorites = readFavorites();

  // Only elements created in code are added; all appearance classes already exist in Bootstrap.
  const $favoriteTools = $('<div>').addClass('d-flex flex-column flex-md-row flex-wrap gap-3 mt-3 align-items-md-center');
  const $favoriteControl = $('<div>').appendTo($favoriteTools);
  const $check = $('<div>').addClass('form-check').appendTo($favoriteControl);
  const $favoriteOnly = $('<input>').addClass('form-check-input').attr({
    id: 'games-favorites-only', type: 'checkbox', 'aria-controls': 'games-list apps-list'
  }).appendTo($check);
  $('<label>').addClass('form-check-label').attr('for', 'games-favorites-only')
    .text('Только избранное').appendTo($check);
  const $favoriteCount = $('<p>').attr('id', 'games-favorites-count')
    .addClass('small text-body-secondary mb-0').appendTo($favoriteTools);
  const $clearControl = $('<div>').appendTo($favoriteTools);
  // addClass applies existing styles; attr sets button semantics; text inserts safe text; appendTo mounts it.
  const $clearFavorites = $('<button>').addClass('btn btn-outline-light')
    .attr({id: 'games-favorites-clear', type: 'button'}).text('Очистить избранное').appendTo($clearControl);
  const $favoriteStatus = $('<p>').addClass('small text-body-secondary mt-3 mb-0')
    .attr({id: 'games-favorites-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true'});
  const $savedList = $('<ul>').attr({'id': 'games-saved-list', 'aria-label': 'Сохранённые игры'})
    .addClass('list-unstyled d-flex flex-wrap gap-3 mt-3 mb-0');
  $tools.append($favoriteTools, $savedList, $favoriteStatus);

  function show($element, visible) {
    window.PixelMain.show($element, visible);
  }
  function readFavorites() {
    let saved;
    try {
      saved = localStorage.getItem(storageKey);
      storageAvailable = true;
      storageWarning = '';
    } catch {
      storageAvailable = false;
      return new Set();
    }
    if (saved === null) return new Set();
    try {
      const ids = JSON.parse(saved);
      if (!Array.isArray(ids)) throw new Error('Invalid favorite list');
      // Unknown, duplicate and non-string IDs never become catalog entries.
      return new Set(ids.filter(id => typeof id === 'string' && knownIds.has(id)));
    } catch {
      storageWarning = 'Сохранённый список не удалось прочитать. Можно собрать избранное заново.';
      return new Set();
    }
  }
  function saveFavorites() {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...favorites]));
      storageAvailable = true;
      storageWarning = '';
    } catch {
      // The feature remains usable in memory when browser storage is denied or full.
      storageAvailable = false;
    }
  }
  function announce(message) {
    const warning = storageAvailable ? storageWarning : 'Выбор работает в этой вкладке, но браузер не разрешил сохранить список.';
    $favoriteStatus.text([message, warning].filter(Boolean).join(' '));
  }
  function normalize(value) { return value.normalize('NFKC').toLocaleLowerCase('ru-RU').trim().replace(/\s+/g, ' '); }
  function matches(item, query, selectedCategory) {
    const words = normalize(query).split(' ').filter(Boolean);
    return (selectedCategory === 'all' || item.category === selectedCategory)
      && (!$favoriteOnly.prop('checked') || favorites.has(item.id))
      && words.every(word => normalize(`${item.name} ${item.aliases}`).includes(word));
  }
  function renderCard(item) {
    const $card = item.template.clone();
    const selected = favorites.has(item.id);
    const $button = $('<button>').addClass('btn mb-3')
      .toggleClass('btn-light', selected).toggleClass('btn-outline-light', !selected)
      .attr({type: 'button', 'data-favorite-id': item.id, 'aria-pressed': String(selected),
        'aria-label': `${selected ? 'Убрать из избранного' : 'Добавить в избранное'}: ${item.name}`})
      .text(selected ? 'В избранном' : 'В избранное');
    $card.find('article > a').before($button);
    return $card;
  }
  function renderCards($parent, items) {
    $parent.empty();
    items.forEach(item => $parent.append(renderCard(item)));
    return items.length;
  }
  function renderSavedList() {
    // This array-built list and its items exist only in code, never in the HTML files.
    const savedGames = catalog.filter(item => favorites.has(item.id));
    $savedList.empty();
    savedGames.forEach(item => {
      const $item = $('<li>').addClass('d-flex align-items-center gap-2');
      $('<a>').attr('href', `booking.html?game=${encodeURIComponent(item.id)}`)
        .addClass('small').text(item.name).appendTo($item);
      $('<button>').attr({type: 'button', 'data-remove-favorite': item.id,
        'aria-label': `Убрать из избранного: ${item.name}`})
        .addClass('btn btn-outline-light btn-sm').text('Убрать').appendTo($item);
      $savedList.append($item);
    });
    show($savedList, savedGames.length > 0);
  }
  function filter() {
    const filtered = catalog.filter(item => matches(item, $search.val(), $category.val()));
    const gameCount = renderCards($games, filtered.filter(item => item.category !== 'apps'));
    const appCount = renderCards($apps, filtered.filter(item => item.category === 'apps'));
    $results.text(`Показано: ${filtered.length} из ${catalog.length}`);
    $favoriteCount.text(`В избранном: ${favorites.size}`);
    $clearFavorites.prop('disabled', favorites.size === 0);
    const favoritesOnly = $favoriteOnly.is(':checked');
    const noFavorites = favoritesOnly && favorites.size === 0;
    $empty.find('h2').text(noFavorites ? 'В избранном пока пусто' : favoritesOnly ? 'В избранном ничего не найдено' : 'Ничего не найдено');
    $empty.find('p').text(noFavorites
      ? 'Покажите весь каталог и добавьте любимые игры кнопкой «В избранное».'
      : favoritesOnly ? 'Среди избранных нет совпадений с поиском и жанром. Измените фильтры или покажите весь каталог.'
        : 'Попробуйте другое название или сбросьте поиск и жанр.');
    $('#games-empty-reset').text(favoritesOnly ? 'Показать весь каталог' : 'Сбросить поиск и жанр');
    show($empty, filtered.length === 0);
    show($('#games-heading'), gameCount > 0);
    show($games, gameCount > 0);
    show($('#apps-section'), appCount > 0);
    renderSavedList();
    return filtered.length;
  }
  function reset() {
    $search.val('');
    $category.val('all');
    // .attr('checked') describes the initial HTML attribute; .prop('checked') changes the current checkbox state.
    $favoriteOnly.prop('checked', false);
    filter();
    announce('Фильтры сброшены. Показан весь каталог, избранное сохранено.');
    $search.trigger('focus');
  }
  // Cards are created after this binding and replaced after every filter. A direct .on()
  // on their buttons would miss new buttons; the existing parent receives bubbling clicks.
  $games.add($apps).on('click', '[data-favorite-id]', function () {
    const $button = $(this);
    const $article = $button.closest('article');
    const id = $article.parent('[data-game-id]').attr('data-game-id');
    const name = $article.find('h2').text();
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    saveFavorites();
    filter();
    announce(`${name} ${favorites.has(id) ? 'добавлена в избранное.' : 'убрана из избранного.'}`);
    // Filtering rebuilds cards. Keep keyboard focus on the new button or the filter.
    let $next = $('[data-favorite-id]').filter(function () { return $(this).attr('data-favorite-id') === id; }).first();
    if (!$next.length) $next = $('[data-favorite-id]').first();
    ($next.length ? $next : $favoriteOnly).trigger('focus');
  });
  $tools.on('click', '[data-remove-favorite]', function () {
    const $button = $(this);
    const id = $button.attr('data-remove-favorite');
    const name = $button.siblings('a').text();
    favorites.delete(id);
    saveFavorites();
    filter();
    announce(`${name} убрана из избранного.`);
    const $next = $savedList.find('button:first');
    ($next.length ? $next : $favoriteOnly).trigger('focus');
  });
  $search.on('input', filter);
  $category.add($favoriteOnly).on('change', filter);
  $clearFavorites.on('click', function () {
    if ($(this).prop('disabled')) return;
    favorites.clear();
    saveFavorites();
    filter();
    announce('Избранное очищено.');
    $favoriteOnly.trigger('focus');
  });
  $(window).on('storage', function (event) {
    const changedKey = event.originalEvent.key;
    if (changedKey !== storageKey && changedKey !== null) return;
    favorites = readFavorites();
    filter();
    announce('Избранное обновлено в другой вкладке.');
  });
  $('#games-reset, #games-empty-reset').on('click', reset);
  show($tools, true);
  show($results, true);
  filter();
  announce(storageWarning || !storageAvailable ? '' : 'Добавляйте любимые игры — список сохранится на этом устройстве.');
});
