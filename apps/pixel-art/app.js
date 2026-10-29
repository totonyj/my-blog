import {
  GRID_SIZE, createGrid, setCell, lineCells, floodFill, isEmpty,
  gridToRgba, serialize, deserialize,
} from './pixel.js';

const CELL_PX = 32;
const MAX_UNDO = 50;
const GRID_KEY = 'pixel-art:grid';
const COLOR_KEY = 'pixel-art:color';
const HEX_RE = /^#[0-9a-f]{6}$/;

const PALETTE = [
  ['검정', '#000000'], ['진회색', '#555555'], ['회색', '#aaaaaa'], ['흰색', '#ffffff'],
  ['빨강', '#e53935'], ['주황', '#fb8c00'], ['노랑', '#fdd835'], ['연두', '#9ccc3c'],
  ['초록', '#2e9e4f'], ['청록', '#14b8a6'], ['하늘', '#4fc3f7'], ['파랑', '#2f6fed'],
  ['보라', '#8e44ad'], ['분홍', '#f48fb1'], ['갈색', '#795548'], ['살색', '#f5c9a0'],
];

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const statusEl = $('status');
const undoBtn = $('undo');
const gridBtn = $('grid-toggle');
const paletteEl = $('palette');
const customInput = $('custom-color');
const toolBtns = Array.from(document.querySelectorAll('.tool-btn'));

canvas.width = GRID_SIZE * CELL_PX;
canvas.height = GRID_SIZE * CELL_PX;

// ---- localStorage (모든 접근은 try/catch) ----
function storeGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storeSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* 저장 실패해도 계속 */ }
}

// ---- 상태 ----
let grid = deserialize(storeGet(GRID_KEY)) || createGrid();
let color = HEX_RE.test(storeGet(COLOR_KEY) || '') ? storeGet(COLOR_KEY) : PALETTE[0][1];
let tool = 'pencil';
let showGrid = true;
let undoStack = [];

// 드래그 상태
let drawing = false;
let activePointer = null;
let strokeBefore = null;
let lastCell = null;

// ---- 안내 ----
let statusTimer = null;
function say(msg) {
  statusEl.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 3000);
}

// ---- 렌더링 ----
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const c = grid[y * GRID_SIZE + x];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
    }
  }
  if (showGrid) {
    const line = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
    ctx.strokeStyle = line || 'rgba(128,128,128,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID_SIZE; i++) {
      const p = i * CELL_PX + 0.5;
      ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height);
      ctx.moveTo(0, p); ctx.lineTo(canvas.width, p);
    }
    ctx.stroke();
  }
}

function renderUi() {
  undoBtn.disabled = undoStack.length === 0;
  gridBtn.setAttribute('aria-pressed', String(showGrid));
  for (const b of toolBtns) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  for (const b of paletteEl.children) b.setAttribute('aria-pressed', String(b.dataset.color === color));
  customInput.value = color;
  // 팔레트에 없는 색(직접 고른 색)이면 색 선택기에 선택 표시를 한다
  const inPalette = [...paletteEl.children].some((b) => b.dataset.color === color);
  customInput.dataset.active = String(!inPalette);
}

function persistGrid() { storeSet(GRID_KEY, serialize(grid)); }

// ---- 기록 ----
function pushUndo(before) {
  undoStack.push(before);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function undo() {
  if (drawing || undoStack.length === 0) return;
  grid = undoStack.pop();
  render();
  renderUi();
  persistGrid();
  say('되돌렸습니다.');
}

// ---- 좌표 ----
function cellAt(e) {
  const rect = canvas.getBoundingClientRect();
  const fx = (e.clientX - rect.left) / rect.width;
  const fy = (e.clientY - rect.top) / rect.height;
  if (fx < 0 || fy < 0 || fx >= 1 || fy >= 1) return null;
  return [Math.floor(fx * GRID_SIZE), Math.floor(fy * GRID_SIZE)];
}

function paintColor() { return tool === 'eraser' ? null : color; }

// ---- 포인터 ----
canvas.addEventListener('pointerdown', (e) => {
  if (drawing) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const cell = cellAt(e);
  if (!cell) return;
  e.preventDefault();
  drawing = true;
  activePointer = e.pointerId;
  strokeBefore = grid;
  lastCell = cell;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  if (tool === 'fill') {
    grid = floodFill(grid, cell[0], cell[1], color);
  } else {
    grid = setCell(grid, cell[0], cell[1], paintColor());
  }
  render();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing || e.pointerId !== activePointer || tool === 'fill') return;
  const cell = cellAt(e);
  if (!cell) { lastCell = null; return; }
  const from = lastCell || cell;
  const c = paintColor();
  let next = grid;
  for (const [x, y] of lineCells(from[0], from[1], cell[0], cell[1])) {
    next = setCell(next, x, y, c);
  }
  lastCell = cell;
  if (next !== grid) {
    grid = next;
    render();
  }
});

function endStroke(e) {
  if (!drawing || e.pointerId !== activePointer) return;
  drawing = false;
  activePointer = null;
  lastCell = null;
  try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  const changed = grid !== strokeBefore && serialize(grid) !== serialize(strokeBefore);
  if (changed) {
    pushUndo(strokeBefore);
    persistGrid();
  } else {
    grid = strokeBefore;
  }
  strokeBefore = null;
  renderUi();
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
// pointerup/pointercancel이 오지 않는 경우(캡처 상실, 창 포커스 이탈)에도 그리기 상태가 남지 않게 정리한다
canvas.addEventListener('lostpointercapture', endStroke);
window.addEventListener('blur', () => { if (drawing) endStroke({ pointerId: activePointer }); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- 도구 / 색 ----
for (const b of toolBtns) {
  b.addEventListener('click', () => { tool = b.dataset.tool; renderUi(); });
}

function setColor(c) {
  color = c;
  storeSet(COLOR_KEY, color);
  if (tool === 'eraser') tool = 'pencil';
  renderUi();
}

for (const [name, hex] of PALETTE) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.dataset.color = hex;
  b.style.backgroundColor = hex;
  b.setAttribute('aria-label', name + ' ' + hex);
  b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => setColor(hex));
  paletteEl.appendChild(b);
}

customInput.addEventListener('input', () => {
  const v = customInput.value.toLowerCase();
  if (HEX_RE.test(v)) setColor(v);
});

// ---- 버튼 ----
undoBtn.addEventListener('click', undo);

$('clear').addEventListener('click', () => {
  if (isEmpty(grid)) { say('이미 비어 있습니다.'); return; }
  if (!confirm('그림을 모두 지울까요?')) return;
  pushUndo(grid);
  grid = createGrid();
  render();
  renderUi();
  persistGrid();
  say('모두 지웠습니다.');
});

gridBtn.addEventListener('click', () => {
  showGrid = !showGrid;
  render();
  renderUi();
});

$('save').addEventListener('click', () => {
  const off = document.createElement('canvas');
  off.width = GRID_SIZE;
  off.height = GRID_SIZE;
  const octx = off.getContext('2d');
  octx.putImageData(new ImageData(gridToRgba(grid), GRID_SIZE, GRID_SIZE), 0, 0);
  off.toBlob((blob) => {
    if (!blob) { say('저장하지 못했습니다.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pixel-art.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say('pixel-art.png를 저장했습니다.');
  }, 'image/png');
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  }
});

// ---- 테마 변경 시 격자선 색 다시 읽기 ----
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', render);
}

render();
renderUi();
