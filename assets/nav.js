// Mobile nav toggle. No framework, no build step.
(function () {
  var btn = document.getElementById('navToggle');
  var nav = document.getElementById('nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
})();

// Register page filters. Demo behaviour only, filters the rows already on the page.
(function () {
  var filters = document.querySelectorAll('.filter');
  var rows = document.querySelectorAll('.progrow');
  if (!filters.length || !rows.length) return;
  filters.forEach(function (f) {
    f.addEventListener('click', function () {
      filters.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      f.setAttribute('aria-pressed', 'true');
      var want = f.dataset.filter;
      rows.forEach(function (r) {
        r.style.display = (want === 'all' || r.dataset.kind === want) ? '' : 'none';
      });
    });
  });
})();
