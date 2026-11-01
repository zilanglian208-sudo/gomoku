// v6.2：把桌宠重构为「独立可拖拽小人」，并按官方设定集重绘为鲸鱼娘
const fs = require('fs');

/* ============ 1) index.html：状态块去掉鱼、插入独立桌宠组件 ============ */
const p = 'index.html';
let html = fs.readFileSync(p, 'utf8');

const PET_SVG = `<svg class="fish-svg" viewBox="0 0 220 200" aria-label="大肥鱼（鲸鱼娘）">
                <defs>
                  <linearGradient id="fgHair" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#3d5cc4"/>
                    <stop offset="70%" stop-color="#4a72d8"/>
                    <stop offset="100%" stop-color="#7fa0e8"/>
                  </linearGradient>
                  <linearGradient id="fgIris" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#7fa0e8"/>
                    <stop offset="100%" stop-color="#2f5fc0"/>
                  </linearGradient>
                  <linearGradient id="fgDress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#2c3e78"/>
                    <stop offset="100%" stop-color="#253468"/>
                  </linearGradient>
                </defs>
                <!-- 地面投影 -->
                <ellipse class="f-shadow" cx="100" cy="193" rx="58" ry="7"/>
                <g class="f-bob">
                  <!-- 大鲸尾（身后，摆动） -->
                  <g class="f-tail">
                    <path d="M124 158 C146 160 166 154 178 140 C172 134 170 126 172 116 C184 122 194 134 196 146 C192 162 164 172 140 170 C132 168 126 164 124 158 Z"/>
                  </g>
                  <!-- 蓝色长卷发（脑后，垂到裙摆） -->
                  <path class="f-hairback" d="M58 82 C50 44 76 20 102 20 C130 20 154 44 150 84 C150 110 146 132 150 150 C152 160 144 166 136 158 C140 132 142 108 138 86 C120 96 82 96 62 86 C60 84 59 83 58 82 Z"/>
                  <path class="f-hairback" d="M62 86 C60 108 58 124 52 138 C48 148 38 148 36 140 C42 122 48 102 50 84 Z"/>
                  <!-- 女仆裙（深蓝） -->
                  <path class="f-dress" d="M82 124 C82 118 118 118 118 124 L130 168 C128 174 72 174 70 168 Z"/>
                  <!-- 白色褶边裙摆 -->
                  <rect class="f-frill" x="74" y="160" width="52" height="8" rx="4"/>
                  <circle class="f-frill" cx="82" cy="166" r="5"/>
                  <circle class="f-frill" cx="100" cy="168" r="5"/>
                  <circle class="f-frill" cx="118" cy="166" r="5"/>
                  <!-- 白色围裙 + 小鲸鱼刺绣 -->
                  <path class="f-apron" d="M84 148 C92 144 108 144 116 148 C118 158 114 166 100 168 C86 166 82 158 84 148 Z"/>
                  <path class="f-whale" d="M95 158 C95 155 99 153 102 154 C105 155 106 157 105 159 C103 161 97 161 95 158 Z"/>
                  <path class="f-whale" d="M105 157 l3 -2 l-1 3 z"/>
                  <!-- 胸口白衬衣 + 纽扣 + 蓝蝴蝶结 + 宝石 -->
                  <path class="f-bib" d="M90 122 L110 122 C112 136 112 142 110 146 L90 146 C88 142 88 136 90 122 Z"/>
                  <circle class="f-btn" cx="100" cy="131" r="1.3"/>
                  <circle class="f-btn" cx="100" cy="136" r="1.3"/>
                  <circle class="f-btn" cx="100" cy="141" r="1.3"/>
                  <path class="f-ribbon" d="M100 128 L86 121 L89 133 Z"/>
                  <path class="f-ribbon" d="M100 128 L114 121 L111 133 Z"/>
                  <circle class="f-ribbon" cx="100" cy="128" r="3.4"/>
                  <circle class="f-gem" cx="100" cy="128" r="2"/>
                  <!-- 泡泡袖 + 小手 -->
                  <circle class="f-sleeve" cx="78" cy="130" r="7.5"/>
                  <circle class="f-sleeve" cx="122" cy="130" r="7.5"/>
                  <circle class="f-hand" cx="70" cy="144" r="5"/>
                  <circle class="f-hand" cx="130" cy="144" r="5"/>
                  <!-- 腿：白袜（褶边）+ 藏青玛丽珍鞋 -->
                  <ellipse class="f-sock" cx="93" cy="178" rx="5.5" ry="8"/>
                  <ellipse class="f-sock" cx="107" cy="178" rx="5.5" ry="8"/>
                  <circle class="f-frill" cx="93" cy="171" r="4"/>
                  <circle class="f-frill" cx="107" cy="171" r="4"/>
                  <ellipse class="f-shoe" cx="92" cy="189" rx="8" ry="4.5"/>
                  <ellipse class="f-shoe" cx="108" cy="189" rx="8" ry="4.5"/>
                  <circle class="f-buckle" cx="96" cy="187" r="1.4"/>
                  <circle class="f-buckle" cx="104" cy="187" r="1.4"/>
                  <!-- 脸 -->
                  <circle class="f-face" cx="100" cy="76" r="40"/>
                  <!-- 鲸鳍耳（头两侧，深色外鳍 + 浅色内鳍） -->
                  <g class="f-earfin">
                    <path d="M58 70 C40 64 26 70 20 84 C32 90 48 88 58 80 Z"/>
                    <path class="f-earfin-in" d="M54 74 C44 70 36 74 30 82 C40 86 50 84 56 78 Z"/>
                  </g>
                  <g class="f-earfin">
                    <path d="M142 70 C160 64 174 70 180 84 C168 90 152 88 142 80 Z"/>
                    <path class="f-earfin-in" d="M146 74 C156 70 164 74 170 82 C160 86 150 84 144 78 Z"/>
                  </g>
                  <!-- 蓝色长卷发（刘海，分缝圆齿） -->
                  <path class="f-bangs" d="M60 74 C58 46 78 34 100 34 C122 34 142 46 140 74 C134 58 124 52 114 58 C108 46 104 44 100 44 C96 44 92 46 86 58 C76 52 66 58 60 74 Z"/>
                  <!-- 弯钩呆毛 -->
                  <path class="f-ahoge" d="M108 34 C112 16 100 6 84 8 C98 12 104 20 102 34 Z"/>
                  <!-- 白色褶边女仆发箍 + 蓝色蝴蝶结 -->
                  <path class="f-band" d="M62 50 C76 30 124 30 138 50 C134 42 120 36 100 36 C80 36 66 42 62 50 Z"/>
                  <g class="f-bow">
                    <path d="M66 42 L56 36 L58 46 Z"/>
                    <path d="M66 42 L76 36 L74 46 Z"/>
                    <circle cx="66" cy="42" r="2.4"/>
                  </g>
                  <!-- 眉毛（情绪可旋转） -->
                  <path class="f-brow" d="M70 76 Q80 71 90 76"/>
                  <path class="f-brow" d="M110 76 Q120 71 130 76"/>
                  <!-- 眼睛（蓝瞳，大而亮） -->
                  <g class="f-eye">
                    <ellipse class="f-sclera" cx="80" cy="92" rx="10.5" ry="12"/>
                    <g class="f-pupil-g">
                      <circle class="f-iris" cx="80" cy="93" r="7.5"/>
                      <circle class="f-pupil" cx="80" cy="94" r="4.2"/>
                      <circle class="f-glint" cx="77.4" cy="90.4" r="2.4"/>
                      <circle class="f-glint g2" cx="82.6" cy="96.6" r="1.1"/>
                    </g>
                    <path class="f-lash" d="M69 84 Q80 77 91 84"/>
                    <rect class="f-lid" x="68" y="79" width="24" height="26" rx="6"/>
                  </g>
                  <g class="f-eye">
                    <ellipse class="f-sclera" cx="120" cy="92" rx="10.5" ry="12"/>
                    <g class="f-pupil-g">
                      <circle class="f-iris" cx="120" cy="93" r="7.5"/>
                      <circle class="f-pupil" cx="120" cy="94" r="4.2"/>
                      <circle class="f-glint" cx="117.4" cy="90.4" r="2.4"/>
                      <circle class="f-glint g2" cx="122.6" cy="96.6" r="1.1"/>
                    </g>
                    <path class="f-lash" d="M109 84 Q120 77 131 84"/>
                    <rect class="f-lid" x="108" y="79" width="24" height="26" rx="6"/>
                  </g>
                  <!-- 嘴：按情绪显隐 -->
                  <path class="f-mouth m-smile" d="M93 112 Q100 118 107 112"/>
                  <path class="f-mouth m-grin" d="M91 111 Q100 123 109 109 Q100 117 91 111 Z"/>
                  <path class="f-mouth m-open" d="M96 111 Q100 122 104 111 Q100 115 96 111 Z"/>
                  <path class="f-mouth m-flat" d="M94 114 L106 114"/>
                  <path class="f-mouth m-frown" d="M93 116 Q100 109 107 116"/>
                  <!-- 腮红 -->
                  <ellipse class="f-blush" cx="64" cy="106" rx="8.5" ry="4.2"/>
                  <ellipse class="f-blush b2" cx="136" cy="106" rx="8.5" ry="4.2"/>
                  <!-- 效果件：汗滴 / 泪 / 火花 / 呼噜 -->
                  <path class="f-sweat" d="M148 42 q7 11 0 16 q-7 -5 0 -16 Z"/>
                  <circle class="f-tear" cx="76" cy="102" r="3.8"/>
                  <g class="f-sparkle">
                    <path d="M162 26 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z"/>
                    <path class="sp2" d="M180 50 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"/>
                  </g>
                  <g class="f-zzz">
                    <text class="z1" x="146" y="34">z</text>
                    <text class="z2" x="160" y="22">z</text>
                    <text class="z3" x="174" y="12">Z</text>
                  </g>
                </g>
              </svg>`;

