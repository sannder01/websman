'use strict';
// Keep legacy bookmarks working without executable code inside HTML.
(() => {
  const target = location.pathname.endsWith('/cart.html') ? 'booking.html?mode=packages#packages' : 'rooms.html';
  location.replace(target);
})();