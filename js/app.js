/*!
 * 五子棋 · 连珠 —— 应用层 (app.js)
 * ==================================================================
 * 职责：页面交互、渲染、音效、生涯成长系统与残局挑战。
 * 依赖：game.js（纯逻辑引擎，零 DOM 依赖，可独立测试）
 *       puzzles.js（程序生成并经引擎验证的残局题库）
 *
 * 模块分区（自上而下）：
 *   [0] 常量与配置        —— 尺寸/段位/成就/皮肤/台词等静态数据
 *   [1] 生涯存档          —— 单一 localStorage 键的读写与默认值合并
 *   [2] 通用工具          —— 格式化、随机、Toast
 *   [3] 音效系统          —— WebAudio 实时合成，零音频资源文件
 *   [4] AI 台词           —— 基于局面分析的轻量叙事
 *   [5] 对局状态与流程    —— 落子/胜负/悔棋/提示
 *   [6] 结算与经济        —— 段位积分、金币、成就检查
 *   [7] 残局挑战          —— 出题/判题/评星，对局快照可无损恢复
 *   [8] 复盘系统          —— 着法回放（仅终局可用）
 *   [9] 渲染              —— Canvas 绘制（皮肤参数化、落子动画、胜利线）
 *   [10] 输入与事件绑定
 *   [11] 启动序列
 *
 * 数据流：用户输入 → playerMove() → 引擎计算 → doMove() → 渲染 + 面板
 *         终局 → endGame() → 结算（段位/金币/成就）→ 遮罩展示
 * 持久化：生涯数据统一存 localStorage['wuziqi-career']（单一键便于迁移）。
 * ==================================================================
 */
