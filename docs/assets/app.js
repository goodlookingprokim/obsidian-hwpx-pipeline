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

  function classifyExecutionType(text) {
    const lines = text
      .split('\n')
      .map(function (line) {
        return line.trim();
      })
      .filter(function (line) {
        return line.length > 0 && !line.startsWith('#');
      });

    if (lines.length <= 1) {
      return {
        type: 'single',
        label: '개별 실행',
        hint: '명령 1개를 실행합니다.',
      };
    }

    const hasShellOperators = lines.some(function (line) {
      return /&&|\|\||\|/.test(line);
    });

    const needsSequence = lines.some(function (line) {
      return (
        line.startsWith('cd ') ||
        line.startsWith('git clone ') ||
        line.startsWith('npm install') ||
        line.startsWith('pnpm install') ||
        line.startsWith('yarn install') ||
        line.startsWith('bun install') ||
        line.startsWith('mkdir ') ||
        line.startsWith('cp ') ||
        line.startsWith('mv ') ||
        line.startsWith('rm ') ||
        line.startsWith('./install.sh') ||
        line.startsWith('gh release create ')
      );
    });

    if (!hasShellOperators && !needsSequence) {
      return {
        type: 'parallel',
        label: '동시 실행 가능',
        hint: '줄 단위로 별도 터미널에서 실행할 수 있습니다.',
      };
    }

    return {
      type: 'single',
      label: '개별 실행',
      hint: '위에서 아래 순서로 실행합니다.',
    };
  }

  async function copyText(button, text) {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = '복사 완료';
      setTimeout(function () {
        button.textContent = '복사';
      }, 1400);
    } catch (error) {
      button.textContent = '복사 실패';
      setTimeout(function () {
        button.textContent = '복사';
      }, 1400);
    }
  }

  function isLikelyInlineCopyTarget(value) {
    const text = value.trim();
    if (text.length < 4 || text.length > 180) return false;
    if (/^https?:\/\//i.test(text)) return true;
    if (text.includes('→')) return true;
    if (/^\/|^[A-Za-z]:\\/.test(text)) return true;
    if (/plugins?|settings?|vault|release|beta/i.test(text)) return true;
    if (text.includes('/') || text.includes('-')) return true;
    return false;
  }

  function enhanceCodeSnippets() {
    const nodes = document.querySelectorAll('.doc-content pre > code');
    nodes.forEach(function (codeNode) {
      const pre = codeNode.parentElement;
      if (!pre || pre.dataset.enhanced === 'true') return;

      pre.dataset.enhanced = 'true';

      const rawText = codeNode.textContent || '';
      const execution = classifyExecutionType(rawText);
      const wrapper = document.createElement('div');
      wrapper.className = 'snippet';
      wrapper.dataset.execution = execution.type;

      const bar = document.createElement('div');
      bar.className = 'snippet-bar';

      const badge = document.createElement('span');
      badge.className = 'snippet-badge';
      badge.textContent = execution.label;

      const hint = document.createElement('span');
      hint.className = 'snippet-hint';
      hint.textContent = execution.hint;

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'snippet-copy';
      copyButton.textContent = '복사';
      copyButton.setAttribute('aria-label', '코드 스니펫 복사');
      copyButton.addEventListener('click', function () {
        copyText(copyButton, rawText);
      });

      bar.appendChild(badge);
      bar.appendChild(hint);
      bar.appendChild(copyButton);

      const parent = pre.parentElement;
      if (!parent) return;

      parent.insertBefore(wrapper, pre);
      wrapper.appendChild(bar);
      wrapper.appendChild(pre);
    });
  }

  function enhanceUrlCopyTargets() {
    const links = document.querySelectorAll('.url-link');
    links.forEach(function (link) {
      if (link.dataset.copyEnhanced === 'true') return;
      link.dataset.copyEnhanced = 'true';

      const wrapper = document.createElement('span');
      wrapper.className = 'url-copy-row';
      const parent = link.parentElement;
      if (!parent) return;

      parent.insertBefore(wrapper, link);
      wrapper.appendChild(link);

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'url-copy-btn';
      copyButton.textContent = '복사';
      copyButton.setAttribute('aria-label', 'URL 복사');
      copyButton.addEventListener('click', function () {
        const value = (link.getAttribute('href') || link.textContent || '').trim();
        copyText(copyButton, value);
      });

      wrapper.appendChild(copyButton);
    });
  }

  function enhanceInlineCopyTargets() {
    const nodes = document.querySelectorAll('.doc-content code');
    nodes.forEach(function (codeNode) {
      if (!(codeNode instanceof HTMLElement)) return;
      if (codeNode.closest('pre')) return;
      if (codeNode.dataset.copyEnhanced === 'true') return;

      const text = (codeNode.textContent || '').trim();
      if (!isLikelyInlineCopyTarget(text)) return;

      codeNode.dataset.copyEnhanced = 'true';
      const wrapper = document.createElement('span');
      wrapper.className = 'inline-copy';
      if (/^https?:\/\//i.test(text)) {
        wrapper.classList.add('is-url');
      }
      const parent = codeNode.parentElement;
      if (!parent) return;

      parent.insertBefore(wrapper, codeNode);
      wrapper.appendChild(codeNode);

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'inline-copy-btn';
      copyButton.textContent = '복사';
      copyButton.setAttribute('aria-label', '인라인 텍스트 복사');
      copyButton.addEventListener('click', function () {
        copyText(copyButton, text);
      });

      wrapper.appendChild(copyButton);
    });
  }

  function init() {
    applyTheme(preferredTheme());
    bindThemeToggle();
    highlightNav();
    enhanceCodeSnippets();
    enhanceInlineCopyTargets();
    enhanceUrlCopyTargets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
