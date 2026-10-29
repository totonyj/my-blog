// 픽셀 아트 순수 로직 (DOM 사용 없음). 모든 함수는 입력을 변경하지 않는다.

export const GRID_SIZE = 16;

const HEX_RE = /^#[0-9a-f]{6}$/;

export function createGrid(size = GRID_SIZE) {
  return new Array(size * size).fill(null);
}

function inRange(x, y, size) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;
}

export function setCell(grid, x, y, color, size = GRID_SIZE) {
  if (!inRange(x, y, size)) return grid;
  const next = grid.slice();
  next[y * size + x] = color;
  return next;
}

// Bresenham 선: 시작·끝 칸 포함
export function lineCells(x0, y0, x1, y1) {
  const cells = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    cells.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return cells;
}

// 4방향 연결 영역 채우기
export function floodFill(grid, x, y, color, size = GRID_SIZE) {
  if (!inRange(x, y, size)) return grid;
  const target = grid[y * size + x];
  if (target === color) return grid;
  const next = grid.slice();
  const stack = [[x, y]];
  next[y * size + x] = color;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neighbors) {
      if (!inRange(nx, ny, size)) continue;
      const i = ny * size + nx;
      if (next[i] === target) {
        next[i] = color;
        stack.push([nx, ny]);
      }
    }
  }
  return next;
}

export function isEmpty(grid) {
  return grid.every((c) => c === null);
}

export function hexToRgba(hex) {
  if (hex === null) return [0, 0, 0, 0];
  const h = String(hex).replace(/^#/, '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    255,
  ];
}

export function gridToRgba(grid, size = GRID_SIZE) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b, a] = hexToRgba(grid[i]);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return data;
}

export function serialize(grid) {
  return JSON.stringify(grid);
}

export function deserialize(text, size = GRID_SIZE) {
  try {
    if (typeof text !== 'string') return null;
    const data = JSON.parse(text);
    if (!Array.isArray(data) || data.length !== size * size) return null;
    for (const c of data) {
      if (c !== null && !(typeof c === 'string' && HEX_RE.test(c))) return null;
    }
    return data.slice();
  } catch (e) {
    return null;
  }
}
