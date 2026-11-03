'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const list = document.querySelector('#games-list');
  const intro = document.querySelector('.pixel-games-page .pixel-price-intro');
  if (!list || !intro) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-outline-light';
  button.textContent = 'Случайная игра';

  const status = document.createElement('p');
  status.className = 'small text-body-secondary mt-2 mb-0';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  intro.append(button, status);

  button.addEventListener('click', () => {
    const games = [...list.querySelectorAll(':scope > li[data-game-id]')];
    if (list.hidden || games.length === 0) {
      status.textContent = 'По текущим фильтрам игр нет. Сбросьте поиск или жанр.';
      return;
    }

    const game = games[Math.floor(Math.random() * games.length)];
    const name = game.querySelector('h2')?.textContent?.trim() || 'Игра';
    game.scrollIntoView({ behavior: 'smooth', block: 'center' });
    game.querySelector('a.pixel-game-action')?.focus({ preventScroll: true });
    status.textContent = `Выбрана: ${name}.`;
  });
});
