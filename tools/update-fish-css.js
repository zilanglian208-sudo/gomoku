// 更新鲸鱼娘的 CSS：逐条替换（对空白不敏感）
const fs = require('fs');
const p = 'css/style.css';
let css = fs.readFileSync(p, 'utf8');

const R = [];
// 眉毛 → 女孩配色 + fill-box，并顺带挂上全部新部件样式与呆毛动画
R.push([`.f-brow { fill: none; stroke: #143c5c; stroke-width: 4; stroke-linecap: round; }`,
`.f-face { fill: #ffece2; stroke: #d9a184; stroke-width: 2; }
.f-hairback { opacity: .92; }
.f-bangs { stroke: #3a5cb8; stroke-width: 2; }
.f-ahoge, .f-earfin { stroke: #2f5fc0; stroke-width: 1.5; }
.f-band { fill: #fdfbf4; stroke: #b9c4d8; stroke-width: 1.5; }
.f-dress { stroke: #1c3258; stroke-width: 1.5; }
.f-apron { fill: #fdfbf4; stroke: #b9c4d8; stroke-width: 1.5; }
.f-hand { fill: #ffece2; stroke: #d9a184; stroke-width: 1.5; }
.f-foot { fill: #fdfbf4; stroke: #b9c4d8; stroke-width: 1.5; }
.f-brow { fill: none; stroke: #2a3c66; stroke-width: 3; stroke-linecap: round; transform-box: fill-box; transform-origin: center; }
/* 呆毛摆动 */
.f-ahoge { transform-box: fill-box; transform-origin: 50% 100%; animation: fAhoge 3s ease-in-out infinite alternate; }
@keyframes fAhoge { from { transform: rotate(-8deg); } to { transform: rotate(10deg); } }
.fish-wrap[data-mood="thinking"] .f-ahoge { animation-duration: 1s; }`]);
// 巩膜 → 藏青描边 + 居中缩放原点
R.push([`.f-sclera { fill: #fff; stroke: #143c5c; stroke-width: 2; }`,
`.f-sclera { fill: #fff; stroke: #2a3c66; stroke-width: 2; transform-box: fill-box; transform-origin: center; }`]);
// 瞳孔 → 蓝瞳
R.push([`.f-pupil { fill: #143c5c; }`, `.f-pupil { fill: #2f5fc0; }`]);
// 眼睑 → 发色眼睑 + 顶部原点
R.push([`.f-lid { fill: #2f95d0; stroke: #143c5c; stroke-width: 2; transform: scaleY(0); transform-origin: 66px 66px; }`,
`.f-lid { fill: #6b96f5; stroke: #4a72d8; stroke-width: 2; transform: scaleY(0); transform-box: fill-box; transform-origin: 50% 0%; }`]);
// 嘴 → 暖棕线 + 粉口腔
R.push([`.f-mouth { fill: none; stroke: #143c5c; stroke-width: 3.5; stroke-linecap: round; display: none; }`,
`.f-mouth { fill: none; stroke: #8a5040; stroke-width: 3; stroke-linecap: round; display: none; }`]);
R.push([`.m-grin, .m-open { fill: #7c2d3e; stroke: #143c5c; }`,
`.m-grin, .m-open { fill: #c2506a; stroke: #8a5040; }`]);
// 腮红 → 更粉
R.push([`.f-blush { fill: rgba(255,120,130,.55); opacity: .55; }`,
`.f-blush { fill: rgba(255,130,140,.55); opacity: .55; }`]);
// 尾/鳍 → fill-box 原点
R.push([`.f-tail { transform-origin: 164px 96px;`, `.f-tail { transform-box: fill-box; transform-origin: 0% 60%;`]);
R.push([`.f-fin { transform-origin: 84px 122px;`, `.f-fin { transform-box: fill-box; transform-origin: 50% 0%;`]);
// 情绪规则里残留的像素原点 → fill-box
R.push([`transform-origin: 66px 66px;`, `transform-box: fill-box; transform-origin: 50% 0%;`]);
R.push([`transform-origin: 66px 82px;`, `transform-box: fill-box; transform-origin: center;`]);
R.push([`transform-origin: 66px 85px;`, `transform-box: fill-box; transform-origin: center;`]);
R.push([`transform-origin: 66px 58px;`, `transform-box: fill-box; transform-origin: center;`]);

let miss = 0;
for (const [from, to] of R) {
  if (!css.includes(from)) { console.error('MISS:', from.slice(0, 60)); miss++; continue; }
  css = css.split(from).join(to);
}
fs.writeFileSync(p, css);
console.log(miss === 0 ? 'all replacements applied' : miss + ' replacements missed');
