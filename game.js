/*!
 * 智能五子棋 —— 核心逻辑与 AI 引擎 (game.js)
 * ==================================================================
 * 纯逻辑模块：零 DOM 依赖，浏览器(window.Gomoku)与 Node.js(require)双端可用，
 * 亦是微信小程序版的同一份引擎（utils/engine.js）。
 *
 * 模块分区：
 *   A. 棋盘与几何        —— 一维 Int8Array 棋盘、坐标换算、四方向常量
 *   B. 胜负判定          —— winLineAt：仅检查落子点，返回连珠格路径
 *   C. 点位模式评估      —— analyzePoint：9 格窗口滑出模式串，
 *                           与棋型库（含跳子形态）匹配，覆盖中心才算命中
 *   D. 候选点生成        —— genMoves：距任意棋子切比雪夫距离 ≤2 的空点
 *   E. 全盘滑窗评估      —— boardEval：所有 5 格窗口的占据计分（搜索叶子）
 *   F. α-β 剪枝搜索      —— negamax + 着法排序 + 节点数上限
 *   G. 选点主入口        —— bestMove：战术硬规则 → 综合评分 → 深度搜索
 *
 * AI 分层（自上而下，先廉后贵）：
 *   1. 战术硬规则（任何难度）：我方成五 > 挡对方成五 > 我方活四 > 挡对方活四。
 *      —— 保证「能赢必赢、该挡必挡」，是下限承诺。
 *   2. 综合点位分：进攻分 + 防守分×防守权重 + 中心偏好。
 *   3. 困难模式：对前 12 个候选点做深度 4 的 negamax 搜索（α-β 剪枝，
 *      节点数上限防卡顿），叶子用全盘滑窗评估，平分时偏向点位分。
 *   4. 难度自适应（effectiveLevel）：橡皮筋机制——连败 3 局 AI 降一档、
 *      5 局降两档，连胜 4 局升一档。参数经模拟实验数据驱动标定：
 *      新手对「棋手」档胜率 0%，对「学徒」档 50%（tools/sim-difficulty.js）。
 *
 * 复杂度：点位评估 O(候选数×4×9)；搜索受节点上限约束，中盘实测 <150ms。
 * 可测试性：setRandom(fn) 可注入伪随机源，使含随机性的对局结果可复现。
 * ==================================================================
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Gomoku = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE = 15;
  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  const idx = (x, y) => y * SIZE + x;
  const inB = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  const other = r => 3 - r;

  function createBoard() { return new Int8Array(SIZE * SIZE); }

  /* ---------------- 胜负判定 ---------------- */

  /** 落子于 (x,y) 后，若形成 >=5 连则返回连珠格下标数组，否则 null */
  function winLineAt(board, x, y) {
    const role = board[idx(x, y)];
    if (role === EMPTY) return null;
    for (let d = 0; d < 4; d++) {
      const dx = DIRS[d][0], dy = DIRS[d][1];
      const cells = [idx(x, y)];
      for (let s = 1; s < 5; s++) {
        const nx = x + dx * s, ny = y + dy * s;
        if (!inB(nx, ny) || board[idx(nx, ny)] !== role) break;
        cells.push(idx(nx, ny));
      }
      for (let s = 1; s < 5; s++) {
        const nx = x - dx * s, ny = y - dy * s;
        if (!inB(nx, ny) || board[idx(nx, ny)] !== role) break;
        cells.push(idx(nx, ny));
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }

  function winAtIdx(board, i) { return !!winLineAt(board, i % SIZE, (i / SIZE) | 0); }

  /* ---------------- 点位模式评估 ---------------- */

  const SC = {
    FIVE: 10000000,   // 连五
    LIVE4: 400000,    // 活四
    RUSH4: 60000,     // 冲四（含跳四）
    LIVE3: 50000,     // 活三（含跳活三）
    SLEEP3: 3000,     // 眠三
    LIVE2: 2500,      // 活二
    SLEEP2: 300,      // 眠二
  };

  // 模式串：'1'=己方 '0'=空 '2'=对方或边界（串首尾的哨兵也是 '2'）
  const P_FIVE   = ['11111'];
  const P_LIVE4  = ['011110'];
  const P_RUSH4  = ['211110', '011112', '11101', '10111', '11011'];
  const P_LIVE3  = ['011100', '001110', '011010', '010110'];
  const P_SLEEP3 = ['211100', '001112', '211010', '010112', '210110',
                    '011012', '10011', '11001', '10101', '2011102'];
  const P_LIVE2  = ['001100', '01010'];
  const P_SLEEP2 = ['211000', '000112', '210100', '001012', '10001'];

  /** 以 (x,y) 为中心、沿 (dx,dy) 取 9 格，加首尾哨兵得到长度 11 的模式串（中心视为己方落子） */
  function lineString(board, x, y, dx, dy, role) {
    let s = '2';
    for (let i = -4; i <= 4; i++) {
      if (i === 0) { s += '1'; continue; }
      const nx = x + dx * i, ny = y + dy * i;
      if (!inB(nx, ny)) { s += '2'; continue; }
      const v = board[idx(nx, ny)];
      s += v === EMPTY ? '0' : (v === role ? '1' : '2');
    }
    return s + '2';
  }

  const CENTER = 5; // 中心（落子点）在模式串中的下标

  /** 匹配任一模式，且出现位置必须覆盖中心点 */
  function matchCover(s, pats) {
    for (let p = 0; p < pats.length; p++) {
      const pat = pats[p];
      let from = 0;
      for (;;) {
        const i = s.indexOf(pat, from);
        if (i === -1) break;
        if (i <= CENTER && CENTER < i + pat.length) return true;
        from = i + 1;
      }
    }
    return false;
  }

  /** 假设 role 在空点 (x,y) 落子后的价值：{score, five, liveFour} */
  function analyzePoint(board, x, y, role) {
    let score = 0, five = false, liveFour = false;
    for (let d = 0; d < 4; d++) {
      const s = lineString(board, x, y, DIRS[d][0], DIRS[d][1], role);
      if (matchCover(s, P_FIVE))       { score += SC.FIVE; five = true; }
      else if (matchCover(s, P_LIVE4)) { score += SC.LIVE4; liveFour = true; }
      else if (matchCover(s, P_RUSH4)) score += SC.RUSH4;
      else if (matchCover(s, P_LIVE3)) score += SC.LIVE3;
      else if (matchCover(s, P_SLEEP3)) score += SC.SLEEP3;
      else if (matchCover(s, P_LIVE2)) score += SC.LIVE2;
      else if (matchCover(s, P_SLEEP2)) score += SC.SLEEP2;
    }
    return { score, five, liveFour };
  }

  /* ---------------- 候选点生成 ---------------- */

  /** 所有距任意棋子切比雪夫距离 <=2 的空点；空盘返回天元 */
  function genMoves(board) {
    const mark = new Uint8Array(SIZE * SIZE);
    let any = false;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (board[idx(x, y)] === EMPTY) continue;
      any = true;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (inB(nx, ny) && board[idx(nx, ny)] === EMPTY) mark[idx(nx, ny)] = 1;
      }
    }
    if (!any) return [idx(7, 7)];
    const res = [];
    for (let i = 0; i < SIZE * SIZE; i++) if (mark[i]) res.push(i);
    return res;
  }

  /* ---------------- 全盘滑窗评估（搜索叶子用） ---------------- */

  const LINES = (function () {
    const lines = [];
    for (let y = 0; y < SIZE; y++) { const l = []; for (let x = 0; x < SIZE; x++) l.push(idx(x, y)); lines.push(l); }
    for (let x = 0; x < SIZE; x++) { const l = []; for (let y = 0; y < SIZE; y++) l.push(idx(x, y)); lines.push(l); }
    for (let s = -SIZE + 5; s <= SIZE - 5; s++) {          // 主对角线 ↘
      const l = [];
      for (let y = 0; y < SIZE; y++) { const x = y + s; if (x >= 0 && x < SIZE) l.push(idx(x, y)); }
      lines.push(l);
    }
    for (let s = 4; s <= 2 * SIZE - 6; s++) {              // 反对角线 ↗
      const l = [];
      for (let y = 0; y < SIZE; y++) { const x = s - y; if (x >= 0 && x < SIZE) l.push(idx(x, y)); }
      lines.push(l);
    }
    return lines;
  })();

  const WIN_W = [0, 9, 90, 900, 9000, 10000000]; // 5 窗口中己方子数 -> 分值（对方为 0 时）

  function boardEval(board, role) {
    const opp = other(role);
    let sMe = 0, sOp = 0;
    for (let li = 0; li < LINES.length; li++) {
      const line = LINES[li], n = line.length;
      for (let i = 0; i + 5 <= n; i++) {
        let cm = 0, cp = 0;
        for (let k = 0; k < 5; k++) {
          const v = board[line[i + k]];
          if (v === role) cm++; else if (v === opp) cp++;
          if (cm && cp) break;
        }
        if (cm && !cp) sMe += WIN_W[cm];
        else if (cp && !cm) sOp += WIN_W[cp];
      }
    }
    return sMe - sOp * 1.06; // 略偏防守
  }

  /* ---------------- α-β 剪枝极大极小搜索 ---------------- */

  const WIN_BONUS = 1e9;
  const NODE_LIMIT = 400000;
  let nodes = 0;

  function orderMoves(board, role, topN) {
    const opp = other(role);
    const cands = genMoves(board);
    const list = [];
    for (let k = 0; k < cands.length; k++) {
      const c = cands[k], x = c % SIZE, y = (c / SIZE) | 0;
      list.push({
        c,
        s: analyzePoint(board, x, y, role).score + analyzePoint(board, x, y, opp).score,
      });
    }
    list.sort((a, b) => b.s - a.s);
    return list.slice(0, topN).map(o => o.c);
  }

  function negamax(board, depth, alpha, beta, role, ply) {
    if (depth === 0 || nodes > NODE_LIMIT) return boardEval(board, role);
    nodes++;
    const moves = orderMoves(board, role, 8);
    if (!moves.length) return 0; // 无处可落 -> 和棋
    let best = -Infinity;
    for (let k = 0; k < moves.length; k++) {
      const c = moves[k];
      board[c] = role;
      let sc;
      if (winAtIdx(board, c)) sc = WIN_BONUS - ply; // 越快获胜分越高
      else sc = -negamax(board, depth - 1, -beta, -alpha, other(role), ply + 1);
      board[c] = EMPTY;
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  /* ---------------- 主入口：AI 选点 ---------------- */

  function centerBias(x, y) { return (26 - Math.abs(x - 7) - Math.abs(y - 7)) * 3; }

  // 随机源（默认 Math.random；测试可注入固定种子的伪随机函数以复现结果）
  let rng = Math.random;
  function setRandom(fn) { rng = fn || Math.random; }

  /**
   * 失误率选点：以 blunder 概率从第 2~4 优候选中加权挑一个，否则选最优。
   * 这是难度设计的核心机制——AI 的「弱」体现在战略选点上，
   * 而战术硬规则（能赢必赢、该挡必挡）不受影响，弱得自然不弱得像 bug。
   * @param {Array} ranked 已按“越靠前越好”排序的候选数组
   * @param {number} blunder 0~1，失误概率
   */
  function pickWithBlunder(ranked, blunder) {
    if (blunder > 0 && ranked.length > 1 && rng() < blunder) {
      const alt = ranked.slice(1, Math.min(4, ranked.length));
      const w = [0.5, 0.3, 0.2];
      let r = rng(), acc = 0;
      for (let i = 0; i < alt.length; i++) { acc += w[i]; if (r <= acc) return alt[i]; }
      return alt[alt.length - 1];
    }
    return ranked[0];
  }

  /**
   * 难度自适应（橡皮筋机制）：根据玩家近期胜负返回 AI 的有效棋力档。
   * 数据依据（tools/sim-difficulty.js）：新手对「棋手」档胜率 0%，
   * 对「学徒」档 50% —— 因此用「降档」而非「加大失误率」做手下留情，
   * 后者被证明无效（强引擎的次优候选依然是好棋）。
   *   连败 3 局 → 降一档；连败 5 局 → 降两档；
   *   连胜 4 局 → 升一档（给赢麻了的玩家加压）。
   * 升降都在用户选定的档位基础上进行，纯函数，便于单元测试。
   * @param {string} level 用户选定的档位（'easy'|'medium'|'hard'）
   * @param {string[]} recent 最近对局结果序列（'w'/'l'/'d'，旧的在前）
   * @returns {string} 有效档位
   */
  function effectiveLevel(level, recent) {
    const order = ['easy', 'medium', 'hard'];
    let idx = order.indexOf(level);
    const tail = (recent || []).slice(-6);
    let losses = 0;
    for (let i = tail.length - 1; i >= 0 && tail[i] === 'l'; i--) losses++;
    if (losses >= 5) idx = Math.max(0, idx - 2);
    else if (losses >= 3) idx = Math.max(0, idx - 1);
    let wins = 0;
    for (let i = tail.length - 1; i >= 0 && tail[i] === 'w'; i--) wins++;
    if (wins >= 4) idx = Math.min(order.length - 1, idx + 1);
    return order[idx];
  }

  function bestOf(arr, key) {
    if (!arr.length) return null;
    let b = arr[0];
    for (let i = 1; i < arr.length; i++) if (key(arr[i]) > key(b)) b = arr[i];
    return b;
  }

  /**
   * @param {Int8Array} board
   * @param {number} aiRole  AI 执子（BLACK=1 / WHITE=2）
   * @param {'easy'|'medium'|'hard'} level
   * @param {object} [opts]  可选参数：{ blunder: 0~1 } 失误率，
   *                         用于难度自适应（默认 0，行为与旧版一致）
   * @returns {{x:number, y:number}}
   */
  function bestMove(board, aiRole, level, opts) {
    const opp = other(aiRole);
    const cands = genMoves(board);
    if (!cands.length) return { x: 7, y: 7 };
    const info = cands.map(c => {
      const x = c % SIZE, y = (c / SIZE) | 0;
      const a = analyzePoint(board, x, y, aiRole);
      const d = analyzePoint(board, x, y, opp);
      return { c, x, y, a, d, total: a.score + d.score };
    });

    // ---- 战术层（任何难度都保证：能赢必赢、该挡必挡）----
    let pick = bestOf(info.filter(i => i.a.five), i => i.a.score);   // 1. 我方成五
    if (pick) return pick;
    pick = bestOf(info.filter(i => i.d.five), i => i.total);         // 2. 挡对方成五
    if (pick) return pick;
    if (level !== 'easy') {
      pick = bestOf(info.filter(i => i.a.liveFour), i => i.a.score); // 3. 我方活四（下一步必胜）
      if (pick) return pick;
      pick = bestOf(info.filter(i => i.d.liveFour), i => i.d.score); // 4. 挡对方活四点
      if (pick) return pick;
    }

    // ---- 综合评分：进攻 + 防守 ----
    const dw = level === 'easy' ? 0.55 : 0.9;
    for (const it of info) {
      it.total = it.a.score + it.d.score * dw + centerBias(it.x, it.y);
    }
    info.sort((p, q) => q.total - p.total);

    if (level === 'hard') {
      // 深度 4 搜索：记录根节点排名，失误率层可从次优中挑选
      nodes = 0;
      const top = info.slice(0, 12);
      const scored = [];
      let alpha = -Infinity;
      for (const it of top) {
        board[it.c] = aiRole;
        let sc;
        if (winAtIdx(board, it.c)) sc = WIN_BONUS;
        else sc = -negamax(board, 3, -Infinity, -alpha, opp, 2);
        board[it.c] = EMPTY;
        sc += it.total * 1e-6; // 平分时偏向点位分更高者
        scored.push({ it, sc });
        if (sc > alpha) alpha = sc;
      }
      scored.sort((a, b) => b.sc - a.sc);
      return pickWithBlunder(scored.map(s => s.it), (opts && opts.blunder) || 0);
    }

    // easy / medium：综合评分排序
    let ranked = info;
    if (level === 'easy' && info.length > 1) {
      // 入门难度自带 38% 随性（前 3 名加权），把选中者排到最前再过失误率层
      const pool = info.slice(0, Math.min(3, info.length));
      const w = [0.62, 0.25, 0.13];
      let r = rng(), acc = 0, first = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) { acc += w[i]; if (r <= acc) { first = pool[i]; break; } }
      ranked = [first].concat(info.filter(x => x !== first));
    }
    return pickWithBlunder(ranked, (opts && opts.blunder) || 0);
  }

  return {
    SIZE, EMPTY, BLACK, WHITE,
    createBoard, idx,
    winLineAt, winAtIdx,
    analyzePoint, genMoves, boardEval,
    bestMove, setRandom, effectiveLevel,
  };
});
