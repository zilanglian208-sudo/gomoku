// 残局题库生成器：程序生成 + 引擎验证答案唯一性
// 运行：node tools/gen-puzzles.js  → 输出 puzzles.js
const G = require('../game.js');
const SIZE = G.SIZE;

let seed = 20261102;
function rng() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function ri(n) { return (rng() * n) | 0; }

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

function findWinningPoints(board, role) {
  const pts = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = G.idx(x, y);
    if (board[i] !== G.EMPTY) continue;
    board[i] = role;
    if (G.winLineAt(board, x, y)) pts.push([x, y]);
    board[i] = G.EMPTY;
  }
  return pts;
}
function hasFive(board) {
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (board[G.idx(x, y)] && G.winLineAt(board, x, y)) return true;
  }
  return false;
}
function inB(x, y) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }

// 撒对手棋子，不得成五、不得占据答案点
function sprinkle(board, foe, stones, keep) {
  const n = 1 + ri(5);
  for (let s = 0; s < n; s++) {
    for (let t = 0; t < 20; t++) {
      const x = ri(SIZE), y = ri(SIZE);
      if (board[G.idx(x, y)] !== G.EMPTY) continue;
      if (keep && keep.some(([kx, ky]) => kx === x && ky === y)) continue;
      board[G.idx(x, y)] = foe;
      if (G.winLineAt(board, x, y)) { board[G.idx(x, y)] = G.EMPTY; continue; }
      stones.push([x, y, foe]);
      break;
    }
  }
}

// 初级：连四，堵住一端 → 唯一成五点在另一端
function genL1(kind, role) {
  const b = G.createBoard();
  const dir = DIRS[ri(4)];
  const sx = 2 + ri(SIZE - 8), sy = 2 + ri(SIZE - 8);
  const stones = [];
  for (let o = 0; o < 4; o++) {
    const x = sx + dir[0] * o, y = sy + dir[1] * o;
    b[G.idx(x, y)] = role; stones.push([x, y, role]);
  }
  const flip = ri(2) ? 1 : -1;
  const bx = sx - dir[0] * flip, by = sy - dir[1] * flip;
  if (!inB(bx, by)) return null;
  b[G.idx(bx, by)] = 3 - role; stones.push([bx, by, 3 - role]);
  return { b, stones };
}

// 中级：跳四（一个缺口）→ 唯一成五点在缺口
function genL2(kind, role) {
  const b = G.createBoard();
  const GAPS = [[0, 1, 2, 4], [0, 1, 3, 4], [0, 2, 3, 4]];
  const off = GAPS[ri(GAPS.length)];
  const dir = DIRS[ri(4)];
  const sx = 2 + ri(SIZE - 8), sy = 2 + ri(SIZE - 8);
  const stones = [];
  for (const o of off) {
    const x = sx + dir[0] * o, y = sy + dir[1] * o;
    b[G.idx(x, y)] = role; stones.push([x, y, role]);
  }
  return { b, stones };
}

// 高级：双杀十字 → 中心一点同时成两个五（横竖各 ●●_●●）
function genL3(kind, role) {
  const b = G.createBoard();
  const cx = 3 + ri(SIZE - 6), cy = 3 + ri(SIZE - 6);
  const stones = [];
  const shape = [[-2, 0], [-1, 0], [1, 0], [2, 0], [0, -2], [0, -1], [0, 1], [0, 2]];
  for (const [dx, dy] of shape) {
    b[G.idx(cx + dx, cy + dy)] = role;
    stones.push([cx + dx, cy + dy, role]);
  }
  return { b, stones };
}

const BUILDERS = { 1: genL1, 2: genL2, 3: genL3 };

function genOnce(kind, level) {
  const role = kind === 'win' ? G.BLACK : G.WHITE;   // 拥有杀势的一方
  const foe = 3 - role;
  for (let attempt = 0; attempt < 600; attempt++) {
    const made = BUILDERS[level](kind, role);
    if (!made) continue;
    const { b, stones } = made;
    if (hasFive(b)) continue;
    const answer = findWinningPoints(b, role);
    const foePts = findWinningPoints(b, foe);
    if (answer.length !== 1 || foePts.length !== 0) continue;
    sprinkle(b, foe, stones, answer);
    if (hasFive(b)) continue;
    const recheck = findWinningPoints(b, role);
    if (recheck.length !== 1) continue;
    return {
      type: kind, level, stones, answer: recheck[0],
      desc: kind === 'win' ? '你执黑，一步制胜' : '对方下一手就连五，找到唯一防点',
    };
  }
  return null;
}

const PLAN = [
  ['win', 1, 4], ['win', 2, 6], ['win', 3, 4],
  ['block', 1, 3], ['block', 2, 4], ['block', 3, 3],
];
const puzzles = [];
const seen = new Set();
for (const [kind, level, count] of PLAN) {
  let guard = 0;
  let got = 0;
  while (got < count && guard++ < 8000) {
    const p = genOnce(kind, level);
    if (!p) continue;
    const key = p.stones.map(s => s.join(',')).sort().join('|') + '#' + p.answer.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    p.id = puzzles.length + 1;
    puzzles.push(p);
    got++;
  }
}

// 最终校验
let bad = 0;
for (const p of puzzles) {
  const b = G.createBoard();
  for (const [x, y, r] of p.stones) b[G.idx(x, y)] = r;
  const role = p.type === 'win' ? G.BLACK : G.WHITE;
  const pts = findWinningPoints(b, role);
  if (pts.length !== 1 || pts[0][0] !== p.answer[0] || pts[0][1] !== p.answer[1]) { bad++; continue; }
  if (p.type === 'win') {
    b[G.idx(p.answer[0], p.answer[1])] = G.BLACK;
    if (!G.winLineAt(b, p.answer[0], p.answer[1])) bad++;
  }
}

const out = '// 残局题库（由 tools/gen-puzzles.js 程序生成并经引擎验证，请勿手改）\n' +
  '(function (root) {\n' +
  '  const PUZZLES = ' + JSON.stringify(puzzles) + ';\n' +
  '  if (typeof module === "object" && module.exports) module.exports = PUZZLES;\n' +
  '  else root.PUZZLES = PUZZLES;\n' +
  '})(typeof self !== "undefined" ? self : this);\n';

require('fs').writeFileSync(__dirname + '/../puzzles.js', out);
console.log('generated', puzzles.length, 'puzzles, invalid:', bad);
console.log('levels:', JSON.stringify(puzzles.reduce((m, p) => (m[p.level] = (m[p.level] || 0) + 1, m), {})));