(function () {
  'use strict';

  const G = window.Gomoku;          // 引擎（胜负判定/评估/AI 选点）
  const PUZZLES = window.PUZZLES || [];
  const SIZE = G.SIZE;

  /* ================================================================
   * [0] 常量与配置
   * ================================================================ */
  const $ = id => document.getElementById(id);
  const COLS = 'ABCDEFGHIJKLMNO';
  const notation = (x, y) => COLS[x] + (SIZE - y);

  // 逻辑坐标系：绘制与触控换算都基于 640x640，实际像素由 DPR 缩放
  const W = 640, PAD = 40, CELL = (W - 2 * PAD) / (SIZE - 1);
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const cv = $('board');
  const ctx = cv.getContext('2d');
  cv.width = W * DPR; cv.height = W * DPR;

  // 段位表：[名称, 所需积分, 徽章色]；rankOf() 按 p.idx(name)(c)
  const RANKS = [
    ['青铜', 0, '#8c6239'], ['白银', 100, '#8f9aa6'], ['黄金', 250, '#c9962e'],
    ['铂金', 450, '#3f8f7b'], ['钻石', 700, '#3b6ea5'], ['王者', 1000, '#a63c2f'],
  ];
  // 结算积分/金币按 AI 难度区分：easy / medium / hard
  const RANK_GAIN = { win: { easy: 8, medium: 15, hard: 25 }, draw: 2, loss: -5 };
  const COIN_GAIN = { win: { easy: 10, medium: 18, hard: 30 }, draw: 4, loss: 1 };
  const COIN_COST = { undo: 3, hint: 5 };   // 道具定价（金币经济核心）
  const SIGN_IN_COIN = 20;                  // 每日签到奖励

  // 成就定义：[id, 名称, 达成条件描述]；判定见 achProgress()
  const ACH_DEFS = [
    ['first_game', '初出茅庐', '完成第一局对弈'],
    ['first_win', '旗开得胜', '赢下第一局'],
    ['streak3', '三连胜', '连续获胜 3 场'],
    ['streak5', '五连胜', '连续获胜 5 场'],
    ['beat_hard', '高手过招', '击败困难级 AI'],
    ['rank_gold', '登堂入室', '达到黄金段位'],
    ['fast_win', '快棋手', '30 手内取胜'],
    ['puzzle5', '解题人', '完成 5 道残局'],
    ['puzzle_all', '满腹韬略', '完成全部残局'],
    ['rich', '腰缠万贯', '持有 100 金币'],
  ];

  // 棋盘皮肤：cost=0 为默认；dark 皮肤下黑子需浅描边保证对比度
  const SKINS = [
    { id: 'walnut', name: '胡桃木', cost: 0, dark: false,
      board: ['#e3b56f', '#d9aa62', '#cd9d55'], grain: 'rgba(120,80,30,.05)',
      line: 'rgba(92,64,30,.8)', star: 'rgba(70,48,22,.9)', coord: 'rgba(92,64,30,.85)' },
    { id: 'ink', name: '玄墨', cost: 30, dark: true,
      board: ['#343841', '#2c2f37', '#24262d'], grain: 'rgba(255,255,255,.04)',
      line: 'rgba(190,200,212,.5)', star: 'rgba(205,215,228,.8)', coord: 'rgba(190,200,212,.6)' },
    { id: 'sakura', name: '樱庭', cost: 30, dark: false,
      board: ['#f6dfd9', '#f2d3cc', '#eec9c2'], grain: 'rgba(200,120,120,.05)',
      line: 'rgba(160,90,90,.6)', star: 'rgba(150,80,80,.85)', coord: 'rgba(160,90,90,.7)' },
  ];

  // AI 台词池：按事件分组，随机抽取；措辞刻意克制（见 README「语气设计」）
  const LINES = {
    blockFive:  ['好险，差点让你连成五子。', '就想料到你会走这。', '堵住了，没那么容易。'],
    aiFour:     ['看这一手。', '攻势开始了。', '胜利在望。'],
    playerFour: ['大意了……', '这手够狠。', '得提防你的三连了。'],
    aiThree:    ['步步为营。', '悄悄布局中。', '看好了。'],
    aiWin:      ['承让。', '我赢了，再来一局？', '棋高一着。'],
    aiLose:     ['棋差一着，佩服。', '你赢了，厉害。', '这局算你的，下局我认真下。'],
    draw:       ['势均力敌，平分秋色。', '不打不相识，再来一局？'],
    puzzleOK:   ['妙手。', '正是此点。', '杀形已成。'],
    puzzleBad:  ['再想想。', '此处不妥。', '换个位置试试。'],
  };

  /* ================================================================
   * [1] 生涯存档（单一键，含默认值合并，向后兼容旧档）
   * ================================================================ */
  const CAREER_KEY = 'wuziqi-career';
  let career = loadCareer();
  function loadCareer() {
    const dft = {
      rank: 0, coins: 30, ach: {}, puzzles: {}, lastSignIn: '',
      skin: 'walnut', skins: ['walnut'],
      stats: { games: 0, wins: 0, losses: 0, draws: 0, coinsEarned: 0, fastestWin: 0 },
      daily: { date: '', id: -1 },
    };
    try {
      const c = JSON.parse(localStorage.getItem(CAREER_KEY));
      if (c && typeof c === 'object') {
        // 浅合并：旧档缺的字段用默认补齐（stats/daily 需逐字段兜底）
        return Object.assign(dft, c, {
          ach: c.ach || dft.ach, puzzles: c.puzzles || dft.puzzles,
          skins: c.skins || dft.skins,
          stats: Object.assign(dft.stats, c.stats || {}),
          daily: Object.assign(dft.daily, c.daily || {}),
        });
      }
    } catch (e) { /* 存档损坏则从零开始 */ }
    return dft;
  }
  function saveCareer() {
    try { localStorage.setItem(CAREER_KEY, JSON.stringify(career)); } catch (e) {}
  }
  function rankOf(pts) {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (pts >= RANKS[i][1]) idx = i;
    return idx;
  }
  function rankName(idx) { return RANKS[idx][0]; }

  /* ================================================================
   * [2] 通用工具
   * ================================================================ */
  const fmt = ms => {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  function toast(text, ms) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms || 2400);
  }
  function haptic(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

  /* ================================================================
   * [3] 音效系统 —— WebAudio 振荡器实时合成，无任何音频资源文件
   *     tone(频率, 时长, 波形, 音量, 延迟, 滑向频率)
   *     浏览器自动播放策略：首次 pointerdown 时 resume 上下文
   * ================================================================ */
  let actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return actx;
  }
  window.addEventListener('pointerdown', () => {
    const a = audio();
    if (a && a.state === 'suspended') a.resume().catch(() => {});
  }, { passive: true });

  function tone(freq, dur, type, vol, delay, slideTo) {
    const a = audio(); if (!a) return;
    const t0 = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || .2, t0);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);   // 指数衰减=自然余音
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + .03);
  }
  function sndReady() {
    if (!soundOn) return false;
    const a = audio(); if (!a) return false;
    if (a.state === 'suspended') a.resume().catch(() => {});
    return a.state === 'running';
  }
  // 落子：低频“嗒” + 高频脆响，黑白异色不同音高
  function sndStone(isBlack) {
    if (!sndReady()) return;
    tone(isBlack ? 235 : 305, .1, 'sine', .5, 0, isBlack ? 105 : 145);
    tone(isBlack ? 900 : 1250, .03, 'triangle', .14);
  }
  function sndClick() { if (sndReady()) tone(680, .05, 'triangle', .12); }
  function sndWin()  { [523, 659, 784, 1047].forEach((f, i) => tone(f, .3, 'triangle', .22, i * .12)); tone(1319, .5, 'sine', .16, .5); }
  function sndLose() { [392, 311, 262].forEach((f, i) => tone(f, .32, 'sine', .2, i * .17)); }
  function sndDraw() { [440, 440].forEach((f, i) => tone(f, .2, 'sine', .16, i * .22)); }
  function sndWrong() { if (sndReady()) { tone(220, .12, 'square', .12); tone(180, .16, 'square', .1, .1); } }

  /* ================================================================
   * [4] AI 台词 —— 在 doMove 前对局面做轻量分析，命中即触发
   *     优先级：堵五 > 成四 > 对方活四 > 成三
   * ================================================================ */
  function aiSay(text) {
    if (!text) return;
    bubble.textContent = '「' + text + '」';
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 2800);
  }

  /* ================================================================
   * [5] 对局状态与流程
   * ================================================================ */
  let board, history, turn, playing, aiThinking, winCells, gameToken = 0;
  let playerColor, aiColor, aiThinkMs = 0;
  let hover = null, hintCell = null;
  let pulse = 0, loopOn = false, loopPending = false;   // rAF 主循环状态
  const dropAnims = new Map();                          // 落子动画: 棋盘下标 -> 起始时刻
  let gameStart = 0, timerIv = null, bubbleTimer = null;
  let soundOn = localStorage.getItem('wuziqi-sound') !== '0';

  // 常驻记分（跨会话）
  let scores = loadScores();
  let streak = Number(localStorage.getItem('wuziqi-streak') || 0) || 0;
  function loadScores() {
    try { return JSON.parse(localStorage.getItem('wuziqi-scores')) || { p: 0, a: 0, d: 0 }; }
    catch (e) { return { p: 0, a: 0, d: 0 }; }
  }
  function saveScores() { try { localStorage.setItem('wuziqi-scores', JSON.stringify(scores)); } catch (e) {} }
  function saveStreak() { try { localStorage.setItem('wuziqi-streak', String(streak)); } catch (e) {} }

  // 本页会话统计（成就判定用，刷新即重置）
  const session = { games: 0, beatHard: false, fastWin: false };

  // 模式：'match' 人机对弈 | 'puzzle' 残局 | 'replay' 复盘
  let mode = 'match';
  let puzzleIndex = -1, puzzleSolved = false, puzzleStart = 0, puzzlePlaced = null, wrongMark = null;
  let matchSnapshot = null;          // 进残局前保存的对局现场
  let replayIdx = 0;                 // 复盘播放位置（history 前缀长度）

  function newGame() {
    gameToken++;                     // 令牌递增使未决 AI 回调失效
    mode = 'match';
    board = G.createBoard();
    history = [];
    winCells = null; hintCell = null; hover = null;
    dropAnims.clear();
    playing = true; aiThinking = false; aiThinkMs = 0;
    playerColor = $('firstColor').value === 'player' ? G.BLACK : G.WHITE;
    aiColor = 3 - playerColor;
    turn = G.BLACK;                  // 五子棋黑先
    overlay.classList.remove('show');
    $('confetti').innerHTML = '';
    resultSub.textContent = '';
    $('settleRow').innerHTML = '';
    $('resultAch').textContent = '';
    $('againBtn').textContent = '再来一局';
    $('replayBtn').hidden = false;
    bubble.classList.remove('show');
    hideReplayBar();
    gameStart = Date.now();
    clearInterval(timerIv); timerIv = setInterval(tick, 500); tick();
    updatePanel(); render();
    if (turn === aiColor) scheduleAI();
  }

  // 计时/局面信息行（对弈时每 500ms 刷新；残局/复盘有各自的展示逻辑）
  function tick() {
    if (mode !== 'match') return;
    const last = history[history.length - 1];
    let meta = '第 ' + history.length + ' 手 · ' + fmt(Date.now() - gameStart);
    if (last) meta += ' · 上一手 ' + (last.role === G.BLACK ? '黑' : '白') + ' ' + notation(last.x, last.y);
    moveMeta.textContent = meta;
  }

  // 落子（对弈模式唯一的写盘入口；残局另有 puzzleTap）
  function doMove(x, y, role) {
    board[G.idx(x, y)] = role;
    history.push({ x, y, role });
    dropAnims.set(G.idx(x, y), performance.now());
    ensureLoop();
    sndStone(role === G.BLACK);
    haptic(12);
    const wl = G.winLineAt(board, x, y);
    if (wl) { winCells = wl; endGame(role); }
    else if (history.length >= SIZE * SIZE) endGame(0);   // 满盘判和
    else turn = 3 - role;
    render(); updatePanel();
  }

  // 玩家输入统一入口：按模式分发
  function playerMove(x, y) {
    if (mode === 'puzzle') { puzzleTap(x, y); return; }
    if (!playing || aiThinking || turn !== playerColor) return;
    if (board[G.idx(x, y)] !== G.EMPTY) return;
    hintCell = null;
    doMove(x, y, playerColor);
    if (playing && turn === aiColor) scheduleAI();
  }

  // AI 回合：延迟 160ms 落子（观感上像思考）；token 防止新局后旧回调生效
  function scheduleAI() {
    if (mode !== 'match') return;
    const token = gameToken;
    aiThinking = true; updatePanel(); render();
    setTimeout(function () {
      const t0 = performance.now();
      const level = $('difficulty').value;
      const mv = G.bestMove(board, aiColor, level);
      aiThinkMs = performance.now() - t0;
      if (token !== gameToken) return;
      aiThinking = false;
      if (!playing) { updatePanel(); return; }
      // 台词触发：落子前分别分析「我方在此点」「对方在此点」的棋型价值
      const a = G.analyzePoint(board, mv.x, mv.y, aiColor);
      const d = G.analyzePoint(board, mv.x, mv.y, playerColor);
      if (d.five) aiSay(pick(LINES.blockFive));                     // 正在堵对方成五
      else if (a.liveFour || a.score >= 60000) aiSay(pick(LINES.aiFour));
      else if (d.liveFour) aiSay(pick(LINES.playerFour));
      else if (a.score >= 50000) aiSay(pick(LINES.aiThree));
      doMove(mv.x, mv.y, aiColor);
    }, 160);
  }

  /* ================================================================
   * [6] 结算与经济
   * ================================================================ */
  function endGame(winnerRole) {
    playing = false; aiThinking = false;
    clearInterval(timerIv);
    tick();
    const achBefore = new Set(Object.keys(career.ach));   // 用于结算面板展示新成就
    session.games++;

    const elapsed = Date.now() - gameStart;
    const sub = '用时 ' + fmt(elapsed) + ' · 共 ' + history.length + ' 手';
    // 结算副语：随机的、像人写的短评（游戏『人味』的一部分）
    const FLAVOR = {
      aiLose: ['干净利落。', 'AI 复盘去了。', '教科书式对局。', '这就是实力。'],
      aiWin: ['这局是学习。', 'AI 有点东西。', '复盘找找问题。', '下局翻盘。'],
      draw: ['不分伯仲。', '和棋，各自保留意见。', '势均力敌的一局。'],
    };
    const level = $('difficulty').value;
    let resultStr, key, rankD, coinD;
    const settled = [];

    if (winnerRole === 0) {                       // 和棋
      scores.d++; streak = 0;
      resultStr = '和棋'; key = 'draw';
      rankD = RANK_GAIN.draw; coinD = COIN_GAIN.draw;
    } else if (winnerRole === playerColor) {      // 玩家胜
      scores.p++; streak++;
      resultStr = '你赢了'; key = 'aiLose';
      rankD = RANK_GAIN.win[level]; coinD = COIN_GAIN.win[level];
      if (level === 'hard') session.beatHard = true;
      if (history.length <= 30) session.fastWin = true;
      career.stats.wins++;
      if (!career.stats.fastestWin || history.length < career.stats.fastestWin) {
        career.stats.fastestWin = history.length;
      }
      throwConfetti();
    } else {                                      // AI 胜
      scores.a++; streak = 0;
      resultStr = 'AI 胜'; key = 'aiWin';
      rankD = RANK_GAIN.loss; coinD = COIN_GAIN.loss;
      career.stats.losses++;
    }
    career.stats.games++;
    career.stats.draws += (winnerRole === 0 ? 1 : 0);
    career.stats.coinsEarned += coinD;

    resultText.textContent = resultStr;
    resultSub.textContent = sub + ' · ' + pick(FLAVOR[key]);
    // 终局 juice：胜利白闪 + 重震（失败轻震），连胜里程碑弹浮字
    if (winnerRole === playerColor) {
      boardCard.classList.remove('flash'); void boardCard.offsetWidth;
      boardCard.classList.add('flash', 'shake-hard');
      streakCallout(streak);
      setTimeout(() => boardCard.classList.remove('flash', 'shake-hard'), 900);
    } else if (winnerRole !== 0) {
      boardCard.classList.remove('shake'); void boardCard.offsetWidth;
      boardCard.classList.add('shake');
      setTimeout(() => boardCard.classList.remove('shake'), 600);
    }
    if (key === 'draw') sndDraw(); else if (key === 'aiLose') sndWin(); else sndLose();
    aiSay(pick(LINES[key]));

    // 段位/金币结算（内部各自触发成就检查与 Toast）
    const ranks = addRank(rankD);
    addCoins(coinD);
    settled.push({ t: '段位 ' + (rankD >= 0 ? '+' : '') + rankD, cls: '' });
    if (ranks.after > ranks.before) settled.push({ t: '晋升 ' + rankName(ranks.after), cls: 'promote' });
    settled.push({ t: '金币 +' + coinD, cls: 'gold' });
    $('settleRow').innerHTML = settled.map(s =>
      '<span class="settle-chip ' + s.cls + '">' + s.t + '</span>').join('');

    // 结算瞬间新解锁的成就展示在面板里
    checkAch();
    const fresh = Object.keys(career.ach).filter(id => !achBefore.has(id))
      .map(id => (ACH_DEFS.find(a => a[0] === id) || [])[1]);
    $('resultAch').textContent = fresh.length ? '成就解锁 · ' + fresh.join('、') : '';

    saveScores(); saveStreak(); saveCareer();
    setTimeout(function () { overlay.classList.add('show'); ensureLoop(); }, 500);
    updatePanel();
  }

  function addRank(n) {
    const before = rankOf(career.rank);
    career.rank = Math.max(0, career.rank + n);
    const after = rankOf(career.rank);
    saveCareer();
    updateCareerPanel();
    if (after > before) { toast('段位晋升 · ' + rankName(after)); sndWin(); }
    checkAch();
    return { before, after };
  }
  function addCoins(n, why) {
    if (!n) return;
    career.coins = Math.max(0, career.coins + n);
    if (n > 0) career.stats.coinsEarned += n;
    saveCareer();
    if (why) toast('金币 ' + (n > 0 ? '+' : '') + n + ' · ' + why);
    updateCareerPanel();
    checkAch();
  }

  function undo() {
    if (mode !== 'match') return;
    const minHist = playerColor === G.WHITE ? 1 : 0;   // AI 先行时保留其第一手
    if (aiThinking || history.length <= minHist) return;
    if (career.coins < COIN_COST.undo) { toast('金币不足 · 赢棋可赚金币'); return; }
    addCoins(-COIN_COST.undo, '悔棋');
    while (history.length > minHist) {
      const m = history.pop();
      board[G.idx(m.x, m.y)] = G.EMPTY;
      dropAnims.delete(G.idx(m.x, m.y));
      if (m.role === playerColor) break;               // 撤回到玩家上一手之前
    }
    winCells = null; hintCell = null; playing = true; turn = playerColor;
    overlay.classList.remove('show'); $('confetti').innerHTML = '';
    sndClick();
    render(); updatePanel();
  }

  function hint() {
    if (mode !== 'match') return;
    if (!(playing && !aiThinking && turn === playerColor)) return;
    if (career.coins < COIN_COST.hint) { toast('金币不足 · 赢棋可赚金币'); return; }
    addCoins(-COIN_COST.hint, '提示');
    const mv = G.bestMove(board, playerColor, $('difficulty').value);
    hintCell = mv; sndClick(); render();
    setTimeout(function () { hintCell = null; render(); }, 1800);
  }

  function throwConfetti() {
    const box = $('confetti'); box.innerHTML = '';
    const colors = ['#a63c2f', '#c9962e', '#2f6f4f', '#3b5b92', '#8a5fb0', '#c95d2c', '#f7f2e7'];
    for (let i = 0; i < 60; i++) {
      const s = document.createElement('span');
      s.className = 'confetti';
      s.style.left = (Math.random() * 100).toFixed(1) + '%';
      s.style.background = colors[(Math.random() * colors.length) | 0];
      s.style.animationDuration = (1.8 + Math.random() * 1.6).toFixed(2) + 's';
      s.style.animationDelay = (Math.random() * .7).toFixed(2) + 's';
      s.style.transform = 'rotate(' + ((Math.random() * 360) | 0) + 'deg)';
      if (Math.random() < .4) s.style.borderRadius = '50%';
      box.appendChild(s);
    }
  }

  /* ================================================================
   * [7] 残局挑战
   *     题库 puzzles.js 由 tools/gen-puzzles.js 生成，
   *     每题已验证：杀点唯一、对方无杀。此处只负责出题与判题。
   * ================================================================ */
  function renderPuzzleGrid() {
    const grid = $('puzzleGrid');
    grid.innerHTML = '';
    let cleared = 0;
    PUZZLES.forEach((p, i) => {
      const stars = career.puzzles[p.id] || 0;
      if (stars > 0) cleared++;
      const b = document.createElement('button');
      b.className = 'pz' + (stars > 0 ? ' done' : '') + (i === puzzleIndex ? ' active' : '');
      b.innerHTML = String(i + 1) + '<div class="stars">' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '</div>';
      b.addEventListener('click', () => enterPuzzle(i));
      grid.appendChild(b);
    });
    $('puzzleHead').textContent = '共 ' + PUZZLES.length + ' 题，已破解 ' + cleared + ' 题。黑为●，白为○。';
    renderDailyBanner(cleared);
  }

  // 每日残局：按日期稳定映射到某题（不依赖随机），首破金币翻倍
  function dailyIndex() {
    const d = new Date();
    const seed = d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
    return seed % PUZZLES.length;
  }
  function renderDailyBanner(cleared) {
    const di = dailyIndex();
    const doneToday = career.daily.date === new Date().toDateString() && career.daily.id === di;
    $('dailyBanner').innerHTML =
      '<span>今日残局 · 第 ' + (di + 1) + ' 题' + (doneToday ? ' <b class="done-tag">已完成</b>' : ' · 金币翻倍') + '</span>' +
      '<button class="dbtn" id="dailyBtn">' + (doneToday ? '再战' : '挑战') + '</button>';
    $('dailyBtn').addEventListener('click', () => enterPuzzle(di, true));
    void cleared;
  }

  // 进入残局：先快照当前对局（若在 match 模式），以便无损返回
  function enterPuzzle(i, isDaily) {
    if (mode === 'replay') exitReplay();
    if (mode === 'match') {
      matchSnapshot = {
        board: board.slice(), history: history.slice(),
        turn, playing, winCells: winCells ? winCells.slice() : null,
        gameStart, playerColor, aiColor,
      };
      gameToken++;                       // 作废未决 AI 回调
      aiThinking = false;
      clearInterval(timerIv);
    }
    mode = 'puzzle';
    puzzleIndex = i; puzzleSolved = false; puzzlePlaced = null; wrongMark = null;
    puzzleIsDaily = !!isDaily;
    const p = PUZZLES[i];
    board = G.createBoard();
    for (const [x, y, r] of p.stones) board[G.idx(x, y)] = r;
    dropAnims.clear();
    winCells = null; hintCell = null; hover = null;
    puzzleStart = Date.now();
    overlay.classList.remove('show');
    $('confetti').innerHTML = '';
    switchTab('puzzle');
    hideReplayBar();
    updatePanel(); render(); renderPuzzleGrid();
  }
  let puzzleIsDaily = false;

  // 从残局返回对局：还原快照；无快照则开新局
  function returnToMatch() {
    if (!matchSnapshot) { newGame(); switchTab('match'); return; }
    mode = 'match';
    board = matchSnapshot.board;
    history = matchSnapshot.history;
    turn = matchSnapshot.turn;
    playing = matchSnapshot.playing;
    winCells = matchSnapshot.winCells;
    playerColor = matchSnapshot.playerColor;
    aiColor = matchSnapshot.aiColor;
    gameStart = matchSnapshot.gameStart;
    puzzleIndex = -1; puzzleSolved = false; puzzlePlaced = null; wrongMark = null;
    puzzleIsDaily = false;
    dropAnims.clear();
    overlay.classList.remove('show'); $('confetti').innerHTML = '';
    clearInterval(timerIv); timerIv = setInterval(tick, 500); tick();
    switchTab('match');
    updatePanel(); render(); renderPuzzleGrid();
    if (playing && turn === aiColor && !winCells) scheduleAI();
  }

  // 残局判题：命中唯一杀点即破解；错点 shake + 打叉
  function puzzleTap(x, y) {
    if (puzzleSolved) return;
    const p = PUZZLES[puzzleIndex];
    if (!p) return;
    if (board[G.idx(x, y)] !== G.EMPTY) return;
    if (x === p.answer[0] && y === p.answer[1]) {
      puzzleSolved = true;
      puzzlePlaced = { x, y };
      board[G.idx(x, y)] = G.BLACK;
      const elapsed = (Date.now() - puzzleStart) / 1000;
      const stars = elapsed < 6 ? 3 : (elapsed < 15 ? 2 : 1);
      const first = !career.puzzles[p.id];
      let coins = first ? 8 + (stars === 3 ? 4 : (stars === 2 ? 2 : 0)) : 2;
      if (puzzleIsDaily && first) coins *= 2;           // 每日首破翻倍
      career.puzzles[p.id] = Math.max(career.puzzles[p.id] || 0, stars);
      if (career.daily.date !== new Date().toDateString() || career.daily.id !== p.id) {
        career.daily = { date: new Date().toDateString(), id: p.id };
      }
      saveCareer();
      winCells = G.winLineAt(board, x, y);              // win 型题目会真的连五
      sndWin(); haptic([15, 40, 15]);
      throwConfetti();
      aiSay(pick(LINES.puzzleOK));
      addCoins(coins);
      checkAch();
      const roleTxt = p.type === 'win' ? '一步制胜' : '成功防守';
      resultText.textContent = '破解成功';
      resultSub.textContent = '第 ' + (puzzleIndex + 1) + ' 题 · ' + roleTxt +
        ' · 用时 ' + elapsed.toFixed(1) + ' 秒 · ' + '★'.repeat(stars);
      $('settleRow').innerHTML =
        '<span class="settle-chip gold">金币 +' + coins + (first ? (puzzleIsDaily ? ' · 每日首破翻倍' : ' · 首破') : '') + '</span>' +
        '<span class="settle-chip">' + '★'.repeat(stars) + '</span>';
      $('resultAch').textContent = '';
      $('againBtn').textContent = '下一题';
      $('replayBtn').hidden = true;                     // 残局无复盘
      setTimeout(() => { overlay.classList.add('show'); ensureLoop(); }, 450);
      renderPuzzleGrid();
      render();
    } else {
      wrongMark = { x, y };
      sndWrong(); haptic(40);
      boardCard.classList.remove('shake');
      void boardCard.offsetWidth;                       // 强制重排以重启动画
      boardCard.classList.add('shake');
      aiSay(pick(LINES.puzzleBad));
      ensureLoop();
      setTimeout(() => { wrongMark = null; render(); }, 700);
      render();
    }
  }

  /* ================================================================
   * [8] 复盘系统 —— 终局后逐手回放，键盘 ←/→ 亦可用
   * ================================================================ */
  function enterReplay() {
    if (mode !== 'match' || playing || !history.length) return;
    mode = 'replay';
    replayIdx = 0;
    winCells = null;                     // 回放过程隐藏胜利线，走完全程再显示
    hintCell = null; hover = null;
    showReplayBar();
    overlay.classList.remove('show');
    render(); updatePanel();
  }
  function replayStep(d) {
    if (mode !== 'replay') return;
    replayIdx = Math.max(0, Math.min(history.length, replayIdx + d));
    if (replayIdx > 0) {
      const m = history[replayIdx - 1];
      dropAnims.set(G.idx(m.x, m.y), performance.now());   // 回放同样带落子动画
      sndStone(m.role === G.BLACK);
    }
    ensureLoop(); updateReplayBar(); render();
  }
  function exitReplay() {
    if (mode !== 'replay') return;
    mode = 'match';
    winCells = history.length ? G.winLineAt(board,
      history[history.length - 1].x, history[history.length - 1].y) : null;
    hideReplayBar();
    overlay.classList.add('show');
    updatePanel(); render(); ensureLoop();
  }
  function showReplayBar() {
    $('replayBar').classList.add('show');
    $('undoBtn').disabled = true; $('hintBtn').disabled = true;
    updateReplayBar();
  }
  function hideReplayBar() { $('replayBar').classList.remove('show'); }
  function updateReplayBar() {
    $('replayText').textContent = '第 ' + replayIdx + ' / ' + history.length + ' 手' +
      (replayIdx > 0 ? ' · ' + (history[replayIdx - 1].role === G.BLACK ? '黑' : '白') + ' ' +
        notation(history[replayIdx - 1].x, history[replayIdx - 1].y) : '');
  }

  /* ================================================================
   * [9] 渲染 —— Canvas 绘制，配色由当前皮肤 (SKINS) 参数化
   * ================================================================ */
  function currentSkin() {
    return SKINS.find(s => s.id === career.skin) || SKINS[0];
  }
  function render() {
    const skin = currentSkin();
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // 棋盘底色（三段渐变模拟光照）
    const g = ctx.createLinearGradient(0, 0, W, W);
    g.addColorStop(0, skin.board[0]); g.addColorStop(.5, skin.board[1]); g.addColorStop(1, skin.board[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
    // 木质/材质纹路
    ctx.strokeStyle = skin.grain; ctx.lineWidth = 1;
    for (let k = 0; k < 26; k++) {
      const r = Math.abs(Math.sin(k * 127.1 + 31.7) * 43758.5) % 1;
      const y = 12 + r * (W - 24);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * .3, y + (r - .5) * 14, W * .7, y - (r - .5) * 14, W, y + (r - .5) * 8);
      ctx.stroke();
    }
    // 网格（外框略粗）
    ctx.strokeStyle = skin.line;
    for (let i = 0; i < SIZE; i++) {
      ctx.lineWidth = (i === 0 || i === SIZE - 1) ? 1.8 : 1;
      const p = PAD + i * CELL;
      ctx.beginPath(); ctx.moveTo(PAD, p); ctx.lineTo(W - PAD, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, PAD); ctx.lineTo(p, W - PAD); ctx.stroke();
    }
    // 星位（天元 + 四星）
    ctx.fillStyle = skin.star;
    [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].forEach(([sx, sy]) => {
      ctx.beginPath(); ctx.arc(PAD + sx * CELL, PAD + sy * CELL, 3.4, 0, Math.PI * 2); ctx.fill();
    });
    // 坐标（列字母 / 行数字）
    ctx.fillStyle = skin.coord;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < SIZE; i++) {
      ctx.fillText(COLS[i], PAD + i * CELL, W - PAD + 21);
      ctx.fillText(String(SIZE - i), PAD - 21, PAD + i * CELL);
    }
    // 棋子：对弈/复盘 = history 前缀；残局 = 题面 + 已落答案子
    let stones;
    if (mode === 'puzzle') {
      stones = (PUZZLES[puzzleIndex] ? PUZZLES[puzzleIndex].stones.slice() : []);
      if (puzzlePlaced) stones.push([puzzlePlaced.x, puzzlePlaced.y, G.BLACK]);
    } else {
      stones = history.slice(0, mode === 'replay' ? replayIdx : history.length)
                      .map(m => [m.x, m.y, m.role]);
    }
    for (const [x, y, role] of stones) drawStone(x, y, role, 1);
    // 最后一手标记（复盘时标记到回放位置）
    const lastM = mode === 'replay'
      ? (replayIdx > 0 ? history[replayIdx - 1] : null)
      : history[history.length - 1];
    if (lastM && !winCells && !dropAnims.has(G.idx(lastM.x, lastM.y))) {
      const cx = PAD + lastM.x * CELL, cy = PAD + lastM.y * CELL;
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#c0392b'; ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
    }
    // 胜利连线（呼吸发光）
    if (winCells) {
      const pts = winCells.map(i => ({ x: i % SIZE, y: (i / SIZE) | 0 }))
                          .sort((a, b) => (a.x - b.x) || (a.y - b.y));
      const p0 = pts[0], p1 = pts[pts.length - 1];
      const a = 0.55 + 0.35 * Math.sin(pulse);
      ctx.save();
      ctx.strokeStyle = 'rgba(166,60,47,' + a.toFixed(3) + ')';
      ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(166,60,47,.9)'; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(PAD + p0.x * CELL, PAD + p0.y * CELL);
      ctx.lineTo(PAD + p1.x * CELL, PAD + p1.y * CELL);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (const p of pts) {
        ctx.beginPath(); ctx.arc(PAD + p.x * CELL, PAD + p.y * CELL, CELL * .5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    // 悬停预览（桌面端，对弈模式且轮到玩家）
    if (mode === 'match' && hover && playing && !aiThinking && turn === playerColor &&
        board[G.idx(hover.x, hover.y)] === G.EMPTY) {
      drawStone(hover.x, hover.y, playerColor, 0.38);
    }
    // 提示标记（绿色圆环）
    if (hintCell) {
      const cx = PAD + hintCell.x * CELL, cy = PAD + hintCell.y * CELL;
      ctx.save();
      ctx.strokeStyle = '#2f6f4f'; ctx.lineWidth = 3.5;
      ctx.shadowColor = 'rgba(47,111,79,.8)'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy, CELL * .42, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // 残局错点标记（朱砂叉）
    if (wrongMark) {
      const cx = PAD + wrongMark.x * CELL, cy = PAD + wrongMark.y * CELL, r = CELL * .3;
      ctx.save();
      ctx.strokeStyle = 'rgba(166,60,47,.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // 落子动画缓动：回弹式放大（easeOutBack）
  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function drawStone(x, y, role, alpha) {
    const key = G.idx(x, y);
    let scale = 1;
    if (dropAnims.has(key)) {
      const t = (performance.now() - dropAnims.get(key)) / 240;
      if (t >= 1) dropAnims.delete(key);
      else {
        scale = .25 + .75 * easeOutBack(Math.min(1, t));
        alpha *= .45 + .55 * t;
        loopPending = true;
      }
    }
    const skin = currentSkin();
    const cx = PAD + x * CELL, cy = PAD + y * CELL, R = CELL * 0.44 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (alpha === 1) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2; }
    const g = ctx.createRadialGradient(cx - R * .35, cy - R * .35, R * .1, cx, cy, R);
    if (role === G.BLACK) { g.addColorStop(0, '#646b7a'); g.addColorStop(1, '#0b0d12'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c6cad3'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    // 深色棋盘上黑子补一圈浅描边，保证可辨识
    if (role === G.BLACK && skin.dark) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke(); }
    if (role === G.WHITE) { ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
  }

  // rAF 主循环：仅在有动画（落子/胜利线呼吸）时运转，空闲零耗电
  function ensureLoop() {
    if (loopOn) return;
    loopOn = true;
    (function frame() {
      let busy = false;
      if (winCells) { pulse += 0.09; busy = true; }
      loopPending = false;
      render();
      if (loopPending) busy = true;
      if (busy) requestAnimationFrame(frame);
      else loopOn = false;
    })();
  }

  /* ================================================================
   * [10] 面板刷新 / 成就 / 分享 / 输入与事件绑定
   * ================================================================ */
  function updateCareerPanel() {
    const idx = rankOf(career.rank);
    const cur = RANKS[idx][1];
    const next = idx + 1 < RANKS.length ? RANKS[idx + 1][1] : null;
    $('rankBadge').textContent = rankName(idx);
    $('rankBadge').style.background = RANKS[idx][2];
    if (next != null) {
      $('rankBar').style.width = Math.min(100, (career.rank - cur) / (next - cur) * 100).toFixed(1) + '%';
      $('rankText').textContent = career.rank + ' / ' + next;
    } else {
      $('rankBar').style.width = '100%';
      $('rankText').textContent = career.rank + ' · 已至最高';
    }
    $('coinChip').textContent = '金币 ' + career.coins;
  }

  function updatePanel() {
    const thinking = aiThinking && mode === 'match';
    $('turnRow').classList.toggle('thinking', thinking);
    if (mode === 'puzzle') {
      const p = PUZZLES[puzzleIndex];
      statusText.textContent = '残局 · 第 ' + (puzzleIndex + 1) + ' 题';
      subStatus.textContent = p ? p.desc : '';
      turnDot.className = 'stone-dot black';
      moveMeta.textContent = puzzleSolved ? '已破解'
        : ('用时 ' + ((Date.now() - puzzleStart) / 1000).toFixed(0) + ' 秒');
      $('undoBtn').disabled = true;
      $('hintBtn').disabled = true;
    } else if (mode === 'replay') {
      statusText.textContent = '复盘';
      subStatus.textContent = '使用左右箭头或按钮逐手回放';
      turnDot.className = 'stone-dot black';
      $('undoBtn').disabled = true;
      $('hintBtn').disabled = true;
    } else if (!playing) {
      const won = winCells && board[G.idx(winCells[0])] === playerColor;
      statusText.textContent = won ? '你赢了' : (winCells ? 'AI 获胜' : '和棋');
      subStatus.textContent = '可复盘本局，或再来一局';
      turnDot.className = 'stone-dot ' + (winCells ? (board[G.idx(winCells[0])] === G.BLACK ? 'black' : 'white') : 'black');
      $('undoBtn').disabled = true;
      $('hintBtn').disabled = true;
    } else if (thinking) {
      statusText.textContent = 'AI 思考中';
      subStatus.textContent = '评估局面……';
      turnDot.className = 'stone-dot ' + (aiColor === G.BLACK ? 'black' : 'white');
      $('undoBtn').disabled = true;
      $('hintBtn').disabled = true;
    } else {
      statusText.textContent = '轮到你了';
      subStatus.textContent = '执' + (playerColor === G.BLACK ? '黑先行' : '白后手') + '，点击交叉点落子';
      turnDot.className = 'stone-dot ' + (playerColor === G.BLACK ? 'black' : 'white');
      const minHist = playerColor === G.WHITE ? 1 : 0;
      $('undoBtn').disabled = history.length <= minHist || career.coins < COIN_COST.undo;
      $('hintBtn').disabled = turn !== playerColor || career.coins < COIN_COST.hint;
    }
    tick();
    $('scoreP').textContent = scores.p;
    $('scoreA').textContent = scores.a;
    $('scoreD').textContent = scores.d;
    const st = $('streakRow');
    if (streak >= 2) { st.style.display = 'inline-block'; st.textContent = '连胜 ' + streak + ' 场'; }
    else st.style.display = 'none';
    updateCareerPanel();
  }

  // 成就判定：所有条件集中在 achProgress，checkAch 统一扫描并解锁
  function achProgress(id) {
    const cleared = Object.keys(career.puzzles).length;
    switch (id) {
      case 'first_game': return career.stats.games >= 1;
      case 'first_win': return career.stats.wins >= 1;
      case 'streak3': return streak >= 3;
      case 'streak5': return streak >= 5;
      case 'beat_hard': return session.beatHard;
      case 'rank_gold': return rankOf(career.rank) >= 2;
      case 'fast_win': return session.fastWin;
      case 'puzzle5': return cleared >= 5;
      case 'puzzle_all': return PUZZLES.length > 0 && cleared >= PUZZLES.length;
      case 'rich': return career.coins >= 100;
      default: return false;
    }
  }
  function checkAch() {
    for (const [id, name] of ACH_DEFS) {
      if (career.ach[id]) continue;
      if (achProgress(id)) {
        career.ach[id] = 1;
        saveCareer();
        toast('成就解锁 · ' + name);
        renderAch();
      }
    }
  }
  function renderAch() {
    const box = $('achList');
    box.innerHTML = '';
    for (const [id, name, desc] of ACH_DEFS) {
      const done = !!career.ach[id];
      const d = document.createElement('div');
      d.className = 'ach' + (done ? '' : ' locked');
      d.innerHTML = '<div class="medal">' + name[0] + '</div>' +
        '<div><div class="t">' + name + '</div><div class="d">' + desc + '</div></div>' +
        (done ? '<div class="ok">已达成</div>' : '');
      box.appendChild(d);
    }
    renderStats();
  }
  // 生涯统计（成就页底部）
  function renderStats() {
    const s = career.stats;
    const rate = s.games ? Math.round(s.wins / s.games * 100) : 0;
    $('statsGrid').innerHTML =
      '<span class="k">总对局</span><span class="v">' + s.games + '</span>' +
      '<span class="k">总胜率</span><span class="v">' + rate + '%</span>' +
      '<span class="k">最快取胜</span><span class="v">' + (s.fastestWin ? s.fastestWin + ' 手' : '—') + '</span>' +
      '<span class="k">累计金币</span><span class="v">' + s.coinsEarned + '</span>';
  }

  // 分享：优先系统分享，降级剪贴板
  function shareResult() {
    const idx = rankOf(career.rank);
    const text = '我在「五子棋 · 连珠」的战绩：段位 ' + rankName(idx) +
      '（' + career.rank + ' 分）· 连胜 ' + streak + ' 场 · 已破解 ' +
      Object.keys(career.puzzles).length + '/' + PUZZLES.length + ' 道残局。来和我比比？';
    if (navigator.share) navigator.share({ title: '五子棋 · 连珠', text }).catch(() => {});
    else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('战绩已复制，去粘贴给朋友吧')).catch(() => toast(text));
    } else toast(text.slice(0, 60) + '……');
  }

  /* ---------------- 皮肤 ---------------- */
  function renderSkins() {
    const row = $('skinRow');
    row.innerHTML = '';
    for (const s of SKINS) {
      const owned = career.skins.includes(s.id);
      const b = document.createElement('button');
      b.className = 'skin-swatch' + (career.skin === s.id ? ' active' : '') + (owned ? ' owned' : '');
      b.style.setProperty('--c1', s.board[0]);
      b.style.setProperty('--c2', s.board[2]);
      b.innerHTML = '<span class="chip"></span>' + s.name +
        '<span class="price">' + (owned ? (career.skin === s.id ? '使用中' : '点击使用') : s.cost + ' 金币') + '</span>';
      b.addEventListener('click', () => {
        if (career.skin === s.id) return;
        if (!owned) {
          if (career.coins < s.cost) { toast('金币不足 · 还差 ' + (s.cost - career.coins)); return; }
          addCoins(-s.cost, '解锁「' + s.name + '」棋盘');
          career.skins.push(s.id);
        }
        career.skin = s.id;
        saveCareer();
        sndClick();
        renderSkins();
        render();
      });
      row.appendChild(b);
    }
  }

  /* ---------------- 标签页 ---------------- */
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $('tab-match').hidden = name !== 'match';
    $('tab-puzzle').hidden = name !== 'puzzle';
    $('tab-ach').hidden = name !== 'ach';
    if (name === 'puzzle') renderPuzzleGrid();
    if (name === 'ach') renderAch();
  }

  /* ---------------- 事件绑定 ---------------- */
  const boardCard = $('boardCard');
  // 屏幕坐标 → 棋盘交叉点（带 0.48 格吸附半径）
  function eventToCell(e) {
    const r = cv.getBoundingClientRect();
    const scale = W / r.width;
    const px = (e.clientX - r.left) * scale;
    const py = (e.clientY - r.top) * scale;
    const x = Math.round((px - PAD) / CELL), y = Math.round((py - PAD) / CELL);
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return null;
    if (Math.hypot(px - (PAD + x * CELL), py - (PAD + y * CELL)) > CELL * 0.48) return null;
    return { x, y };
  }
  cv.addEventListener('click', e => { const c = eventToCell(e); if (c) playerMove(c.x, c.y); });
  cv.addEventListener('mousemove', e => {
    if (mode !== 'match') return;
    const c = eventToCell(e);
    if ((c && (!hover || hover.x !== c.x || hover.y !== c.y)) || (!c && hover)) { hover = c; render(); }
  });
  cv.addEventListener('mouseleave', () => { if (hover) { hover = null; render(); } });
  // 键盘快捷键 —— 独立开发者给游戏配键盘操作的惯例
  //   N 新对局 · U 悔棋 · H 提示 · M 音效 · R 复盘(终局) · ←/→ 复盘 · Esc 退出 · 空格 关闭开场
  document.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // 开场画面：空格或回车开始
    if (!$('intro').classList.contains('hide')) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        $('introStart').click();
      }
      return;
    }
    // 复盘模式专属
    if (mode === 'replay') {
      if (e.key === 'ArrowLeft') replayStep(-1);
      if (e.key === 'ArrowRight') replayStep(1);
      if (e.key === 'Escape') exitReplay();
      return;
    }
    switch (e.key.toLowerCase()) {
      case 'n': sndClick(); newGame(); break;
      case 'u': undo(); break;
      case 'h': hint(); break;
      case 'm': $('soundBtn').click(); break;
      case 'r': if (!playing && mode === 'match' && history.length) { sndClick(); enterReplay(); } break;
      default: return;
    }
    e.preventDefault();
  });

  // 连胜里程碑浮字：贴着棋盘弹起飘散（游戏 juice 的一部分）
  const STREAK_CALLOUTS = { 2: '手感来了', 3: '三连胜', 5: '五连胜 · 无人能挡', 8: '杀疯了' };
  function streakCallout(n) {
    const text = STREAK_CALLOUTS[n] || (n > 8 ? STREAK_CALLOUTS[8] : null);
    if (!text) return;
    const c = document.createElement('div');
    c.className = 'callout serif';
    c.textContent = text;
    boardCard.appendChild(c);
    setTimeout(() => c.remove(), 1500);
  }

  $('newBtn').addEventListener('click', () => { sndClick(); newGame(); });
  $('againBtn').addEventListener('click', () => {
    sndClick();
    if (mode === 'puzzle') enterPuzzle((puzzleIndex + 1) % PUZZLES.length, puzzleIsDaily);
    else newGame();
  });
  $('replayBtn').addEventListener('click', () => { sndClick(); enterReplay(); });
  $('shareBtn').addEventListener('click', shareResult);
  $('undoBtn').addEventListener('click', undo);
  $('hintBtn').addEventListener('click', hint);
  $('rPrev').addEventListener('click', () => replayStep(-1));
  $('rNext').addEventListener('click', () => replayStep(1));
  $('rEnd').addEventListener('click', () => { if (mode === 'replay') { replayIdx = history.length; replayStep(0); } });
  $('rClose').addEventListener('click', () => { sndClick(); exitReplay(); });
  $('soundBtn').addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem('wuziqi-sound', soundOn ? '1' : '0'); } catch (e) {}
    $('soundBtn').textContent = soundOn ? '音效 · 开' : '音效 · 关';
    if (soundOn) sndClick();
  });
  if (!soundOn) $('soundBtn').textContent = '音效 · 关';
  $('firstColor').addEventListener('change', newGame);
  $('resetScore').addEventListener('click', () => {
    scores = { p: 0, a: 0, d: 0 }; streak = 0; saveScores(); saveStreak(); updatePanel();
  });
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      if (t.dataset.tab === 'puzzle' && aiThinking) { toast('AI 思考中，稍候再试'); return; }
      if (t.dataset.tab === 'match' && mode === 'puzzle') { sndClick(); returnToMatch(); return; }
      sndClick();
      switchTab(t.dataset.tab);
    });
  });

  // 调试 / 自动化测试钩子（对 UI 无影响）
  window.__wuziqi = {
    state: () => ({
      playing, aiThinking, turn, playerColor, aiColor, moves: history.length,
      mode, puzzleIndex, coins: career.coins, rank: career.rank, streak,
      skins: career.skins, skin: career.skin,
    }),
    playerMove,
    // 自动对局：玩家侧由引擎代下，终局写入 autoplayResult
    autoplay(level) {
      const out = { done: false };
      this.autoplayResult = out;
      const timer = setInterval(() => {
        if (mode !== 'match' || !playing) {
          clearInterval(timer);
          out.done = true;
          out.moves = history.length;
          out.overlayShown = overlay.classList.contains('show');
          out.result = resultText.textContent;
          return;
        }
        if (!aiThinking && turn === playerColor) {
          const mv = G.bestMove(board, playerColor, level || 'easy');
          playerMove(mv.x, mv.y);
        }
      }, 40);
      return out;
    },
    _test: {
      celebrate() {
        resultText.textContent = '你赢了';
        resultSub.textContent = '特效预览';
        $('settleRow').innerHTML = '<span class="settle-chip">段位 +15</span><span class="settle-chip gold">金币 +18</span>';
        $('replayBtn').hidden = true;
        throwConfetti(); sndWin();
        overlay.classList.add('show'); ensureLoop();
      },
      say(t) { aiSay(t || '你好，我是五子棋 AI。'); },
      toast(t) { toast(t || '测试提示'); },
      puzzle(i) { enterPuzzle(i); },
      intro(t) { $('intro').classList.toggle('hide', !!t); },
    },
  };

  /* ---------------- 每日签到 ---------------- */
  (function signIn() {
    const key = new Date().toDateString();
    if (career.lastSignIn !== key) {
      career.lastSignIn = key;
      career.coins += SIGN_IN_COIN;
      saveCareer();
      setTimeout(() => toast('每日签到 · 金币 +' + SIGN_IN_COIN), 800);
    }
  })();

  /* ---------------- 开场标题画面 ---------------- */
  (function buildIntro() {
    const intro = $('intro');
    // 漂浮棋子装饰：随机大小/位置/时长的黑白圆
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'float-stone';
      const size = 14 + ((Math.random() * 30) | 0);
      s.style.width = s.style.height = size + 'px';
      s.style.left = (Math.random() * 100).toFixed(1) + '%';
      s.style.background = Math.random() < .5 ? '#0b0d12' : '#fff';
      s.style.animationDuration = (9 + Math.random() * 10).toFixed(1) + 's';
      s.style.animationDelay = (-Math.random() * 10).toFixed(1) + 's';
      if (Math.random() < .5) s.style.border = '1px solid rgba(0,0,0,.2)';
      intro.appendChild(s);
    }
    $('introStart').addEventListener('click', () => {
      sndClick();
      intro.classList.add('hide');
    });
  })();

  /* ================================================================
   * [11] 启动序列：开新局 → 刷新各面板 → 绑定完成
   * ================================================================ */
  const statusText = $('statusText'), subStatus = $('subStatus'), turnDot = $('turnDot');
  const overlay = $('overlay'), resultText = $('resultText'), resultSub = $('resultSub');
  const bubble = $('bubble'), moveMeta = $('moveMeta');

  newGame();
  updateCareerPanel();
  renderPuzzleGrid();
  renderAch();
  renderSkins();
  checkAch();
})();
