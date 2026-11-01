// 从画廊页面提取图片 URL
const fs = require('fs');
const h = fs.readFileSync('.tmp-gallery.html', 'utf8');
console.log('page length:', h.length);
const urls = [...h.matchAll(/(?:src|href)=["']([^"']+\.(?:png|jpg|jpeg|webp|svg))["']/gi)]
  .map(m => m[1]);
console.log('image urls found:', urls.length);
console.log([...new Set(urls)].slice(0, 40).join('\n'));
// 也找找 JSON 数据或 background-image
const bg = [...h.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
console.log('bg urls:', [...new Set(bg)].slice(0, 10).join('\n'));
