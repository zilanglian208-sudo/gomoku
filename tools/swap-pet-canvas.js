// v7：桌宠从平面 SVG 换成 Three.js 三维渲染
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1) SVG → WebGL 画布
const s = html.indexOf('<svg class="fish-svg"');
const e = html.indexOf('</svg>', s);
if (s === -1 || e === -1) { console.error('svg block not found'); process.exit(1); }
html = html.slice(0, s) + `<canvas id="petCanvas" width="180" height="230"></canvas>` + html.slice(e + 6);

// 2) 引入 three.js 与 pet3d
html = html.replace(
  '<script src="js/app.js"></script>',
  '<script src="js/lib/three.min.js"></script>\n<script src="js/pet3d.js"></script>\n<script src="js/app.js"></script>'
);

fs.writeFileSync('index.html', html);
console.log('index.html updated, length:', html.length);
