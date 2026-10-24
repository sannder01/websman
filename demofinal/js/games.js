'use strict';
(() => {
  const M = window.PixelMain;
  const search = document.getElementById('games-search');
  if (!search) return;
  const category = document.getElementById('games-category');
  const tools = document.getElementById('games-tools');
  const results = document.getElementById('games-results');
  const empty = document.getElementById('games-empty');
  const games = document.getElementById('games-list');
  const apps = document.getElementById('apps-list');
  const catalog = [...document.querySelectorAll('#games-list > [data-game-id], #apps-list > [data-game-id]')].map(element => ({
    id: element.dataset.gameId,
    name: element.querySelector('h2').textContent,
    category: element.dataset.gameCategory,
    aliases: element.dataset.gameSearch,
    genre: element.querySelector('article > p').textContent,
    template: element.cloneNode(true)
  }));
  const storageKey = 'pixel-favorite-games-v1';
  const knownIds = new Set(catalog.map(item => item.id));
  let storageAvailable = true;
  let storageWarning = '';
  let favorites = readFavorites();

  // Add the new controls to the existing filter panel using its Bootstrap classes.
  const favoriteTools = M.node('div', '', 'd-flex flex-column flex-md-row flex-wrap gap-3 mt-3 align-items-md-center');
  const favoriteControl = M.node('div');
  const check = M.node('div', '', 'form-check');
  const favoriteOnly = M.node('input', '', 'form-check-input');
  favoriteOnly.id = 'games-favorites-only';
  favoriteOnly.type = 'checkbox';
  favoriteOnly.setAttribute('aria-controls', 'games-list apps-list');
  const favoriteLabel = M.node('label', 'Только избранное', 'form-check-label');
  favoriteLabel.htmlFor = favoriteOnly.id;
  check.append(favoriteOnly, favoriteLabel);
  favoriteControl.append(check);
  const favoriteCount = M.node('p', '', 'small text-body-secondary mb-0');
  favoriteCount.id = 'games-favorites-count';
  const clearControl = M.node('div');
  const clearFavorites = M.node('button', 'Очистить избранное', 'btn btn-outline-light');
  clearFavorites.id = 'games-favorites-clear';
  clearFavorites.type = 'button';
  clearControl.append(clearFavorites);
  favoriteTools.append(favoriteControl, favoriteCount, clearControl);
  const favoriteStatus = M.node('p', '', 'small text-body-secondary mt-3 mb-0');
  favoriteStatus.id = 'games-favorites-status';
  favoriteStatus.setAttribute('role', 'status');
  favoriteStatus.setAttribute('aria-live', 'polite');
  favoriteStatus.setAttribute('aria-atomic', 'true');
  tools.append(favoriteTools, favoriteStatus);

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
    favoriteStatus.textContent = [message, warning].filter(Boolean).join(' ');
  }
  function normalize(value) { return value.normalize('NFKC').toLocaleLowerCase('ru-RU').trim().replace(/\s+/g, ' '); }
  function matches(item, query, selectedCategory) {
    const words = normalize(query).split(' ').filter(Boolean);
    return (selectedCategory === 'all' || item.category === selectedCategory)
      && (!favoriteOnly.checked || favorites.has(item.id))
      && words.every(word => normalize(`${item.name} ${item.aliases}`).includes(word));
  }
  function renderCard(item) {
    // Reuse the original card structure, artwork and all existing classes.
    const card = item.template.cloneNode(true);
    const selected = favorites.has(item.id);
    const button = M.node('button', selected ? 'В избранном' : 'В избранное', 'btn btn-outline-light mb-3');
    button.type = 'button';
    button.dataset.favoriteId = item.id;
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${selected ? 'Убрать из избранного' : 'Добавить в избранное'}: ${item.name}`);
    button.addEventListener('click', () => {
      if (favorites.has(item.id)) favorites.delete(item.id);
      else favorites.add(item.id);
      saveFavorites();
      filter();
      announce(`${item.name} ${favorites.has(item.id) ? 'добавлена в избранное.' : 'убрана из избранного.'}`);
      // Filtering rebuilds cards. Keep keyboard focus on the new button or the filter.
      const nextButton = [...document.querySelectorAll('[data-favorite-id]')].find(node => node.dataset.favoriteId === item.id);
      (nextButton || document.querySelector('[data-favorite-id]') || favoriteOnly).focus();
    });
    const article = card.querySelector('article');
    article.insertBefore(button, article.querySelector('a'));
    return card;
  }
  function renderCards(parent, items) {
    parent.replaceChildren(...items.map(renderCard));
    return items.length;
  }
  function filter() {
    const filtered = catalog.filter(item => matches(item, search.value, category.value));
    const gameCount = renderCards(games, filtered.filter(item => item.category !== 'apps'));
    const appCount = renderCards(apps, filtered.filter(item => item.category === 'apps'));
    results.textContent = `Показано: ${filtered.length} из ${catalog.length}`;
    favoriteCount.textContent = `В избранном: ${favorites.size}`;
    clearFavorites.disabled = favorites.size === 0;
    const noFavorites = favoriteOnly.checked && favorites.size === 0;
    empty.querySelector('h2').textContent = noFavorites ? 'В избранном пока пусто' : favoriteOnly.checked ? 'В избранном ничего не найдено' : 'Ничего не найдено';
    empty.querySelector('p').textContent = noFavorites
      ? 'Покажите весь каталог и добавьте любимые игры кнопкой «В избранное».'
      : favoriteOnly.checked ? 'Среди избранных нет совпадений с поиском и жанром. Измените фильтры или покажите весь каталог.'
        : 'Попробуйте другое название или сбросьте поиск и жанр.';
    document.getElementById('games-empty-reset').textContent = favoriteOnly.checked ? 'Показать весь каталог' : 'Сбросить поиск и жанр';
    M.show(empty, filtered.length === 0);
    M.show(document.getElementById('games-heading'), gameCount > 0);
    M.show(games, gameCount > 0);
    M.show(document.getElementById('apps-section'), appCount > 0);
    return filtered.length;
  }
  function reset() {
    search.value = '';
    category.value = 'all';
    favoriteOnly.checked = false;
    filter();
    announce('Фильтры сброшены. Показан весь каталог, избранное сохранено.');
    search.focus();
  }
  search.addEventListener('input', filter);
  category.addEventListener('change', filter);
  favoriteOnly.addEventListener('change', filter);
  clearFavorites.addEventListener('click', () => {
    favorites.clear();
    saveFavorites();
    filter();
    announce('Избранное очищено.');
    favoriteOnly.focus();
  });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    favorites = readFavorites();
    filter();
    announce('Избранное обновлено в другой вкладке.');
  });
  document.getElementById('games-reset').addEventListener('click', reset);
  document.getElementById('games-empty-reset').addEventListener('click', reset);
  M.show(tools, true); M.show(results, true); filter();
  announce(storageWarning || !storageAvailable ? '' : 'Добавляйте любимые игры — список сохранится на этом устройстве.');
})();
