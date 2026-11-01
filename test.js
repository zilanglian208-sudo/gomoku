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

/* ---------- 7. 残局题库完整性（puzzles.js 由生成器产出） ---------- */
console.log('\n[7] 残局题库完整性');
{
  const PUZZLES = require('./puzzles.js');
  ok(PUZZLES.length >= 20, `题量充足：${PUZZLES.length} 题`);

  // 逐题验证：杀点唯一且与答案一致、对方无杀、win 型走答案后确实连五
  let bad = 0;
  for (const p of PUZZLES) {
    const b = G.createBoard();
    for (const [x, y, r] of p.stones) b[G.idx(x, y)] = r;
    const role = p.type === 'win' ? BLACK : WHITE;
    const pts = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = G.idx(x, y);
      if (b[i] !== EMPTY) continue;
      b[i] = role;
      if (G.winLineAt(b, x, y)) pts.push([x, y]);
      b[i] = EMPTY;
    }
    if (pts.length !== 1 || pts[0][0] !== p.answer[0] || pts[0][1] !== p.answer[1]) { bad++; continue; }
    // 对方不得已存在杀点，否则题目不干净
    const foe = 3 - role;
    let foeWins = false;
    for (let y = 0; y < SIZE && !foeWins; y++) for (let x = 0; x < SIZE; x++) {
      const i = G.idx(x, y);
      if (b[i] !== EMPTY) continue;
      b[i] = foe;
      if (G.winLineAt(b, x, y)) { foeWins = true; }
      b[i] = EMPTY;
      if (foeWins) break;
    }
    if (foeWins) { bad++; continue; }
    if (p.type === 'win') {
      b[G.idx(p.answer[0], p.answer[1])] = BLACK;
      if (!G.winLineAt(b, p.answer[0], p.answer[1])) bad++;
    }
  }
  ok(bad === 0, `全部题目答案唯一且有效（异常 ${bad} 题）`);

  // AI 自检：把答案点喂给引擎评估，答案点必须是评估分最高的点之一
  let agree = 0;
  for (const p of PUZZLES) {
    if (p.type !== 'win') continue;
    const b = G.createBoard();
    for (const [x, y, r] of p.stones) b[G.idx(x, y)] = r;
    const mv = G.bestMove(b, BLACK, 'hard');
    if (mv.x === p.answer[0] && mv.y === p.answer[1]) agree++;
  }
  const winCount = PUZZLES.filter(p => p.type === 'win').length;
  ok(agree === winCount, `hard 引擎在全部 ${winCount} 道「一步制胜」题上均选中答案`);
}

/* ---------- 8. 难度自适应：橡皮筋降档 ---------- */
console.log('\n[8] 难度自适应');
{
  // a) effectiveLevel 的升降档规则
  ok(G.effectiveLevel('medium', []) === 'medium', '无近期战绩时等于选定档位');
  ok(G.effectiveLevel('medium', ['w', 'l', 'l']) === 'medium', '连败 2 局暂不降档');
  ok(G.effectiveLevel('medium', ['w', 'l', 'l', 'l']) === 'easy', '连败 3 局 → 降一档');
  ok(G.effectiveLevel('hard', ['l', 'l', 'l', 'l', 'l']) === 'easy', '连败 5 局 → 降两档');
  ok(G.effectiveLevel('easy', ['l', 'l', 'l', 'l', 'l']) === 'easy', '已是最低档不再下降');
  ok(G.effectiveLevel('medium', ['w', 'w', 'w', 'w']) === 'hard', '连胜 4 局 → 升一档（加压）');
  ok(G.effectiveLevel('hard', ['w', 'w', 'w', 'w']) === 'hard', '已是最高档不再上升');
  ok(G.effectiveLevel('medium', ['l', 'l', 'l', 'w']) === 'medium', '非连败不触发降档');

  // b) 失误率层（引擎能力）：blunder=1 必不选最优（无战术点位的普通局面）
  const b = G.createBoard();
  for (const [x, y, r] of [[7, 7, BLACK], [8, 8, WHITE], [6, 8, BLACK]]) b[G.idx(x, y)] = r;
  let seed = 777;
  G.setRandom(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; });
  const best = G.bestMove(b, WHITE, 'hard');                       // blunder=0
  seed = 777;
  const bl = G.bestMove(b, WHITE, 'hard', { blunder: 1 });         // blunder=1
  G.setRandom();
  ok(best.x !== bl.x || best.y !== bl.y, 'blunder=1 时放弃最优选点');

  // c) 战术层不受失误率影响：对手冲四在即，再高的失误率也必须堵
  const b2 = G.createBoard();
  for (let x = 5; x <= 8; x++) b2[G.idx(x, 7)] = WHITE;            // 白敞四
  b2[G.idx(3, 3)] = BLACK; b2[G.idx(4, 4)] = BLACK;
  let seed2 = 12345;
  G.setRandom(() => { seed2 = (seed2 * 1664525 + 1013904223) >>> 0; return seed2 / 4294967296; });
  const block = G.bestMove(b2, BLACK, 'hard', { blunder: 1 });
  G.setRandom();
  ok(block.y === 7 && (block.x === 4 || block.x === 9), 'blunder=1 仍会堵冲四（战术层免疫）');
}

console.log(fails ? `\n共 ${fails} 项失败 ❌` : '\n全部测试通过 ✅');
process.exit(fails ? 1 : 0);
