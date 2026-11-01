/*!
 * 五子棋 · 连珠 —— 应用层 (app.js)
 * ==================================================================
 * 职责：页面交互、渲染、音效、残局练习与复盘。
 * 依赖：game.js（纯逻辑引擎）、puzzles.js（程序生成并验证的题库）
 *
 * 设计立场：做减法。曾试过段位/金币/签到/成就一类元游戏系统，
 * 后来全部移除（见 README「设计取舍」）——好的棋类游戏只需要：
 *   一块好棋盘 + 一个不犯低级错误的 AI + 干净的交互。
 *
 * 模块分区：
 *   [0] 配置            —— 尺寸/皮肤/台词等静态数据
 *   [1] 本地存档        —— 各状态独立键，简单直接
 *   [2] 工具            —— 格式化/随机/Toast/震动
 *   [3] 音效            —— WebAudio 合成，零音频资源
 *   [4] AI 台词         —— 落子前轻量局面分析触发
 *   [5] 对局流程        —— 落子/胜负/悔棋/提示
 *   [6] 残局练习        —— 出题/判题/评星（纯练习，无奖励经济）
 *   [7] 复盘            —— 终局逐手回放
 *   [8] 渲染            —— Canvas（皮肤参数化、落子动画、胜利线）
 *   [9] 面板与输入      —— 面板刷新、快捷键、事件绑定
 *   [10] 启动序列
 * ==================================================================
 */
