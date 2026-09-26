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


// Contact Us dropdown: click to open, click outside or Escape to close.
(function () {
  var btn = document.getElementById('connectBtn');
  var menu = document.getElementById('connectMenu');
  if (!btn || !menu) return;

  function open() {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutside, true);
    document.addEventListener('keydown', onKey);
  }
  function close(refocus) {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutside, true);
    document.removeEventListener('keydown', onKey);
    if (refocus) btn.focus();
  }
  function onOutside(e) {
    if (!menu.contains(e.target) && e.target !== btn) close(false);
  }
  function onKey(e) {
    if (e.key === 'Escape') close(true);
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    menu.hidden ? open() : close(false);
  });
})();

/* Connect form — prototype only. Validates, then says plainly that it is not
   wired to anything yet rather than faking a success message. */
(function () {
  var form = document.getElementById('connectForm');
  if (!form) return;
  var note = document.getElementById('connectFormNote');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var missing = [];
    ['cf-name', 'cf-email', 'cf-message'].forEach(function (id) {
      var el = document.getElementById(id);
      var bad = !el.value.trim() || (el.type === 'email' && !el.checkValidity());
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad) missing.push(el);
    });

    if (missing.length) {
      note.innerHTML = 'Please fill in your name, a valid email and a message.';
      note.hidden = false;
      missing[0].focus();
      return;
    }

    var topic = document.getElementById('cf-topic').value;
    note.innerHTML = 'This is a prototype, so the form is not connected to an inbox yet. ' +
      'In the real build this would land in the tennis office inbox tagged &ldquo;' + topic + '&rdquo;. ' +
      'For now, email <a href="mailto:citytennisace@gmail.com">citytennisace@gmail.com</a>.';
    note.hidden = false;
    note.focus && note.focus();
  });
})();
