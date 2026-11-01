// 橡皮筋难度调参实验（第二轮）：失误率 vs 降档
// 运行：node tools/sim-difficulty.js
const G = require('../game.js');

let seed = 20261102;
G.setRandom(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; });

function playGame(playerLevel, aiLevel) {
  const b = G.createBoard();
  let role = G.BLACK, ply = 0;
  while (ply < 225) {
    const mv = G.bestMove(b, role, role === G.BLACK ? playerLevel : aiLevel);
    b[G.idx(mv.x, mv.y)] = role;
    ply++;
    if (G.winLineAt(b, mv.x, mv.y)) return role;
    role = 3 - role;
  }
  return 0;
}

function sim(label, aiLevel, games) {
  let win = 0, draw = 0, loss = 0;
  for (let i = 0; i < games; i++) {
    const r = playGame('easy', aiLevel);
    if (r === G.BLACK) win++; else if (r === 0) draw++; else loss++;
  }
  console.log(label + ': 胜 ' + win + ' / 和 ' + draw + ' / 负 ' + loss +
    '  （玩家胜率 ' + Math.round(win / games * 100) + '%）');
}

console.log('模拟：新手玩家(easy) 执黑 vs 各档 AI 执白，每组 12 局\n');
sim('AI = 棋手（当前基准）', 'medium', 12);
sim('AI = 学徒（降一档）   ', 'easy', 12);
console.log('\n设计判据：连败降档后新手胜率应回到 ~50% 附近（双方棋力对等）。');