(function () {
  'use strict';

  const G = window.Gomoku;
  const PUZZLES = window.PUZZLES || [];
  const SIZE = G.SIZE;

  /* ================================================================
   * [0] 配置
   * ================================================================ */
  const $ = id => document.getElementById(id);
  const COLS = 'ABCDEFGHIJKLMNO';
  const notation = (x, y) => COLS[x] + (SIZE - y);

  // 逻辑坐标系：绘制与触控都基于 640x640，实际像素由 DPR 缩放
  const W = 640, PAD = 40, CELL = (W - 2 * PAD) / (SIZE - 1);
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const cv = $('board');
  const ctx = cv.getContext('2d');
  cv.width = W * DPR; cv.height = W * DPR;

  // 棋盘皮肤：纯审美切换，全部免费（dark 皮肤下黑子加浅描边）
  const SKINS = [
    { id: 'walnut', name: '胡桃木', dark: false,
      board: ['#e3b56f', '#d9aa62', '#cd9d55'], grain: 'rgba(120,80,30,.05)',
      line: 'rgba(92,64,30,.8)', star: 'rgba(70,48,22,.9)', coord: 'rgba(92,64,30,.85)' },
    { id: 'ink', name: '玄墨', dark: true,
      board: ['#343841', '#2c2f37', '#24262d'], grain: 'rgba(255,255,255,.04)',
      line: 'rgba(190,200,212,.5)', star: 'rgba(205,215,228,.8)', coord: 'rgba(190,200,212,.6)' },
    { id: 'sakura', name: '樱庭', dark: false,
      board: ['#f6dfd9', '#f2d3cc', '#eec9c2'], grain: 'rgba(200,120,120,.05)',
      line: 'rgba(160,90,90,.6)', star: 'rgba(150,80,80,.85)', coord: 'rgba(160,90,90,.7)' },
  ];

  // AI 台词池：按事件分组随机抽取，措辞刻意克制
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
   * [1] 本地存档 —— 各状态独立键；键名即语义，无需版本迁移
   * ================================================================ */
  const store = {
    get(key, dft) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? dft : JSON.parse(v);
      } catch (e) { return dft; }
    },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} },
  };
  let scores = store.get('wuziqi-scores', { p: 0, a: 0, d: 0 });
  let streak = store.get('wuziqi-streak', 0);
  let cleared = store.get('wuziqi-puzzles', {});        // { 题id: 星级 }
  let skin = store.get('wuziqi-skin', 'walnut');
  let soundOn = localStorage.getItem('wuziqi-sound') !== '0';
  function persist() {
    store.set('wuziqi-scores', scores);
    store.set('wuziqi-streak', streak);
    store.set('wuziqi-puzzles', cleared);
    store.set('wuziqi-skin', skin);
  }

  /* ================================================================
   * [2] 工具
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
   * [3] 音效 —— WebAudio 振荡器合成，零音频资源文件
   * ================================================================ */
  let actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return actx;
  }
  // 浏览器自动播放策略：首次交互解锁
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
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + .03);
  }
  function sndReady() {
    if (!soundOn) return false;
    const a = audio(); if (!a) return false;
    if (a.state === 'suspended') a.resume().catch(() => {});
    return a.state === 'running';
  }
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
   * [4] AI 台词
   * ================================================================ */
  function aiSay(text) {
    if (!text) return;
    bubble.textContent = '「' + text + '」';
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 2800);
  }

  /* ================================================================
   * [5] 对局流程
   * ================================================================ */
  let board, history, turn, playing, aiThinking, winCells, gameToken = 0;
  let playerColor, aiColor, aiThinkMs = 0;
  let hover = null, hintCell = null;
  let pulse = 0, loopOn = false, loopPending = false;
  const dropAnims = new Map();          // 落子动画: 棋盘下标 -> 起始时刻
  let gameStart = 0, timerIv = null, bubbleTimer = null;

  // 模式：'match' 对弈 | 'puzzle' 残局 | 'replay' 复盘
  let mode = 'match';
  let puzzleIndex = -1, puzzleSolved = false, puzzleStart = 0, puzzlePlaced = null, wrongMark = null;
  let matchSnapshot = null;
  let replayIdx = 0;

  function newGame() {
    gameToken++;                        // 令牌递增使未决 AI 回调失效
    mode = 'match';
    board = G.createBoard();
    history = [];
    winCells = null; hintCell = null; hover = null;
    dropAnims.clear();
    playing = true; aiThinking = false; aiThinkMs = 0;
    playerColor = $('firstColor').value === 'player' ? G.BLACK : G.WHITE;
    aiColor = 3 - playerColor;
    turn = G.BLACK;
    overlay.classList.remove('show');
    $('confetti').innerHTML = '';
    resultSub.textContent = '';
    $('againBtn').textContent = '再来一局';
    bubble.classList.remove('show');
    hideReplayBar();
    gameStart = Date.now();
    clearInterval(timerIv); timerIv = setInterval(tick, 500); tick();
    updatePanel(); render();
    if (turn === aiColor) scheduleAI();
  }

  // 计时/局面信息行（对弈时每 500ms 刷新）
  function tick() {
    if (mode !== 'match') return;
    const last = history[history.length - 1];
    let meta = '第 ' + history.length + ' 手 · ' + fmt(Date.now() - gameStart);
    if (last) meta += ' · 上一手 ' + (last.role === G.BLACK ? '黑' : '白') + ' ' + notation(last.x, last.y);
    moveMeta.textContent = meta;
  }

  function doMove(x, y, role) {
    board[G.idx(x, y)] = role;
    history.push({ x, y, role });
    dropAnims.set(G.idx(x, y), performance.now());
    ensureLoop();
    sndStone(role === G.BLACK);
    haptic(12);
    const wl = G.winLineAt(board, x, y);
    if (wl) { winCells = wl; endGame(role); }
    else if (history.length >= SIZE * SIZE) endGame(0);
    else turn = 3 - role;
    render(); updatePanel();
  }

  function playerMove(x, y) {
    if (mode === 'puzzle') { puzzleTap(x, y); return; }
    if (!playing || aiThinking || turn !== playerColor) return;
    if (board[G.idx(x, y)] !== G.EMPTY) return;
    hintCell = null;
    doMove(x, y, playerColor);
    if (playing && turn === aiColor) scheduleAI();
  }

  // AI 回合：160ms 延迟营造思考感；token 防止新局后旧回调生效
  function scheduleAI() {
    if (mode !== 'match') return;
    const token = gameToken;
    aiThinking = true; updatePanel(); render();
    setTimeout(function () {
      const t0 = performance.now();
      const mv = G.bestMove(board, aiColor, $('difficulty').value);
      aiThinkMs = performance.now() - t0;
      if (token !== gameToken) return;
      aiThinking = false;
      if (!playing) { updatePanel(); return; }
      // 台词触发：分别分析「我方落此点」「对方落此点」的棋型价值
      const a = G.analyzePoint(board, mv.x, mv.y, aiColor);
      const d = G.analyzePoint(board, mv.x, mv.y, playerColor);
      if (d.five) aiSay(pick(LINES.blockFive));
      else if (a.liveFour || a.score >= 60000) aiSay(pick(LINES.aiFour));
      else if (d.liveFour) aiSay(pick(LINES.playerFour));
      else if (a.score >= 50000) aiSay(pick(LINES.aiThree));
      doMove(mv.x, mv.y, aiColor);
    }, 160);
  }

  function endGame(winnerRole) {
    playing = false; aiThinking = false;
    clearInterval(timerIv);
    tick();
    const elapsed = Date.now() - gameStart;
    const sub = '用时 ' + fmt(elapsed) + ' · 共 ' + history.length + ' 手';
    // 结算副语：随机的、像人写的短评
    const FLAVOR = {
      aiLose: ['干净利落。', 'AI 复盘去了。', '教科书式对局。', '这就是实力。'],
      aiWin: ['这局是学习。', 'AI 有点东西。', '复盘找找问题。', '下局翻盘。'],
      draw: ['不分伯仲。', '和棋，各自保留意见。', '势均力敌的一局。'],
    };
    let resultStr, key;
    if (winnerRole === 0) {
      scores.d++; streak = 0;
      resultStr = '和棋'; key = 'draw';
    } else if (winnerRole === playerColor) {
      scores.p++; streak++;
      resultStr = '你赢了'; key = 'aiLose';
      boardCard.classList.remove('flash'); void boardCard.offsetWidth;
      boardCard.classList.add('flash', 'shake-hard');
      streakCallout(streak);
      setTimeout(() => boardCard.classList.remove('flash', 'shake-hard'), 900);
      throwConfetti();
    } else {
      scores.a++; streak = 0;
      resultStr = 'AI 胜'; key = 'aiWin';
      boardCard.classList.remove('shake'); void boardCard.offsetWidth;
      boardCard.classList.add('shake');
      setTimeout(() => boardCard.classList.remove('shake'), 600);
    }
    resultText.textContent = resultStr;
    resultSub.textContent = sub + ' · ' + pick(FLAVOR[key]);
    if (key === 'draw') sndDraw(); else if (key === 'aiLose') sndWin(); else sndLose();
    aiSay(pick(LINES[key]));
    persist();
    setTimeout(function () { overlay.classList.add('show'); ensureLoop(); }, 500);
    updatePanel();
  }

  // 连胜里程碑浮字
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

  function undo() {
    if (mode !== 'match') return;
    const minHist = playerColor === G.WHITE ? 1 : 0;
    if (aiThinking || history.length <= minHist) return;
    while (history.length > minHist) {
      const m = history.pop();
      board[G.idx(m.x, m.y)] = G.EMPTY;
      dropAnims.delete(G.idx(m.x, m.y));
      if (m.role === playerColor) break;
    }
    winCells = null; hintCell = null; playing = true; turn = playerColor;
    overlay.classList.remove('show'); $('confetti').innerHTML = '';
    sndClick();
    render(); updatePanel();
  }

  function hint() {
    if (mode !== 'match') return;
    if (!(playing && !aiThinking && turn === playerColor)) return;
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
   * [6] 残局练习 —— 题库由生成器产出并经引擎验证答案唯一性
   * ================================================================ */
  function renderPuzzleGrid() {
    const grid = $('puzzleGrid');
    grid.innerHTML = '';
    let done = 0;
    PUZZLES.forEach((p, i) => {
      const stars = cleared[p.id] || 0;
      if (stars > 0) done++;
      const b = document.createElement('button');
      b.className = 'pz' + (stars > 0 ? ' done' : '') + (i === puzzleIndex ? ' active' : '');
      b.innerHTML = String(i + 1) + '<div class="stars">' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '</div>';
      b.addEventListener('click', () => enterPuzzle(i));
      grid.appendChild(b);
    });
    $('puzzleHead').textContent = '共 ' + PUZZLES.length + ' 题，已破解 ' + done + ' 题。黑为●，白为○。';
  }

  // 进入残局：快照当前对局，返回时可无损恢复
  function enterPuzzle(i) {
    if (mode === 'replay') exitReplay();
    if (mode === 'match') {
      matchSnapshot = {
        board: board.slice(), history: history.slice(),
        turn, playing, winCells: winCells ? winCells.slice() : null,
        gameStart, playerColor, aiColor,
      };
      gameToken++;
      aiThinking = false;
      clearInterval(timerIv);
    }
    mode = 'puzzle';
    puzzleIndex = i; puzzleSolved = false; puzzlePlaced = null; wrongMark = null;
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
    dropAnims.clear();
    overlay.classList.remove('show'); $('confetti').innerHTML = '';
    clearInterval(timerIv); timerIv = setInterval(tick, 500); tick();
    switchTab('match');
    updatePanel(); render(); renderPuzzleGrid();
    if (playing && turn === aiColor && !winCells) scheduleAI();
  }

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
      cleared[p.id] = Math.max(cleared[p.id] || 0, stars);
      persist();
      winCells = G.winLineAt(board, x, y);
      sndWin(); haptic([15, 40, 15]);
      throwConfetti();
      aiSay(pick(LINES.puzzleOK));
      resultText.textContent = '破解成功';
      resultSub.textContent = '第 ' + (puzzleIndex + 1) + ' 题 · 用时 ' +
        elapsed.toFixed(1) + ' 秒 · ' + '★'.repeat(stars);
      $('againBtn').textContent = '下一题';
      setTimeout(() => { overlay.classList.add('show'); ensureLoop(); }, 450);
      renderPuzzleGrid();
      render();
    } else {
      wrongMark = { x, y };
      sndWrong(); haptic(40);
      boardCard.classList.remove('shake'); void boardCard.offsetWidth;
      boardCard.classList.add('shake');
      aiSay(pick(LINES.puzzleBad));
      ensureLoop();
      setTimeout(() => { wrongMark = null; render(); }, 700);
      render();
    }
  }

  /* ================================================================
   * [7] 复盘 —— 终局逐手回放，支持键盘 ←/→/Esc
   * ================================================================ */
  function enterReplay() {
    if (mode !== 'match' || playing || !history.length) return;
    mode = 'replay';
    replayIdx = 0;
    winCells = null; hintCell = null; hover = null;
    showReplayBar();
    overlay.classList.remove('show');
    render(); updatePanel();
  }
  function replayStep(d) {
    if (mode !== 'replay') return;
    const next = Math.max(0, Math.min(history.length, replayIdx + d));
    if (next !== replayIdx && next > 0) {
      const m = history[next - 1];
      dropAnims.set(G.idx(m.x, m.y), performance.now());
      sndStone(m.role === G.BLACK);
    }
    replayIdx = next;
    ensureLoop(); updateReplayBar(); render();
  }
  function exitReplay() {
    if (mode !== 'replay') return;
    mode = 'match';
    const last = history[history.length - 1];
    winCells = last ? G.winLineAt(board, last.x, last.y) : null;
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
   * [8] 渲染 —— Canvas 绘制，配色由皮肤参数化
   * ================================================================ */
  function currentSkin() { return SKINS.find(s => s.id === skin) || SKINS[0]; }

  function render() {
    const sk = currentSkin();
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = ctx.createLinearGradient(0, 0, W, W);
    g.addColorStop(0, sk.board[0]); g.addColorStop(.5, sk.board[1]); g.addColorStop(1, sk.board[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
    // 材质纹路
    ctx.strokeStyle = sk.grain; ctx.lineWidth = 1;
    for (let k = 0; k < 26; k++) {
      const r = Math.abs(Math.sin(k * 127.1 + 31.7) * 43758.5) % 1;
      const y = 12 + r * (W - 24);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * .3, y + (r - .5) * 14, W * .7, y - (r - .5) * 14, W, y + (r - .5) * 8);
      ctx.stroke();
    }
    // 网格
    ctx.strokeStyle = sk.line;
    for (let i = 0; i < SIZE; i++) {
      ctx.lineWidth = (i === 0 || i === SIZE - 1) ? 1.8 : 1;
      const p = PAD + i * CELL;
      ctx.beginPath(); ctx.moveTo(PAD, p); ctx.lineTo(W - PAD, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, PAD); ctx.lineTo(p, W - PAD); ctx.stroke();
    }
    // 星位
    ctx.fillStyle = sk.star;
    [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].forEach(([sx, sy]) => {
      ctx.beginPath(); ctx.arc(PAD + sx * CELL, PAD + sy * CELL, 3.4, 0, Math.PI * 2); ctx.fill();
    });
    // 坐标
    ctx.fillStyle = sk.coord;
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
    // 最后一手标记
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
    // 悬停预览
    if (mode === 'match' && hover && playing && !aiThinking && turn === playerColor &&
        board[G.idx(hover.x, hover.y)] === G.EMPTY) {
      drawStone(hover.x, hover.y, playerColor, 0.38);
    }
    // 提示标记
    if (hintCell) {
      const cx = PAD + hintCell.x * CELL, cy = PAD + hintCell.y * CELL;
      ctx.save();
      ctx.strokeStyle = '#2f6f4f'; ctx.lineWidth = 3.5;
      ctx.shadowColor = 'rgba(47,111,79,.8)'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy, CELL * .42, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // 残局错点标记
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

  // 落子动画缓动：回弹式放大
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
    const sk = currentSkin();
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
    if (role === G.BLACK && sk.dark) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke(); }
    if (role === G.WHITE) { ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
  }

  // rAF 主循环：仅在有动画时运转，空闲零耗电
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
   * [9] 面板刷新与输入
   * ================================================================ */
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
      $('undoBtn').disabled = history.length <= minHist;
      $('hintBtn').disabled = turn !== playerColor;
    }
    tick();
    $('scoreP').textContent = scores.p;
    $('scoreA').textContent = scores.a;
    $('scoreD').textContent = scores.d;
    const st = $('streakRow');
    if (streak >= 2) { st.style.display = 'inline-block'; st.textContent = '连胜 ' + streak + ' 场'; }
    else st.style.display = 'none';
  }

  // 键盘快捷键：N 新对局 · U 悔棋 · H 提示 · M 音效 · R 复盘 · ←→ 回放 · 空格 开始
  document.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!$('intro').classList.contains('hide')) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); $('introStart').click(); }
      return;
    }
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

  /* ---------------- 事件绑定 ---------------- */
  const boardCard = $('boardCard');
  // 屏幕坐标 → 交叉点（0.48 格吸附半径）
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

  $('newBtn').addEventListener('click', () => { sndClick(); newGame(); });
  $('againBtn').addEventListener('click', () => {
    sndClick();
    if (mode === 'puzzle') enterPuzzle((puzzleIndex + 1) % PUZZLES.length);
    else newGame();
  });
  $('replayBtn').addEventListener('click', () => { sndClick(); enterReplay(); });
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
    scores = { p: 0, a: 0, d: 0 }; streak = 0; persist(); updatePanel();
  });
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      if (t.dataset.tab === 'puzzle' && aiThinking) { toast('AI 思考中，稍候再试'); return; }
      if (t.dataset.tab === 'match' && mode === 'puzzle') { sndClick(); returnToMatch(); return; }
      sndClick();
      switchTab(t.dataset.tab);
    });
  });

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $('tab-match').hidden = name !== 'match';
    $('tab-puzzle').hidden = name !== 'puzzle';
    if (name === 'puzzle') renderPuzzleGrid();
  }

  // 皮肤：免费切换，纯审美
  function renderSkins() {
    const row = $('skinRow');
    row.innerHTML = '';
    for (const s of SKINS) {
      const b = document.createElement('button');
      b.className = 'skin-swatch' + (skin === s.id ? ' active' : '');
      b.style.setProperty('--c1', s.board[0]);
      b.style.setProperty('--c2', s.board[2]);
      b.innerHTML = '<span class="chip"></span>' + s.name;
      b.addEventListener('click', () => {
        if (skin === s.id) return;
        skin = s.id;
        persist();
        sndClick();
        renderSkins();
        render();
      });
      row.appendChild(b);
    }
  }

  // 调试 / 自动化测试钩子
  window.__wuziqi = {
    state: () => ({
      playing, aiThinking, turn, playerColor, aiColor, moves: history.length,
      mode, puzzleIndex, skin, streak,
    }),
    playerMove,
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
        $('replayBtn').hidden = true;
        throwConfetti(); sndWin();
        overlay.classList.add('show'); ensureLoop();
      },
      puzzle(i) { enterPuzzle(i); },
    },
  };

  /* ================================================================
   * [10] 开场画面与启动序列
   * ================================================================ */
  // 开场画面：注入漂浮棋子装饰，点击/空格开始
  (function buildIntro() {
    const intro = $('intro');
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

  const statusText = $('statusText'), subStatus = $('subStatus'), turnDot = $('turnDot');
  const overlay = $('overlay'), resultText = $('resultText'), resultSub = $('resultSub');
  const bubble = $('bubble'), moveMeta = $('moveMeta');

  newGame();
  renderPuzzleGrid();
  renderSkins();
})();
