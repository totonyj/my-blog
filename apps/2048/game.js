// 2048 순수 로직. DOM을 사용하지 않으며 Node에서 단독으로 import 할 수 있다.

export const DIRECTIONS = ['left', 'right', 'up', 'down'];

/**
 * 한 줄을 왼쪽으로 밀어 합친다. 추적 정보(sources)를 함께 돌려준다.
 * sources[j] = 결과 line[j]를 만든 입력 인덱스 배열 (합쳐졌으면 2개).
 */
export function slideLineDetailed(line) {
  const out = [];
  const sources = [];
  const mergedAt = [];
  let gained = 0;
  for (let i = 0; i < line.length; i++) {
    const v = line[i];
    if (v === 0) continue;
    const last = out.length - 1;
    if (last >= 0 && out[last] === v && !mergedAt[last]) {
      out[last] = v * 2;
      sources[last].push(i);
      mergedAt[last] = true;
      gained += v * 2;
    } else {
      out.push(v);
      sources.push([i]);
      mergedAt.push(false);
    }
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained, sources, merged: mergedAt };
}

export function slideLine(line) {
  const { line: out, gained } = slideLineDetailed(line);
  return { line: out, gained };
}

// 방향별로, 벽에 가까운 칸부터 순서대로 나열한 k번째 줄의 좌표들
function lineCoords(size, direction, k) {
  const coords = [];
  for (let i = 0; i < size; i++) {
    if (direction === 'left') coords.push([k, i]);
    else if (direction === 'right') coords.push([k, size - 1 - i]);
    else if (direction === 'up') coords.push([i, k]);
    else coords.push([size - 1 - i, k]);
  }
  return coords;
}

/**
 * 새 타일을 추가하지 않는 이동. 애니메이션용 trace를 포함한다.
 * trace 항목: { from: [r, c], to: [r, c], merged: boolean } — 합쳐진 경우 두 타일 모두 같은 to를 가진다.
 */
export function moveDetailed(board, direction) {
  if (!DIRECTIONS.includes(direction)) {
    throw new Error('알 수 없는 방향: ' + direction);
  }
  const size = board.length;
  const next = board.map((row) => row.slice());
  const trace = [];
  let gained = 0;
  let moved = false;

  for (let k = 0; k < size; k++) {
    const coords = lineCoords(size, direction, k);
    const values = coords.map(([r, c]) => board[r][c]);
    const res = slideLineDetailed(values);
    gained += res.gained;
    for (let j = 0; j < size; j++) {
      const [tr, tc] = coords[j];
      next[tr][tc] = res.line[j];
      for (const s of res.sources[j] || []) {
        const from = coords[s];
        trace.push({ from, to: [tr, tc], merged: Boolean(res.merged[j]) });
        if (s !== j) moved = true;
      }
    }
    if (res.merged.some(Boolean)) moved = true;
  }
  return { board: next, gained, moved, trace };
}

/** 빈 칸 하나에 2(90%) 또는 4(10%)를 놓은 새 board와 위치를 돌려준다. 빈 칸이 없으면 그대로. */
export function spawnTile(board, rng = Math.random) {
  const empty = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board.length; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }
  const next = board.map((row) => row.slice());
  if (empty.length === 0) return { board: next, pos: null };
  const idx = Math.min(empty.length - 1, Math.floor(rng() * empty.length));
  const [r, c] = empty[idx];
  next[r][c] = rng() < 0.9 ? 2 : 4;
  return { board: next, pos: [r, c] };
}

/** 이동. 입력 board는 변경하지 않으며, 실제로 움직였을 때만 새 타일을 추가한다. */
export function move(board, direction, rng = Math.random) {
  const res = moveDetailed(board, direction);
  if (!res.moved) {
    return { board: board.map((row) => row.slice()), gained: 0, moved: false };
  }
  const { board: withTile } = spawnTile(res.board, rng);
  return { board: withTile, gained: res.gained, moved: true };
}

export function newGame(size, rng = Math.random) {
  let board = Array.from({ length: size }, () => new Array(size).fill(0));
  board = spawnTile(board, rng).board;
  board = spawnTile(board, rng).board;
  return board;
}

export function isGameOver(board) {
  const n = board.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] === 0) return false;
      if (c + 1 < n && board[r][c] === board[r][c + 1]) return false;
      if (r + 1 < n && board[r][c] === board[r + 1][c]) return false;
    }
  }
  return true;
}

export function maxTile(board) {
  let m = 0;
  for (const row of board) for (const v of row) if (v > m) m = v;
  return m;
}

export function winTarget(size) {
  return size === 3 ? 256 : 2048;
}
