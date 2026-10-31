'use strict';
// jQuery 3.7.1 (full build): the preceding CDN script supplies $ and effects.
// $(function () {}) waits for the DOM; deferred script order loads jQuery first.
(() => {
  function node(tag, text = '', classes = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    for (const name of classes.split(' ').filter(Boolean)) element.classList.add(name);
    return element;
  }
  // Rewrite 2: .prop().toggleClass() replaces hidden and classList.toggle.
  // The chain is shorter and keeps both visibility flags together.
  function show(element, visible) {
    $(element).prop('hidden', !visible).toggleClass('d-none', !visible);
    return visible;
  }
  function money(amount) { return `${new Intl.NumberFormat('ru-RU').format(amount)} ₸`; }
  function reference() { return Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0').toUpperCase(); }
  window.PixelMain = Object.freeze({node, show, money, reference});
  $(function () {
    $('.visit-note .small').text('Составьте план визита. Для реального посещения администратор подтвердит места и условия по телефону.');
    $('.pixel-disclosure p').contents().filter(function () {
      return $(this).prop('nodeType') === 3;
    }).each(function () {
      $(this).prop('textContent', $(this).prop('textContent').replace('Кнопка «Отправить заявку»', 'Кнопка «Забронировать»'));
    });
    // Existing navigation keeps its appearance and describes the shared selection.
    const update = () => {
      const state = window.PixelCart?.getSnapshot();
      const $links = $('nav a[href="booking.html"]');
      if (state?.count) $links.attr('title', `Выбрано пакетов: ${state.count}, ${money(state.total)}`);
      else $links.removeAttr('title');
    };
    $(window).on('pixel:cartchange', update);
    window.PixelCart?.ready?.then(update);
    update();

    const duration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    // .html() is for this trusted, fixed emphasis markup; visitor input always uses .text().
    $('#help-packages > summary').html('<strong>Пакеты:</strong> что нужно уточнить?');
    $('.pixel-help-page .pixel-disclosure').each(function () {
      const $details = $(this);
      $details.data('expanded', $details.prop('open'));
      $details.children('summary').attr('aria-expanded', String($details.prop('open')));
    });
    $('.pixel-help-page').on('click', '.pixel-disclosure > summary', function (event) {
      // Without preventDefault, the native details toggle would race the animated toggle.
      event.preventDefault();
      const $summary = $(this);
      const $details = $summary.parent();
      const $answer = $summary.siblings();
      const expanded = !$details.data('expanded');
      // Finish any pending effect before starting the opposite action on rapid clicks.
      $answer.stop(true, true);
      $details.data('expanded', expanded).prop('open', true).toggleClass('active', expanded);
      $summary.attr('aria-expanded', String(expanded));
      if ($details.hasClass('active')) {
        $answer.hide().slideDown(duration());
      } else {
        $answer.slideUp(duration(), function () {
          // This callback runs only after closing; keep native keyboard/AT state in sync.
          $details.prop('open', false);
          $(this).show();
        });
      }
    });
  });
})();
