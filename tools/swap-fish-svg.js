// 将 index.html 中的大肥鱼 SVG 替换为鲸鱼娘 Q 版形象
const fs = require('fs');
const p = 'index.html';
let html = fs.readFileSync(p, 'utf8');

const NEW_SVG = `<svg class="fish-svg" viewBox="0 0 220 180" aria-label="大肥鱼（鲸鱼娘）">
              <defs>
                <!-- DeepSeek 蓝渐变：发色/尾巴/饰件共用 -->
                <linearGradient id="fgHair" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#a8c2ff"/>
                  <stop offset="55%" stop-color="#6b96f5"/>
                  <stop offset="100%" stop-color="#4a72d8"/>
                </linearGradient>
                <linearGradient id="fgDress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#2c4a80"/>
                  <stop offset="100%" stop-color="#223c6e"/>
                </linearGradient>
                <linearGradient id="fgFin" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#4a7fe8"/>
                  <stop offset="100%" stop-color="#2f5fc0"/>
                </linearGradient>
              </defs>
              <!-- 地面投影 -->
              <ellipse class="f-shadow" cx="102" cy="170" rx="56" ry="8"/>
              <g class="f-bob">
                <!-- 大鲸尾（Q 版圆尾，身后） -->
                <g class="f-tail">
                  <path d="M126 146 C146 136 166 128 182 122 C190 134 188 150 176 158 C160 162 140 156 126 146 Z" fill="url(#fgHair)"/>
                </g>
                <!-- 蓝色长发（脑后） -->
                <path class="f-hairback" d="M148 56 C166 76 164 116 158 144 C154 162 138 168 130 156 C138 128 142 96 136 74 Z" fill="url(#fgHair)"/>
                <!-- 女仆裙（深蓝） -->
                <path class="f-dress" d="M84 116 C84 110 116 110 116 116 L124 160 C112 168 88 168 76 160 Z" fill="url(#fgDress)"/>
                <!-- 白围裙 -->
                <path class="f-apron" d="M88 126 L112 126 L118 156 C104 162 96 162 82 156 Z"/>
                <path class="f-apron" d="M85 121 L115 121 L115 128 L85 128 Z"/>
                <!-- 小手手：右手端饭碗 -->
                <circle class="f-hand" cx="120" cy="130" r="6"/>
                <g class="f-bowl">
                  <path class="b-rice" d="M120 138 Q122 128 132 127 Q142 128 144 137 Q136 133 120 138 Z"/>
                  <path class="b-ceramic" d="M118 138 Q121 152 132 153 Q143 152 146 138 Q132 143 118 138 Z"/>
                  <circle class="b-grain g1" cx="128" cy="131" r="1.8"/>
                  <circle class="b-grain g2" cx="135" cy="132" r="1.8"/>
                </g>
                <circle class="f-hand" cx="132" cy="147" r="4.5"/>
                <!-- 左手手 -->
                <circle class="f-hand" cx="79" cy="132" r="5.5"/>
                <!-- 小脚脚 -->
                <ellipse class="f-foot" cx="93" cy="168" rx="7" ry="3.6"/>
                <ellipse class="f-foot" cx="109" cy="168" rx="7" ry="3.6"/>
                <!-- 脸 -->
                <circle class="f-face" cx="100" cy="78" r="42"/>
                <!-- 鲸鳍耳（头两侧） -->
                <path class="f-earfin" d="M56 80 C42 74 30 80 26 92 C38 96 52 94 58 86 Z" fill="url(#fgFin)"/>
                <path class="f-earfin" d="M144 80 C158 74 170 80 174 92 C162 96 148 94 142 86 Z" fill="url(#fgFin)"/>
                <!-- 蓝长发刘海 -->
                <path class="f-bangs" d="M56 80 C52 48 74 36 100 36 C126 36 148 48 144 80 C138 60 128 52 118 58 C112 44 104 42 100 42 C96 42 88 44 82 58 C72 52 62 60 56 80 Z" fill="url(#fgHair)"/>
                <!-- 呆毛（背鳍形） -->
                <path class="f-ahoge" d="M96 36 C94 22 102 14 116 12 C106 22 104 30 104 38 Z" fill="url(#fgFin)"/>
                <!-- 白色女仆发箍 -->
                <path class="f-band" d="M60 46 C80 26 120 26 140 46 C136 38 120 32 100 32 C80 32 64 38 60 46 Z"/>
                <!-- 眉毛（情绪可旋转） -->
                <path class="f-brow" d="M70 80 Q80 75 90 80"/>
                <path class="f-brow" d="M110 80 Q120 75 130 80"/>
                <!-- 眼睛（蓝瞳） -->
                <g class="f-eye">
                  <ellipse class="f-sclera" cx="80" cy="92" rx="10" ry="11"/>
                  <g class="f-pupil-g">
                    <circle class="f-pupil" cx="78" cy="94" r="5"/>
                    <circle class="f-glint" cx="75.8" cy="91.6" r="1.8"/>
                    <circle class="f-glint g2" cx="80.6" cy="97" r="1"/>
                  </g>
                  <rect class="f-lid" x="69" y="80" width="22" height="24" rx="5"/>
                </g>
                <g class="f-eye">
                  <ellipse class="f-sclera" cx="120" cy="92" rx="10" ry="11"/>
                  <g class="f-pupil-g">
                    <circle class="f-pupil" cx="118" cy="94" r="5"/>
                    <circle class="f-glint" cx="115.8" cy="91.6" r="1.8"/>
                    <circle class="f-glint g2" cx="120.6" cy="97" r="1"/>
                  </g>
                  <rect class="f-lid" x="109" y="80" width="22" height="24" rx="5"/>
                </g>
                <!-- 嘴：按情绪显隐 -->
                <path class="f-mouth m-smile" d="M93 111 Q100 117 107 111"/>
                <path class="f-mouth m-grin" d="M91 110 Q100 122 109 108 Q100 116 91 110 Z"/>
                <path class="f-mouth m-open" d="M96 110 Q100 121 104 110 Q100 114 96 110 Z"/>
                <path class="f-mouth m-flat" d="M94 113 L106 113"/>
                <path class="f-mouth m-frown" d="M93 115 Q100 108 107 115"/>
                <!-- 腮红 -->
                <ellipse class="f-blush" cx="71" cy="103" rx="7" ry="3.8"/>
                <ellipse class="f-blush b2" cx="129" cy="103" rx="7" ry="3.8"/>
                <!-- 效果件：汗滴 / 泪 / 火花 / 呼噜 -->
                <path class="f-sweat" d="M142 48 q7 11 0 16 q-7 -5 0 -16 Z"/>
                <circle class="f-tear" cx="78" cy="102" r="3.8"/>
                <g class="f-sparkle">
                  <path d="M158 34 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z"/>
                  <path class="sp2" d="M176 58 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"/>
                </g>
                <g class="f-zzz">
                  <text class="z1" x="140" y="40">z</text>
                  <text class="z2" x="154" y="28">z</text>
                  <text class="z3" x="168" y="18">Z</text>
                </g>
              </g>
            </svg>`;

const start = html.indexOf('<svg class="fish-svg"');
const end = html.indexOf('</svg>', start);
if (start === -1 || end === -1) { console.error('SVG block not found'); process.exit(1); }
html = html.slice(0, start) + NEW_SVG + html.slice(end + '</svg>'.length);
fs.writeFileSync(p, html);
console.log('swapped, new file length:', html.length);
