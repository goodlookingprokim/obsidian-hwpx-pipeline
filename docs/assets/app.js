(function () {
  const STORAGE_KEY = 'hwpx_site_theme';

  function preferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE';
      btn.setAttribute('aria-label', theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
    }
  }

  function bindThemeToggle() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  function highlightNav() {
    const current = location.pathname.split('/').pop() || 'index.html';
    const links = document.querySelectorAll('[data-nav]');
    links.forEach(function (link) {
      const target = link.getAttribute('href');
      if (!target) return;

      if (target === current || (current === '' && target === 'index.html')) {
        link.classList.add('active');
      }
    });
  }

  function init() {
    applyTheme(preferredTheme());
    bindThemeToggle();
    highlightNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
