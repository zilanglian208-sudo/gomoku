// v6.2 CSS：桌宠浮窗样式 + 鲸鱼娘部件配色 + 选择器通用化
const fs = require('fs');
const p = 'css/style.css';
let css = fs.readFileSync(p, 'utf8');

const R = [];
// 1) .fish-wrap 定位样式 → 独立桌宠浮窗（fixed，可拖拽）
R.push([`.fish-wrap {
  position: relative; width: 148px; flex: none;
  cursor: pointer; margin-bottom: -6px;
}`,
`.pet {
  position: fixed; left: 14px; bottom: 76px; width: 138px;
  z-index: 45; cursor: grab; touch-action: none;
  filter: drop-shadow(0 12px 18px rgba(40,30,15,.28));
}
.pet.dragging { cursor: grabbing; }
.pet .fish-svg { width: 100%; }
.pet-body { position: relative; }`]);

// 2) 气泡：贴在桌宠头顶
R.push([`.fish-bubble {
  position: absolute; bottom: calc(100% - 4px); left: 6px; right: -16px;`,
`.fish-bubble {
  position: absolute; bottom: calc(100% + 2px); left: -4px; width: max-content; max-width: 220px;`]);

// 3) 鲸鱼娘部件配色（SVG 内无 fill 的部件由这里上色）
R.push([`.f-face { fill: #ffece2; stroke: #d9a184; stroke-width: 2; }`,
`.f-face { fill: #ffece2; stroke: #d9a184; stroke-width: 2; }
.f-hairback { fill: url(#fgHair); opacity: .95; }
.f-bangs { fill: url(#fgHair); stroke: #2a3c66; stroke-width: 2; }
.f-ahoge { fill: #2b3f8c; stroke: #2b3f8c; stroke-width: 1; }
.f-band { fill: #fdfbf4; stroke: #d8e0ee; stroke-width: 1.5; }
.f-earfin { fill: #2c3e78; }
.f-earfin .f-earfin-in { fill: #7fa0e8; }
.f-tail path { fill: #2c3e78; stroke: #7fa0e8; stroke-width: 2; }
.f-dress { fill: url(#fgDress); stroke: #1c3258; stroke-width: 1.5; }
.f-frill { fill: #fdfbf4; stroke: #d8e0ee; stroke-width: 1.5; }
.f-apron { fill: #fdfbf4; stroke: #d8e0ee; stroke-width: 1.5; }
.f-whale { fill: #3d6ce0; }
.f-bib { fill: #fdfbf4; stroke: #d8e0ee; stroke-width: 1.5; }
.f-btn { fill: #2c3e78; }
.f-ribbon { fill: #3d6ce0; }
.f-gem { fill: #8fb0ff; stroke: #d8e0ee; stroke-width: 1; }
.f-sleeve { fill: #2c3e78; stroke: #1c3258; stroke-width: 1.5; }
.f-hand { fill: #ffece2; stroke: #d9a184; stroke-width: 1.5; }
.f-sock { fill: #fdfbf4; stroke: #d8e0ee; stroke-width: 1.5; }
.f-shoe { fill: #2c3e78; stroke: #1c3258; stroke-width: 1.5; }
.f-buckle { fill: #d4af5e; }
.f-brow { stroke: #2b3f8c; stroke-width: 2.5; }`]);

// 4) 表情/交互选择器通用化（桌宠元素上直接生效）
R.push([`.fish-wrap.blink .f-lid`, `.blink .f-lid`]);
R.push([`.fish-wrap[data-mood=`, `[data-mood=`]);
R.push([`.fish-wrap.poke .fish-svg`, `.poke .fish-svg`]);

// 5) 移除不再存在的布局规则
R.push([`.opponent-row { display: flex; align-items: flex-end; gap: 12px; }
.fish-wrap`, `.f-stub {
.fish-wrap`]);
R.push([`.status-col { flex: 1; min-width: 0; padding-bottom: 6px; }
`, ``]);

let miss = 0;
for (const [from, to] of R) {
  if (!css.includes(from)) { console.error('MISS:', JSON.stringify(from.slice(0, 70))); miss++; continue; }
  css = css.split(from).join(to);
}
fs.writeFileSync(p, css);
console.log(miss === 0 ? 'css all applied' : miss + ' missed');
