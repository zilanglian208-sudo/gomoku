/* 智能五子棋 —— 引擎单元测试 (Node.js)
 * 运行：node test.js
 * 重点验证：胜负判定准确、AI 能赢必赢 / 该挡必挡、搜索不崩溃且合法。
 */
const G = require('./game.js');
const { BLACK, WHITE, EMPTY, SIZE } = G;

let fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  [PASS] ' + msg);
  else { fails++; console.error('  [FAIL] ' + msg); }
}
function put(b, x, y, r) { b[G.idx(x, y)] = r; }

/* ---------- 1. 胜负判定 ---------- */
console.log('\n[1] 胜负判定 winLineAt');
{
  let b = G.createBoard();
  for (let x = 3; x <= 7; x++) put(b, x, 7, BLACK);            // 横向五连
  ok(G.winLineAt(b, 5, 7) && G.winLineAt(b, 5, 7).length === 5, '横向五连被识别');

  b = G.createBoard();
  for (let y = 4; y <= 8; y++) put(b, 9, y, WHITE);            // 纵向五连
  ok(!!G.winLineAt(b, 9, 6), '纵向五连被识别');

  b = G.createBoard();
  for (let i = 0; i < 5; i++) put(b, 2 + i, 2 + i, BLACK);     // 主对角线
  ok(!!G.winLineAt(b, 4, 4), '主对角线五连被识别');

  b = G.createBoard();
  for (let i = 0; i < 5; i++) put(b, 3 + i, 11 - i, WHITE);    // 反对角线
  ok(!!G.winLineAt(b, 5, 9), '反对角线五连被识别');

  b = G.createBoard();
  for (let x = 3; x <= 6; x++) put(b, x, 7, BLACK);            // 只有四连
  ok(G.winLineAt(b, 5, 7) === null, '四连不误判为胜');

  b = G.createBoard();
  put(b, 3, 3, BLACK); put(b, 4, 4, BLACK); put(b, 5, 5, BLACK);
  put(b, 6, 6, BLACK); put(b, 7, 7, WHITE);                    // 被拦截
  ok(G.winLineAt(b, 5, 5) === null, '被拦截的四连不误判');
}

/* ---------- 2. AI 能赢必赢 ---------- */
console.log('\n[2] AI 能赢必赢');
for (const level of ['easy', 'medium', 'hard']) {
  const b = G.createBoard();
  // 白(AI) 横向四连，两端皆空
  for (let x = 5; x <= 8; x++) put(b, x, 7, WHITE);
  // 黑(玩家) 零散子
  put(b, 0, 0, BLACK); put(b, 1, 1, BLACK); put(b, 2, 1, BLACK); put(b, 0, 2, BLACK);
  const mv = G.bestMove(b, WHITE, level);
  ok((mv.y === 7 && (mv.x === 4 || mv.x === 9)) && b[G.idx(mv.x, mv.y)] === EMPTY,
     `${level}: 直接补成五连 (${mv.x},${mv.y})`);
}

/* ---------- 3. AI 该挡必挡（冲四） ---------- */
console.log('\n[3] AI 挡对方冲四');
{
  const b = G.createBoard();
  // 黑横向敞四 _2222_，AI(白) 必须挡两端之一
  for (let x = 5; x <= 8; x++) put(b, x, 3, BLACK);
  put(b, 10, 10, WHITE); put(b, 11, 11, WHITE);
  const mv = G.bestMove(b, WHITE, 'hard');
  ok(mv.y === 3 && (mv.x === 4 || mv.x === 9), `hard: 挡住敞四 (${mv.x},${mv.y})`);
}
{
  const b = G.createBoard();
  // 黑贴边四连 2222_（左边是边界，只有右端一个成五点）
  for (let x = 0; x <= 3; x++) put(b, x, 0, BLACK);
  put(b, 10, 10, WHITE); put(b, 11, 11, WHITE);
  const mv = G.bestMove(b, WHITE, 'medium');
  ok(mv.x === 4 && mv.y === 0, `medium: 挡住贴边唯一成五点 (${mv.x},${mv.y})`);
}
{
  const b = G.createBoard();
  // 黑跳四 2_222（缺口在中间）
  put(b, 3, 5, BLACK); put(b, 5, 5, BLACK); put(b, 6, 5, BLACK); put(b, 7, 5, BLACK);
  put(b, 10, 10, WHITE); put(b, 11, 11, WHITE);
  const mv = G.bestMove(b, WHITE, 'hard');
  ok(mv.y === 5 && mv.x === 4, `hard: 挡住跳四缺口 (4,${mv.y})`);
}

