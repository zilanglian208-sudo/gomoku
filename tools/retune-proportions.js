// 按设定集三视图微调 3D 鲸鱼娘比例（v6.3）
const fs = require('fs');
const p = 'js/pet3d.js';
let c = fs.readFileSync(p, 'utf8');

const oldHeadStart = c.indexOf('/* ---- 头（大头');
const oldHeadEnd = c.indexOf('/* ---- 身体');
if (oldHeadStart === -1 || oldHeadEnd === -1) { console.error('head block not found'); process.exit(1); }

const NEW_HEAD = `/* ---- 头（大头：脸 r1.0 + 头发轮廓 r1.16，2 头身） ---- */
  headG.position.set(0, 2.62, 0);
  headG.add(sph(1.0, M.skin, 0, 0, 0));                       // 脸
  // 脑后长发大体积（垂到裙摆）
  headG.add(sph(1.0, M.hair, 0, -0.4, -0.5, 1.15, 1.6, 0.78));
  // 头顶发帽（盖住头顶，前缘在额头上方）
  const hairCap = sph(1.12, M.hair, 0, 0.08, -0.1);
  hairCap.geometry = new THREE.SphereGeometry(1.12, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6);
  hairCap.rotation.x = -0.34;
  headG.add(hairCap);
  // 两侧长卷发（垂坠 + 浅色发梢）
  headG.add(sph(0.55, M.hair, -1.0, -0.3, -0.05, 0.8, 2.5, 0.75));
  headG.add(sph(0.55, M.hair, 1.0, -0.3, -0.05, 0.8, 2.5, 0.75));
  headG.add(sph(0.46, M.hairTip, -1.03, -1.5, -0.02, 0.75, 0.6, 0.7));
  headG.add(sph(0.46, M.hairTip, 1.03, -1.5, -0.02, 0.75, 0.6, 0.7));
  // 脑后发梢三撮（浅色波浪）
  headG.add(sph(0.36, M.hairTip, -0.55, -1.2, -0.5, 0.9, 0.6, 0.6));
  headG.add(sph(0.36, M.hairTip, 0, -1.3, -0.55, 0.9, 0.6, 0.6));
  headG.add(sph(0.36, M.hairTip, 0.55, -1.2, -0.5, 0.9, 0.6, 0.6));
  // 刘海（前额圆齿）
  headG.add(sph(0.34, M.hair, -0.5, 0.56, 0.6, 1, 0.75, 0.62));
  headG.add(sph(0.36, M.hair, 0, 0.62, 0.7, 1, 0.75, 0.62));
  headG.add(sph(0.34, M.hair, 0.5, 0.56, 0.6, 1, 0.75, 0.62));
  // 弯钩呆毛（大钩，设定集最显眼特征）
  const ahoge = torus(0.34, 0.11, 4.7, M.navyDark, 0.02, 1.2, -0.1);
  ahoge.rotation.z = -0.4; ahoge.rotation.x = 0.18;
  headG.add(ahoge);
  // 白色褶边女仆发箍（环 + 沿弧褶边小球）
  const band = torus(1.06, 0.09, Math.PI * 2, M.white, 0, 0.64, -0.02);
  band.rotation.x = 1.32;
  headG.add(band);
  [[-0.62, 0.5, 0.42], [-0.32, 0.66, 0.58], [0, 0.72, 0.62], [0.32, 0.66, 0.58], [0.62, 0.5, 0.42]]
    .forEach(([x, y, z]) => headG.add(sph(0.12, M.white, x, y, z, 1, 0.75, 0.6)));
  // 鲸鳍耳（深蓝外鳍 + 浅蓝内鳍 + 蓝蝴蝶结）
  function earfin(side) {
    const g = new THREE.Group();
    g.add(sph(0.56, M.navy, side * 1.08, 0.2, -0.02, 0.6, 0.6, 0.3));
    g.add(sph(0.4, M.hairTip, side * 1.15, 0.16, 0.04, 0.42, 0.44, 0.22));
    const bow = new THREE.Group();
    bow.add(sph(0.1, M.ribbon, side * 1.06, 0.46, 0.12, 1.4, 0.7, 0.6));
    bow.add(sph(0.055, M.ribbon, side * 1.06, 0.46, 0.16));
    g.add(bow);
    return g;
  }
  headG.add(earfin(-1), earfin(1));
  // 眼睛（大蓝瞳；眨眼 = 眼组 scaleY）
  function buildEye(x) {
    const g = new THREE.Group();
    g.position.set(x, 0.06, 0.84);
    g.add(sph(0.24, new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0, 0, 1, 1.18, 0.4));
    g.add(sph(0.2, M.irisTop, 0, 0.03, 0.06));
    g.add(sph(0.18, M.irisBtm, 0, -0.05, 0.08));
    g.add(sph(0.1, M.pupil, 0, -0.01, 0.14));
    g.add(sph(0.065, M.glint, 0.065, 0.08, 0.19));
    g.add(sph(0.035, M.glint, -0.07, -0.06, 0.19));
    const lash = box(0.46, 0.065, 0.05, M.navyDark, 0, 0.19, 0.1);
    lash.rotation.z = x < 0 ? 0.1 : -0.1;
    g.add(lash);
    const irisG = new THREE.Group();
    g.add(irisG);
    g.userData.irisG = irisG;
    return g;
  }
  eyeL.add(buildEye(-0.4));
  eyeR.add(buildEye(0.4));
  headG.add(eyeL, eyeR);
  // 眉毛
  const browL = box(0.3, 0.05, 0.05, M.navyDark, -0.4, 0.46, 0.8);
  const browR = box(0.3, 0.05, 0.05, M.navyDark, 0.4, 0.46, 0.8);
  headG.add(browL, browR);
  // 腮红
  const blushL = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), M.blush);
  blushL.position.set(-0.56, -0.28, 0.74); blushL.rotation.y = 0.22;
  const blushR = blushL.clone(); blushR.position.x = 0.56; blushR.rotation.y = -0.22;
  headG.add(blushL, blushR);
  // 嘴（五种形状按情绪显隐）
  const mouthSmile = torus(0.13, 0.04, 2.4, M.mouth, 0, -0.44, 0.9);
  mouthSmile.rotation.z = Math.PI + (Math.PI - 2.4) / 2;
  const mouthGrin = sph(0.12, M.mouthIn, 0, -0.5, 0.9, 1.5, 1.1, 0.5);
  const mouthOpen = sph(0.09, M.mouthIn, 0, -0.5, 0.9, 1.1, 1.5, 0.5);
  const mouthFlat = box(0.24, 0.04, 0.05, M.mouth, 0, -0.48, 0.9);
  const mouthFrown = torus(0.13, 0.04, 2.2, M.mouth, 0, -0.4, 0.9);
  mouthFrown.rotation.z = Math.PI - (Math.PI - 2.2) / 2;
  mouthG.add(mouthSmile, mouthGrin, mouthOpen, mouthFlat, mouthFrown);
  headG.add(mouthG);

  `;