// 状态块：去掉 opponent-row，只留文字状态
const rowStart = html.indexOf('<div class="opponent-row">');
const marker = '<!-- 复盘控制条（仅复盘模式显示） -->';
const rowEnd = html.indexOf(marker);
if (rowStart === -1 || rowEnd === -1) { console.error('opponent-row markers not found'); process.exit(1); }
html = html.slice(0, rowStart) +
`<div class="status-line">
          <div class="stone-dot black" id="turnDot"></div>
          <div id="statusText" class="serif">轮到你了</div>
        </div>
        <div id="subStatus">执黑先行，点击交叉点落子</div>
        <div id="moveMeta">第 0 手 · 00:00</div>
        ` + html.slice(rowEnd);

// 插入独立桌宠组件（可拖拽，位置见 CSS/JS）
const toastsAt = html.indexOf('<div id="toasts"></div>');
if (toastsAt === -1) { console.error('toasts not found'); process.exit(1); }
const PET = `<div id="toasts"></div>

<!-- 桌宠：大肥鱼小人（可拖拽；表情状态机见 app.js；数据含位置持久化） -->
<div class="pet" id="pet" data-mood="idle">
  <div class="fish-bubble" id="bubble"></div>
  <div class="pet-body" id="fish" title="拖着我走 · 点点我">
    ` + PET_SVG + `
  </div>
</div>`;
html = html.replace('<div id="toasts"></div>', PET);

fs.writeFileSync(p, html);
console.log('index.html restructured, length:', html.length);