/* ---------- 4. AI 挡活三（防活四） ---------- */
console.log('\n[4] AI 挡对方活三');
{
  const b = G.createBoard();
  // 黑活三 .222.（两端开阔），AI(白) 应落在能使其成活四的点上
  put(b, 6, 6, BLACK); put(b, 7, 6, BLACK); put(b, 8, 6, BLACK);
  put(b, 12, 12, WHITE); put(b, 12, 10, WHITE);
  for (const level of ['medium', 'hard']) {
    const mv = G.bestMove(b, WHITE, level);
    ok(mv.y === 6 && (mv.x === 5 || mv.x === 9),
       `${level}: 挡活三要点 (${mv.x},${mv.y})`);
  }
}

/* ---------- 5. AI 不会落在已占用点 / 对弈完整性 ---------- */
console.log('\n[5] AI 对弈完整性');

// 独立的全盘五连扫描器（与引擎实现解耦，交叉验证）
function scanWinner(b) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const r = b[G.idx(x, y)];
    if (!r) continue;
    for (const [dx, dy] of dirs) {
      const px = x - dx, py = y - dy;
      if (px >= 0 && px < SIZE && py >= 0 && py < SIZE && b[G.idx(px, py)] === r) continue;
      let n = 0, i = x, j = y;
      while (i >= 0 && i < SIZE && j >= 0 && j < SIZE && b[G.idx(i, j)] === r) { n++; i += dx; j += dy; }
      if (n >= 5) return r;
    }
  }
  return 0;
}

function playGame(lvBlack, lvWhite, maxPly) {
  const b = G.createBoard();
  let role = BLACK, ply = 0;
  while (ply < (maxPly || SIZE * SIZE)) {
    const mv = G.bestMove(b, role, role === BLACK ? lvBlack : lvWhite);
    if (b[G.idx(mv.x, mv.y)] !== EMPTY) throw new Error('AI 落在了已占用点 ' + JSON.stringify(mv));
    put(b, mv.x, mv.y, role);
    ply++;
    const w = scanWinner(b);
    if (w) return { winner: w, ply };
    role = 3 - role;
  }
  return { winner: 0, ply };
}

{
  // medium(黑) vs easy(白)：注入固定种子随机源，结果可复现、断言稳定
  let seed = 42;
  G.setRandom(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; });
  let pts = 0;
  const t0 = Date.now();
  for (let g = 0; g < 3; g++) {
    const r = playGame('medium', 'easy');
    if (r.winner === BLACK) pts += 1; else if (r.winner === 0) pts += 0.5;
  }
  G.setRandom(); // 恢复默认随机源
  ok(pts >= 2, `medium vs easy 三局积分 ${pts} >= 2（固定种子，${Date.now() - t0}ms）`);

  // hard 参与的对弈前 60 手不崩溃、全部合法
  const t1 = Date.now();
  const r = playGame('hard', 'medium', 60);
  ok(true, `hard vs medium 前 ${r.ply} 手运行正常（${Date.now() - t1}ms, winner=${r.winner || '未分出'}）`);
}

/* ---------- 6. 困难模式性能 ---------- */
console.log('\n[6] 困难模式性能');
{
  const b = G.createBoard();
  let role = BLACK;
  for (let i = 0; i < 24; i++) {           // 先摆一个中盘局面
    const mv = G.bestMove(b, role, role === BLACK ? 'medium' : 'easy');
    put(b, mv.x, mv.y, role);
    role = 3 - role;
  }
  const t0 = Date.now();
  const mv = G.bestMove(b, role, 'hard');
  const dt = Date.now() - t0;
  ok(dt < 2000, `中盘思考耗时 ${dt}ms < 2000ms (落子 ${mv.x},${mv.y})`);
}

console.log(fails ? `\n共 ${fails} 项失败 ❌` : '\n全部测试通过 ✅');
process.exit(fails ? 1 : 0);
