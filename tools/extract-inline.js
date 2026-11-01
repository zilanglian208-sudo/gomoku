// 抽取 index.html 内联脚本做语法检查（indexOf 版）
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const startTag = '<script>';
const start = html.indexOf(startTag);
if (start === -1) { console.log('NO INLINE SCRIPT TAG'); process.exit(1); }
const end = html.indexOf('</' + 'script>', start);
const js = html.slice(start + startTag.length, end);
fs.writeFileSync('.tmp-inline.js', js);
console.log('extracted', js.length, 'chars, from', start, 'to', end);
