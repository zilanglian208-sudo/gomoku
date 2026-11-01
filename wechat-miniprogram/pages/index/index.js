// 智能五子棋 —— 页面控制器（AI 引擎复用 utils/engine.js）
const G = require('../../utils/engine.js');

const SIZE = G.SIZE;
const W = 640;                       // 逻辑绘制空间（与网页版一致）
const PAD = 40;
const CELL = (W - 2 * PAD) / (SIZE - 1);
const COLS = 'ABCDEFGHIJKLMNO';

const DIFF_VALUES = ['easy', 'medium', 'hard'];
const DIFF_NAMES = ['简单 · 入门', '中等 · 进阶', '困难 · 高手'];
const FIRST_NAMES = ['我执黑先行', 'AI 执黑先行'];

const LINES = {
  blockFive: ['好险，差点让你连成五子。', '就想料到你会走这。', '堵住了，没那么容易。'],
  aiFour: ['看这一手。', '攻势开始了。', '胜利在望。'],
  playerFour: ['大意了……', '这手够狠。', '得提防你的三连了。'],
  aiThree: ['步步为营。', '悄悄布局中。', '看好了。'],
  aiWin: ['承让。', '我赢了，再来一局？', '棋高一着。'],
  aiLose: ['棋差一着，佩服。', '你赢了，厉害。', '这局算你的，下局我认真下。'],
  draw: ['势均力敌，平分秋色。', '不打不相识，再来一局？'],
};

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

