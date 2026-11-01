// 生成小程序音效 WAV 文件（16-bit PCM 单声道 22050Hz）
// 运行：node tools/gen-sounds.js
const fs = require('fs');
const path = require('path');
const SR = 22050;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE((v * 32767) | 0, i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// 单音：freq Hz、dur 秒、衰减指数、音量
function tone(freq, dur, decay, vol, delaySec) {
  const n0 = Math.floor((delaySec || 0) * SR);
  const n = Math.floor(dur * SR);
  const out = new Array(n0 + n).fill(0);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-decay * t);
    // 基音 + 少量二次谐波，更像木质落子声
    out[n0 + i] = vol * env * (Math.sin(2 * Math.PI * freq * t) + .35 * Math.sin(4 * Math.PI * freq * t));
  }
  return out;
}

function mix(...parts) {
  const maxLen = Math.max(...parts.map(p => p.length));
  const out = new Array(maxLen).fill(0);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

const sounds = {
  // 黑子（低）/ 白子（高）落子声
  'stone-black.wav': tone(235, .18, 26, .8),
  'stone-white.wav': tone(320, .18, 26, .8),
  // 胜利：上行四音 + 高音收尾
  'win.wav': mix(tone(523, .3, 9, .55, 0), tone(659, .3, 9, .55, .13), tone(784, .3, 9, .55, .26), tone(1047, .42, 7, .55, .39), tone(1319, .5, 6, .35, .55)),
  // 失败：下行三音
  'lose.wav': mix(tone(392, .34, 8, .55, 0), tone(311, .34, 8, .55, .18), tone(262, .5, 6, .55, .36)),
  // 平局：双同音
  'draw.wav': mix(tone(440, .22, 10, .5, 0), tone(440, .3, 8, .5, .25)),
};

const dir = path.join(__dirname, '..', 'assets', 'sounds');
for (const [name, samples] of Object.entries(sounds)) {
  fs.writeFileSync(path.join(dir, name), wav(samples));
  console.log('generated', name, wav(samples).length, 'bytes');
}
