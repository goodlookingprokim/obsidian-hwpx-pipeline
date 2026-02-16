import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

const repoRoot = process.cwd();
const pagesDir = path.join(repoRoot, 'docs', 'pages');
const REPO_URL = 'https://github.com/goodlookingprokim/obsidian-hwpx-pipeline';

const docs = [
  {
    src: 'README.md',
    out: 'readme.html',
    title: 'README',
    audience: '공통',
    summary: '프로젝트 개요와 전체 문서 허브',
  },
  {
    src: 'Showcase.md',
    out: 'showcase.html',
    title: 'Showcase',
    audience: '사용자/교육',
    summary: '강의 시연 진행안과 데모 시나리오',
  },
  {
    src: 'UserGuide.md',
    out: 'user-guide.html',
    title: 'User Guide',
    audience: '사용자',
    summary: '일상 사용자를 위한 단계별 매뉴얼',
  },
  {
    src: 'Install.md',
    out: 'install.html',
    title: 'Install',
    audience: '사용자',
    summary: 'GitHub/BRAT/수동 설치와 업데이트',
  },
  {
    src: 'TroubleShooting.md',
    out: 'troubleshooting.html',
    title: 'Trouble Shooting',
    audience: '사용자/운영',
    summary: '설치, 사용, 배포 중 오류 해결 가이드',
  },
  {
    src: 'Project.md',
    out: 'project.html',
    title: 'Project',
    audience: '개발/기획',
    summary: '유사 프로젝트 설계 및 추진 프레임워크',
  },
  {
    src: 'Developer.md',
    out: 'developer-manual.html',
    title: 'Developer Manual',
    audience: '개발자',
    summary: '개발, 테스트, 릴리스, 유지보수 실무 지침',
  },
  {
    src: 'DocumentationPlan.md',
    out: 'documentation-plan.html',
    title: 'Documentation Plan',
    audience: '개발/운영',
    summary: '문서 체계 운영 계획과 점검 항목',
  },
  {
    src: 'CHANGELOG.md',
    out: 'changelog.html',
    title: 'Changelog',
    audience: '공통',
    summary: '버전별 변경 사항과 보안 업데이트',
  },
];

marked.setOptions({
  gfm: true,
  breaks: false,
});

await ensureDir(pagesDir);
await clearGeneratedHtml(pagesDir);

for (const item of docs) {
  const markdownPath = path.join(repoRoot, item.src);
  const markdown = await readFile(markdownPath, 'utf8');
  const htmlBody = marked.parse(markdown);
  const pageHtml = renderDocPage(item, htmlBody);

  await writeFile(path.join(pagesDir, item.out), pageHtml, 'utf8');
}

console.log(`Generated ${docs.length} pages in docs/pages`);

function renderDocPage(meta, htmlBody) {
  const sourceUrl = `${REPO_URL}/blob/main/${encodePathForUrl(meta.src)}`;
  const generatedPageUrl = `${REPO_URL}/blob/main/docs/pages/${encodePathForUrl(meta.out)}`;
  const scriptUrl = `${REPO_URL}/blob/main/scripts/build-doc-pages.mjs`;

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(meta.title)} | HWPX Pipeline Docs</title>
  <meta name="description" content="${escapeHtml(meta.summary)}" />
  <link rel="stylesheet" href="../assets/styles.css" />
  <script defer src="../assets/app.js"></script>
</head>
<body>
  <div class="page">
    <header class="topbar">
      <a class="logo" href="../index.html">
        <span class="logo-chip">HWPX</span>
        <span class="logo-text">PIPELINE DOCS</span>
      </a>
      <nav class="nav" aria-label="상단 탐색">
        <a data-nav href="../index.html">HOME</a>
        <a data-nav href="../user.html">USER</a>
        <a data-nav href="../developer.html">DEVELOPER</a>
      </nav>
      <button class="theme-btn" id="themeToggle" type="button">DARK MODE</button>
    </header>

    <section class="doc-wrap">
      <div class="doc-meta">
        <span class="badge">SOURCE: ${escapeHtml(meta.src)}</span>
        <span class="badge">AUDIENCE: ${escapeHtml(meta.audience)}</span>
      </div>
      <p class="kicker">${escapeHtml(meta.summary)}</p>
      <article class="doc-content">
        ${htmlBody}
      </article>
      <div class="source-box">
        <p class="kicker">SOURCE LINKS</p>
        <div class="url-list">
          <a class="url-link" href="${escapeHtml(REPO_URL)}" target="_blank" rel="noreferrer">${escapeHtml(REPO_URL)}</a>
          <a class="url-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceUrl)}</a>
          <a class="url-link" href="${escapeHtml(generatedPageUrl)}" target="_blank" rel="noreferrer">${escapeHtml(generatedPageUrl)}</a>
          <a class="url-link" href="${escapeHtml(scriptUrl)}" target="_blank" rel="noreferrer">${escapeHtml(scriptUrl)}</a>
        </div>
      </div>
      <div class="action-row">
        <a class="btn" href="../index.html">메인으로</a>
        <a class="btn alt" href="../user.html">사용자 페이지</a>
        <a class="btn alt" href="../developer.html">개발자 페이지</a>
      </div>
    </section>

    <footer class="footer">
      <span>Built from ${escapeHtml(meta.src)}</span>
      <span>HWPX Pipeline Documentation</span>
    </footer>
  </div>
</body>
</html>`;
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function clearGeneratedHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
      .map((entry) => rm(path.join(dir, entry.name))),
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function encodePathForUrl(filePath) {
  return filePath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}