Page({
  data: {
    boardPx: 320,
    // 面板状态
    statusText: '轮到你了',
    subStatus: '执黑先行，点击交叉点落子',
    timeText: '第 0 手 · 00:00',
    bubble: '', bubbleShow: false,
    turnBlack: true, thinking: false,
    showOver: false, resultText: '', resultSub: '', confetti: [],
    diffIndex: 1, diffNames: DIFF_NAMES,
    firstIndex: 0, firstNames: FIRST_NAMES,
    canUndo: false, canHint: false,
    scoreP: 0, scoreA: 0, scoreD: 0, streak: 0,
    soundOn: true,
  },

  /* ---------------- 生命周期 ---------------- */
  onLoad() {
    const info = wx.getSystemInfoSync();
    this.setData({ boardPx: Math.min(info.windowWidth - 56, 620) });
    try { this.scores = JSON.parse(wx.getStorageSync('wuziqi-scores') || '') || { p: 0, a: 0, d: 0 }; }
    catch (e) { this.scores = { p: 0, a: 0, d: 0 }; }
    this.streak = Number(wx.getStorageSync('wuziqi-streak') || 0) || 0;
    this.soundOn = wx.getStorageSync('wuziqi-sound') !== '0';
    this.syncScore();

    // 引擎状态
    this.board = G.createBoard();
    this.history = [];
    this.turn = G.BLACK;
    this.playerColor = G.BLACK;
    this.aiColor = G.WHITE;
    this.playing = true;
    this.aiThinking = false;
    this.winCells = null;
    this.hintCell = null;
    this.dropAnims = new Map();
    this.pulse = 0;
    this.loopOn = false;
    this.bubbleTimer = null;
    this.audioCache = {};
    this.gameStart = Date.now();
    this.timerIv = setInterval(() => this.tick(), 500);
  },

  onReady() {
    wx.createSelectorQuery().in(this)
      .select('#board').fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return;
        const info = wx.getSystemInfoSync();
        const dpr = info.pixelRatio || 2;
        const canvas = res[0].node;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        // 逻辑空间 640x640 -> 实际像素
        const k = (dpr * res[0].width) / W;
        this.ctx.scale(k, k);
        this.draw();
      });
  },

  onUnload() { clearInterval(this.timerIv); },

  /* ---------------- 绘制 ---------------- */
  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.save();
    // 木底
    const g = ctx.createLinearGradient(0, 0, W, W);
    g.addColorStop(0, '#e3b56f'); g.addColorStop(.5, '#d9aa62'); g.addColorStop(1, '#cd9d55');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
    // 木纹
    ctx.strokeStyle = 'rgba(120,80,30,.05)'; ctx.lineWidth = 1;
    for (let k = 0; k < 26; k++) {
      const r = Math.abs(Math.sin(k * 127.1 + 31.7) * 43758.5) % 1;
      const y = 12 + r * (W - 24);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * .3, y + (r - .5) * 14, W * .7, y - (r - .5) * 14, W, y + (r - .5) * 8);
      ctx.stroke();
    }
    // 网格
    ctx.strokeStyle = 'rgba(92,64,30,.8)';
    for (let i = 0; i < SIZE; i++) {
      ctx.lineWidth = (i === 0 || i === SIZE - 1) ? 1.8 : 1;
      const p = PAD + i * CELL;
      ctx.beginPath(); ctx.moveTo(PAD, p); ctx.lineTo(W - PAD, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, PAD); ctx.lineTo(p, W - PAD); ctx.stroke();
    }
    // 星位
    ctx.fillStyle = 'rgba(70,48,22,.9)';
    [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].forEach(([sx, sy]) => {
      ctx.beginPath(); ctx.arc(PAD + sx * CELL, PAD + sy * CELL, 3.4, 0, Math.PI * 2); ctx.fill();
    });
    // 坐标
    ctx.fillStyle = 'rgba(92,64,30,.85)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < SIZE; i++) {
      ctx.fillText(COLS[i], PAD + i * CELL, W - PAD + 21);
      ctx.fillText(String(SIZE - i), PAD - 21, PAD + i * CELL);
    }
    // 棋子
    for (const m of this.history) this.drawStone(m.x, m.y, m.role, 1);
    // 最后一手标记
    if (this.history.length && !this.winCells) {
      const m = this.history[this.history.length - 1];
      if (!this.dropAnims.has(G.idx(m.x, m.y))) {
        const cx = PAD + m.x * CELL, cy = PAD + m.y * CELL;
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#c0392b'; ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
      }
    }
    // 获胜连线（呼吸）
    if (this.winCells) {
      const pts = this.winCells.map(i => ({ x: i % SIZE, y: (i / SIZE) | 0 }))
        .sort((a, b) => (a.x - b.x) || (a.y - b.y));
      const p0 = pts[0], p1 = pts[pts.length - 1];
      const a = 0.55 + 0.35 * Math.sin(this.pulse);
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
    // 提示标记
    if (this.hintCell) {
      const cx = PAD + this.hintCell.x * CELL, cy = PAD + this.hintCell.y * CELL;
      ctx.save();
      ctx.strokeStyle = '#2f6f4f'; ctx.lineWidth = 3.5;
      ctx.shadowColor = 'rgba(47,111,79,.8)'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy, CELL * .42, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },

  easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  drawStone(x, y, role, alpha) {
    const ctx = this.ctx;
    const key = G.idx(x, y);
    let scale = 1;
    if (this.dropAnims.has(key)) {
      const t = (performance.now() - this.dropAnims.get(key)) / 240;
      if (t >= 1) this.dropAnims.delete(key);
      else {
        scale = .25 + .75 * this.easeOutBack(Math.min(1, t));
        alpha *= .45 + .55 * t;
        this.loopPending = true;
      }
    }
    const cx = PAD + x * CELL, cy = PAD + y * CELL, R = CELL * 0.44 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (alpha === 1) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2; }
    const g = ctx.createRadialGradient(cx - R * .35, cy - R * .35, R * .1, cx, cy, R);
    if (role === G.BLACK) { g.addColorStop(0, '#646b7a'); g.addColorStop(1, '#0b0d12'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c6cad3'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  // 主循环：仅在获胜呼吸 / 落子动画期间运转
  ensureLoop() {
    if (!this.canvas || this.loopOn) return;
    this.loopOn = true;
    const frame = () => {
      let busy = false;
      if (this.winCells) { this.pulse += 0.09; busy = true; }
      this.loopPending = false;
      this.draw();
      if (this.loopPending) busy = true;
      if (busy) this.canvas.requestAnimationFrame(frame);
      else this.loopOn = false;
    };
    this.canvas.requestAnimationFrame(frame);
  },

  /* ---------------- 音效（打包 WAV 文件） ---------------- */
  playSound(name) {
    if (!this.soundOn) return;
    try {
      if (!this.audioCache[name]) {
        const a = wx.createInnerAudioContext();
        a.src = '/assets/sounds/' + name + '.wav';
        this.audioCache[name] = a;
      }
      this.audioCache[name].stop();
      this.audioCache[name].play();
    } catch (e) { /* 音频失败不影响对局 */ }
  },

  /* ---------------- AI 台词 ---------------- */
  say(text) {
    if (!text) return;
    this.setData({ bubble: text, bubbleShow: true });
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.setData({ bubbleShow: false }), 2800);
  },

  /* ---------------- 对局流程 ---------------- */
  tick() {
    if (this.playing) {
      this.setData({ timeText: '第 ' + this.history.length + ' 手 · ' + fmt(Date.now() - this.gameStart) });
    }
  },

  syncScore() {
    this.setData({
      scoreP: this.scores.p, scoreA: this.scores.a, scoreD: this.scores.d,
      streak: this.streak, soundOn: this.soundOn,
    });
  },

  refreshPanel() {
    const thinking = this.aiThinking;
    let statusText, subStatus, turnBlack;
    if (!this.playing) {
      const won = this.winCells && this.board[this.winCells[0]] === this.playerColor;
      statusText = won ? '你赢了' : (this.winCells ? 'AI 获胜' : '和棋');
      subStatus = '点击「再来一局」继续';
      turnBlack = this.winCells ? this.board[this.winCells[0]] === G.BLACK : true;
    } else if (thinking) {
      statusText = 'AI 思考中';
      subStatus = '评估局面……';
      turnBlack = this.aiColor === G.BLACK;
    } else {
      statusText = '轮到你了';
      subStatus = '执' + (this.playerColor === G.BLACK ? '黑先行' : '白后手') + '，点击交叉点落子';
      turnBlack = this.playerColor === G.BLACK;
    }
    const minHist = this.playerColor === G.WHITE ? 1 : 0;
    this.setData({
      statusText, subStatus, turnBlack, thinking,
      canUndo: !thinking && this.history.length > minHist,
      canHint: this.playing && !thinking && this.turn === this.playerColor,
    });
    this.tick();
  },

  doMove(x, y, role) {
    this.board[G.idx(x, y)] = role;
    this.history.push({ x, y, role });
    this.dropAnims.set(G.idx(x, y), performance.now());
    this.ensureLoop();
    this.playSound(role === G.BLACK ? 'stone-black' : 'stone-white');
    const wl = G.winLineAt(this.board, x, y);
    if (wl) { this.winCells = wl; this.endGame(role); }
    else if (this.history.length >= SIZE * SIZE) this.endGame(0);
    else this.turn = 3 - role;
    this.draw();
    this.refreshPanel();
  },

  playerMove(x, y) {
    if (!this.playing || this.aiThinking || this.turn !== this.playerColor) return;
    if (this.board[G.idx(x, y)] !== G.EMPTY) return;
    this.hintCell = null;
    this.doMove(x, y, this.playerColor);
    if (this.playing && this.turn === this.aiColor) this.scheduleAI();
  },

  scheduleAI() {
    const gameToken = (this.gameToken = (this.gameToken || 0) + 1);
    this.aiThinking = true;
    this.refreshPanel();
    setTimeout(() => {
      if (gameToken !== this.gameToken) return;   // 期间开了新局，弃用
      const t0 = performance.now();
      const mv = G.bestMove(this.board, this.aiColor, DIFF_VALUES[this.data.diffIndex]);
      this.aiThinkMs = performance.now() - t0;
      this.aiThinking = false;
      if (!this.playing) { this.refreshPanel(); return; }
      // 台词触发：基于落子前的局面分析
      const a = G.analyzePoint(this.board, mv.x, mv.y, this.aiColor);
      const d = G.analyzePoint(this.board, mv.x, mv.y, this.playerColor);
      if (d.five) this.say(pick(LINES.blockFive));
      else if (a.liveFour || a.score >= 60000) this.say(pick(LINES.aiFour));
      else if (d.liveFour) this.say(pick(LINES.playerFour));
      else if (a.score >= 50000) this.say(pick(LINES.aiThree));
      this.doMove(mv.x, mv.y, this.aiColor);
    }, 160);
  },

  endGame(winnerRole) {
    this.playing = false;
    this.aiThinking = false;
    clearInterval(this.timerIv);
    const elapsed = Date.now() - this.gameStart;
    const sub = '用时 ' + fmt(elapsed) + ' · 共 ' + this.history.length + ' 手';
    let resultText, key;
    if (winnerRole === 0) {
      this.scores.d++; this.streak = 0;
      resultText = '和棋'; key = 'draw';
    } else if (winnerRole === this.playerColor) {
      this.scores.p++; this.streak++;
      resultText = '你赢了'; key = 'aiLose';
      this.throwConfetti();
    } else {
      this.scores.a++; this.streak = 0;
      resultText = 'AI 胜'; key = 'aiWin';
    }
    this.setData({
      resultText, resultSub: sub, showOver: false,
      timeText: '第 ' + this.history.length + ' 手 · ' + fmt(elapsed),
    });
    this.playSound(key);
    this.say(pick(LINES[key]));
    try {
      wx.setStorageSync('wuziqi-scores', JSON.stringify(this.scores));
      wx.setStorageSync('wuziqi-streak', String(this.streak));
    } catch (e) { /* 存储失败不影响对局 */ }
    this.syncScore();
    setTimeout(() => { this.setData({ showOver: true }); this.ensureLoop(); }, 500);
  },

  throwConfetti() {
    const colors = ['#a63c2f', '#d4a017', '#2f6f4f', '#3b5b92', '#8a5fb0', '#c95d2c', '#f7f2e7'];
    const confetti = [];
    for (let i = 0; i < 60; i++) {
      confetti.push(
        'left:' + (Math.random() * 100).toFixed(1) + '%;' +
        'background:' + colors[(Math.random() * colors.length) | 0] + ';' +
        'animation-duration:' + (1.8 + Math.random() * 1.6).toFixed(2) + 's;' +
        'animation-delay:' + (Math.random() * .7).toFixed(2) + 's;' +
        'transform:rotate(' + ((Math.random() * 360) | 0) + 'deg);' +
        (Math.random() < .4 ? 'border-radius:50%;' : '')
      );
    }
    this.setData({ confetti });
  },

  newGame() {
    this.gameToken = (this.gameToken || 0) + 1;
    this.board = G.createBoard();
    this.history = [];
    this.winCells = null;
    this.hintCell = null;
    this.dropAnims.clear();
    this.playing = true;
    this.aiThinking = false;
    this.playerColor = this.data.firstIndex === 0 ? G.BLACK : G.WHITE;
    this.aiColor = 3 - this.playerColor;
    this.turn = G.BLACK; // 黑棋先行
    clearTimeout(this.bubbleTimer);
    this.gameStart = Date.now();
    clearInterval(this.timerIv);
    this.timerIv = setInterval(() => this.tick(), 500);
    this.setData({ showOver: false, resultSub: '', confetti: [], bubble: '', bubbleShow: false });
    this.refreshPanel();
    this.draw();
    if (this.turn === this.aiColor) this.scheduleAI();
  },

  /* ---------------- 交互 ---------------- */
  onBoardTap(e) {
    if (!e.changedTouches || !e.changedTouches.length) return;
    const t = e.changedTouches[0];
    wx.createSelectorQuery().in(this)
      .select('#board').boundingClientRect((rect) => {
        if (!rect) return;
        const scale = W / rect.width;
        const px = (t.clientX - rect.left) * scale;
        const py = (t.clientY - rect.top) * scale;
        const x = Math.round((px - PAD) / CELL), y = Math.round((py - PAD) / CELL);
        if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
        if (Math.hypot(px - (PAD + x * CELL), py - (PAD + y * CELL)) > CELL * 0.48) return;
        this.playerMove(x, y);
      }).exec();
  },

  onNewGame() { this.newGame(); },

  onUndo() {
    const minHist = this.playerColor === G.WHITE ? 1 : 0;
    if (this.aiThinking || this.history.length <= minHist) return;
    while (this.history.length > minHist) {
      const m = this.history.pop();
      this.board[G.idx(m.x, m.y)] = G.EMPTY;
      this.dropAnims.delete(G.idx(m.x, m.y));
      if (m.role === this.playerColor) break;
    }
    this.winCells = null;
    this.hintCell = null;
    this.playing = true;
    this.turn = this.playerColor;
    this.setData({ showOver: false });
    this.playSound('stone-white');
    this.draw();
    this.refreshPanel();
  },

  onHint() {
    if (!(this.playing && !this.aiThinking && this.turn === this.playerColor)) return;
    const mv = G.bestMove(this.board, this.playerColor, DIFF_VALUES[this.data.diffIndex]);
    this.hintCell = mv;
    this.draw();
    setTimeout(() => { this.hintCell = null; this.draw(); }, 1800);
  },

  onToggleSound() {
    this.soundOn = !this.soundOn;
    try { wx.setStorageSync('wuziqi-sound', this.soundOn ? '1' : '0'); } catch (e) {}
    this.syncScore();
    if (this.soundOn) this.playSound('stone-white');
  },

  onDifficulty(e) { this.setData({ diffIndex: Number(e.detail.value) }); },

  onFirst(e) {
    this.setData({ firstIndex: Number(e.detail.value) });
    this.newGame();
  },

  onResetScore() {
    this.scores = { p: 0, a: 0, d: 0 };
    this.streak = 0;
    try {
      wx.setStorageSync('wuziqi-scores', JSON.stringify(this.scores));
      wx.setStorageSync('wuziqi-streak', '0');
    } catch (e) {}
    this.syncScore();
  },
});