c = c.slice(0, oldHeadStart) + NEW_HEAD + c.slice(oldHeadEnd);

// 鲸尾加大：更粗的尾柄 + 更大的双叶尾鳍（从身体右侧探出）
c = c.replace(
  `tailG.position.set(0.14, 0.9, -0.5);
  tailG.rotation.y = 0.3;
  tailG.add(sph(0.3, M.navy, 0.18, -0.1, -0.25, 1, 0.9, 1.6));
  tailG.add(sph(0.26, M.navy, 0.42, 0.18, -0.5, 1, 0.9, 1.4));
  const fluke1 = sph(0.42, M.navy, 0.55, 0.62, -0.6, 1.5, 0.5, 0.5);
  fluke1.rotation.z = 1.0;
  const fluke2 = sph(0.42, M.navy, 0.62, 0.18, -0.62, 1.5, 0.5, 0.5);
  fluke2.rotation.z = -0.7;`,
  `tailG.position.set(0.2, 0.9, -0.55);
  tailG.rotation.y = 0.32;
  tailG.add(sph(0.34, M.navy, 0.2, -0.12, -0.28, 1, 0.9, 1.7));
  tailG.add(sph(0.3, M.navy, 0.48, 0.22, -0.55, 1, 0.9, 1.5));
  const fluke1 = sph(0.5, M.navy, 0.66, 0.78, -0.62, 1.6, 0.5, 0.5);
  fluke1.rotation.z = 1.0;
  const fluke2 = sph(0.5, M.navy, 0.74, 0.22, -0.64, 1.6, 0.5, 0.5);
  fluke2.rotation.z = -0.7;`);

fs.writeFileSync(p, c);
console.log('proportions updated, file length:', c.length);
