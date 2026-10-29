import { moveDetailed, spawnTile, newGame, isGameOver, maxTile, winTarget } from './game.js';

const SIZES = [3, 4, 5];
const DEFAULT_SIZE = 4;
const MOVE_MS = 100;
const SWIPE_MIN = 30;

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const cellsEl = $('cells');
const tilesEl = $('tiles');
const scoreEl = $('score');
const bestEl = $('best');
const gainEl = $('score-gain');
const overlayEl = $('overlay');
const overlayTitle = $('overlay-title');
const overlayDesc = $('overlay-desc');
const overlayPrimary = $('overlay-primary');
const overlaySecondary = $('overlay-secondary');
const sizeBtns = Array.from(document.querySelectorAll('.size-btn'));

// ---- localStorage (모든 접근은 try/catch) ----
function storeGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storeSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) { /* 저장 실패해도 게임은 계속 */ }
}
const bestKey = (size) => '2048:best:' + size;
function loadBest(size) {
  const n = parseInt(storeGet(bestKey(size)), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function loadSize() {
  const n = parseInt(storeGet('2048:size'), 10);
  return SIZES.includes(n) ? n : DEFAULT_SIZE;
}

// ---- 상태 ----
let size = loadSize();
let board = [];
let score = 0;
let best = 0;
let keepGoing = false;
let overlayMode = null; // 'win' | 'over' | null
let tileGrid = [];      // tileGrid[r][c] = 타일 객체 | null

// ---- 렌더링 ----
function buildCells() {
  cellsEl.textContent = '';
  for (let i = 0; i < size * size; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    cellsEl.appendChild(d);
  }
}

function applyTileClass(tile) {
  const v = tile.value;
  tile.el.className = 'tile v' + v + ' d' + String(v).length;
  tile.inner.textContent = String(v);
}

function placeTile(tile, r, c) {
  tile.r = r;
  tile.c = c;
  tile.el.style.setProperty('--r', r);
  tile.el.style.setProperty('--c', c);
}

function playAnim(tile, cls) {
  tile.el.classList.remove('is-new', 'is-merged');
  void tile.el.offsetWidth; // 애니메이션 재시작
  tile.el.classList.add(cls);
  tile.inner.addEventListener('animationend', () => tile.el.classList.remove(cls), { once: true });
}

function createTile(r, c, value, anim) {
  const el = document.createElement('div');
  const inner = document.createElement('div');
  inner.className = 'tile-inner';
  el.appendChild(inner);
  const tile = { el, inner, value, r, c };
  applyTileClass(tile);
  placeTile(tile, r, c);
  tilesEl.appendChild(el);
  if (anim) playAnim(tile, anim);
  return tile;
}

function setTileValue(tile, value) {
  tile.value = value;
  applyTileClass(tile);
}

function renderAll(animateNew) {
  tilesEl.textContent = '';
  tileGrid = board.map((row, r) => row.map((v, c) => (v ? createTile(r, c, v, animateNew ? 'is-new' : null) : null)));
  updateBoardLabel();
}

function updateBoardLabel() {
  boardEl.setAttribute('aria-label', size + '×' + size + ' 게임 보드, 가장 큰 타일 ' + maxTile(board));
}

function renderScore() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

function showGain(n) {
  if (!n) return;
  gainEl.textContent = '+' + n;
  gainEl.classList.remove('show');
  void gainEl.offsetWidth;
  gainEl.classList.add('show');
}

function renderSizeButtons() {
  for (const b of sizeBtns) {
    b.setAttribute('aria-pressed', String(Number(b.dataset.size) === size));
  }
}

// ---- 오버레이 ----
function showOverlay(mode) {
  overlayMode = mode;
  if (mode === 'win') {
    overlayTitle.textContent = '승리!';
    overlayDesc.textContent = winTarget(size) + ' 타일을 만들었습니다.';
    overlayPrimary.textContent = '계속하기';
    overlaySecondary.textContent = '새 게임';
    overlaySecondary.hidden = false;
  } else {
    overlayTitle.textContent = '게임 오버';
    overlayDesc.textContent = '더 이상 움직일 수 없습니다. 점수: ' + score;
    overlayPrimary.textContent = '다시 시작';
    overlaySecondary.hidden = true;
  }
  overlayEl.hidden = false;
  overlayPrimary.focus();
}

function hideOverlay() {
  overlayMode = null;
  overlayEl.hidden = true;
  boardEl.focus({ preventScroll: true });
}

// ---- 게임 흐름 ----
function startGame(newSize) {
  if (newSize !== undefined) {
    size = newSize;
    storeSet('2048:size', size);
  }
  board = newGame(size);
  score = 0;
  best = loadBest(size);
  keepGoing = false;
  overlayMode = null;
  overlayEl.hidden = true;
  boardEl.style.setProperty('--n', size);
  buildCells();
  renderSizeButtons();
  renderAll(true);
  renderScore();
}

function afterMove() {
  if (!keepGoing && maxTile(board) >= winTarget(size)) {
    showOverlay('win');
  } else if (isGameOver(board)) {
    showOverlay('over');
  }
}

function doMove(direction) {
  if (overlayMode) return;
  const res = moveDetailed(board, direction);
  if (!res.moved) return;

  // 타일 객체 이동/병합
  const nextGrid = Array.from({ length: size }, () => new Array(size).fill(null));
  const removed = [];
  for (const { from, to, merged } of res.trace) {
    const tile = tileGrid[from[0]][from[1]];
    if (!tile) continue;
    const existing = nextGrid[to[0]][to[1]];
    placeTile(tile, to[0], to[1]);
    if (existing && merged) {
      removed.push(tile);
      setTileValue(existing, existing.value * 2);
      playAnim(existing, 'is-merged');
    } else {
      nextGrid[to[0]][to[1]] = tile;
    }
  }
  for (const t of removed) {
    t.el.style.zIndex = '0';
    setTimeout(() => t.el.remove(), MOVE_MS + 20);
  }

  const spawned = spawnTile(res.board);
  board = spawned.board;
  if (spawned.pos) {
    const [r, c] = spawned.pos;
    nextGrid[r][c] = createTile(r, c, board[r][c], 'is-new');
  }
  tileGrid = nextGrid;

  score += res.gained;
  if (score > best) {
    best = score;
    storeSet(bestKey(size), best);
  }
  renderScore();
  showGain(res.gained);
  updateBoardLabel();
  afterMove();
}

// ---- 입력 ----
const KEY_DIR = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

document.addEventListener('keydown', (e) => {
  if (overlayMode && e.key === 'Tab') {
    // 오버레이 안에서 포커스 순환
    const items = [overlayPrimary, overlaySecondary].filter((b) => !b.hidden);
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    return;
  }
  const dir = KEY_DIR[e.key];
  if (!dir) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (overlayMode) return;
  e.preventDefault();
  doMove(dir);
});

let touchStart = null;
boardEl.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) { touchStart = null; return; }
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

boardEl.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
  if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left');
  else doMove(dy > 0 ? 'down' : 'up');
}, { passive: true });

boardEl.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

$('new-game').addEventListener('click', () => {
  startGame();
  boardEl.focus({ preventScroll: true });
});

for (const b of sizeBtns) {
  b.addEventListener('click', () => {
    const n = Number(b.dataset.size);
    if (n !== size) startGame(n);
  });
}

overlayPrimary.addEventListener('click', () => {
  if (overlayMode === 'win') {
    keepGoing = true;
    hideOverlay();
    if (isGameOver(board)) showOverlay('over');
  } else {
    startGame();
    boardEl.focus({ preventScroll: true });
  }
});

overlaySecondary.addEventListener('click', () => {
  startGame();
  boardEl.focus({ preventScroll: true });
});

startGame();
