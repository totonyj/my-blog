// posts/*.md → dist/ 정적 사이트 생성
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { escapeHtml, parseFrontMatter, renderMarkdown } from './markdown.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS = path.join(ROOT, 'posts');
const SRC = path.join(ROOT, 'src');
const APPS = path.join(ROOT, 'apps');
const DIST = path.join(ROOT, 'dist');
const SITE_NAME = 'My Blog';

const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');

const formatDate = (d) => {
  const [y, m, day] = String(d).split('-');
  return y && m && day ? `${y}년 ${Number(m)}월 ${Number(day)}일` : String(d);
};

// 한글은 분당 약 500자 기준
const readingMinutes = (text) => Math.max(1, Math.round(text.replace(/\s/g, '').length / 500));

const tagList = (tags = []) =>
  tags.length
    ? `<ul class="tags">${tags.map((t) => `<li class="tag">${escapeHtml(t)}</li>`).join('')}</ul>`
    : '';

async function loadPosts() {
  const files = (await readdir(POSTS)).filter((f) => f.endsWith('.md'));
  const posts = [];
  for (const file of files) {
    const raw = await readFile(path.join(POSTS, file), 'utf8');
    const { data, body } = parseFrontMatter(raw);
    const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    posts.push({
      slug,
      title: data.title || slug,
      date: data.date || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      description: data.description || '',
      minutes: readingMinutes(body),
      html: renderMarkdown(body),
    });
  }
  return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// apps/*/index.html 의 <title>과 <meta name="description">을 홈 목록에 쓴다 (우리 파일이라 이스케이프된 상태 그대로 사용)
async function loadApps() {
  let dirs;
  try {
    dirs = (await readdir(APPS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch {
    return [];
  }
  const apps = [];
  for (const dir of dirs) {
    let html;
    try {
      html = await readFile(path.join(APPS, dir, 'index.html'), 'utf8');
    } catch {
      continue;
    }
    apps.push({
      dir,
      title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim() || dir,
      description: (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '',
    });
  }
  return apps;
}

function appsContent(apps) {
  if (!apps.length) return '';
  // 미리보기는 실제 앱 페이지를 축소해서 보여 주는 iframe. inert로 클릭·포커스를 막아 카드 링크만 동작하게 한다
  const cards = apps.map((a) => `
        <li class="app-card">
          <a class="app-card-link" href="apps/${a.dir}/index.html">
            <div class="app-preview" aria-hidden="true" inert>
              <iframe src="apps/${a.dir}/index.html" title="" tabindex="-1" loading="lazy" scrolling="no"></iframe>
            </div>
            <div class="app-info">
              <span class="app-badge">웹앱</span>
              <h3>${a.title}</h3>
              ${a.description ? `<p>${a.description}</p>` : ''}
            </div>
          </a>
        </li>`).join('');
  return `\n    <section class="apps">\n      <h2 class="page-title">웹앱</h2>\n      <ul class="app-grid">${cards}\n      </ul>\n    </section>`;
}

function indexContent(posts, apps) {
  const items = posts.map((p) => `
      <li class="post-item">
        <h2><a href="posts/${p.slug}/index.html">${escapeHtml(p.title)}</a></h2>
        <div class="meta"><time datetime="${escapeHtml(p.date)}">${formatDate(p.date)}</time><span>${p.minutes}분 읽기</span></div>
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
      </li>`).join('');
  return `    <h1 class="page-title">글 목록</h1>\n    <ul class="post-list">${items}\n    </ul>${appsContent(apps)}`;
}

function postContent(p, newer, older) {
  const link = (post, cls, label) =>
    post ? `<a class="${cls}" href="../${post.slug}/index.html"><small>${label}</small>${escapeHtml(post.title)}</a>` : '';
  return `    <article>
      <header class="post-header">
        <h1 class="post-title">${escapeHtml(p.title)}</h1>
        <div class="meta"><time datetime="${escapeHtml(p.date)}">${formatDate(p.date)}</time><span>${p.minutes}분 읽기</span></div>
        ${tagList(p.tags)}
      </header>
      <div class="prose">
${p.html}
      </div>
    </article>
    <nav class="post-nav" aria-label="이전·다음 글">
      ${link(older, 'prev', '← 이전 글')}
      ${link(newer, 'next', '다음 글 →')}
    </nav>`;
}

async function main() {
  const layout = await readFile(path.join(SRC, 'templates', 'layout.html'), 'utf8');
  const posts = await loadPosts();
  const apps = await loadApps();
  const year = new Date().getFullYear();
  const base = { siteName: SITE_NAME, year };

  // dist 폴더 자체는 유지하고 내용만 비운다 (로컬 서버가 폴더를 잡고 있으면 Windows에서 삭제가 실패함)
  await mkdir(DIST, { recursive: true });
  for (const name of await readdir(DIST)) {
    await rm(path.join(DIST, name), { recursive: true, force: true });
  }
  await cp(path.join(SRC, 'css'), path.join(DIST, 'css'), { recursive: true });
  await cp(path.join(SRC, 'js'), path.join(DIST, 'js'), { recursive: true });
  if (apps.length) await cp(APPS, path.join(DIST, 'apps'), { recursive: true });

  await writeFile(
    path.join(DIST, 'index.html'),
    fill(layout, { ...base, root: './', title: SITE_NAME, description: `${SITE_NAME} 글 목록`, content: indexContent(posts, apps) })
  );

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const dir = path.join(DIST, 'posts', p.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'index.html'),
      fill(layout, {
        ...base,
        root: '../../',
        title: `${escapeHtml(p.title)} · ${SITE_NAME}`,
        description: escapeHtml(p.description),
        content: postContent(p, posts[i - 1], posts[i + 1]),
      })
    );
  }

  console.log(`빌드 완료: 글 ${posts.length}개, 앱 ${apps.length}개 → ${path.relative(ROOT, DIST)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
