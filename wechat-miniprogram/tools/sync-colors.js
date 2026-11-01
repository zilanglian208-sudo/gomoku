// 同步小程序 Canvas 配色与网页版一致（一次性脚本）
const fs = require('fs');
const p = 'pages/index/index.js';
let s = fs.readFileSync(p, 'utf8');
s = s.split('#e64338').join('#c0392b')
     .split('#2f9e44').join('#2f6f4f')
     .split('rgba(230,67,56').join('rgba(166,60,47')
     .split('rgba(47,158,68').join('rgba(47,111,79');
fs.writeFileSync(p, s);
console.log('done. e64338 remains:', s.includes('#e64338'), '| c0392b present:', s.includes('#c0392b'));
