// 生成带错误捕获的调试副本 index-debug.html
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const probe = '<script>window.__errs=[];window.addEventListener("error",function(e){window.__errs.push(String(e.message)+" @ line "+e.lineno);});</script>';
html = html.replace('<head>', '<head>' + probe);
fs.writeFileSync('index-debug.html', html);
console.log('debug copy written, probe injected:', html.includes('__errs'));
