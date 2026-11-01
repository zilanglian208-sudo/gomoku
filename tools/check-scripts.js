// 检查 index.html 的 script 标签分布
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
console.log('total length:', html.length);
let i = 0;
while (true) {
  const p = html.indexOf('<script', i);
  if (p === -1) break;
  console.log('at', p, ':', JSON.stringify(html.slice(p, p + 40)));
  i = p + 1;
}
const tail = html.slice(-300);
console.log('TAIL:', JSON.stringify(tail));
