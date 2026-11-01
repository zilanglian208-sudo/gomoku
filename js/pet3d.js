/*!
 * 五子棋 · 桌宠三维渲染 (pet3d.js)
 * ==================================================================
 * 用 Three.js 基础几何体复现「DeepSeek 娘」Q 版设定（2 头身鲸鱼娘）：
 *   大头 + 蓝渐变大波浪长发 + 弯钩呆毛 + 白色褶边发箍 + 鲸鳍耳(带蓝结)
 *   + 深蓝女仆裙/白围裙(小鲸鱼刺绣) + 蓝瞳大眼 + 白袜玛丽珍 + 大鲸尾。
 * 参考物：DeepSeek 娘 Q 版三视图设定集（社区二创，CC BY-NC-SA）。
 *
 * 依赖：js/lib/three.min.js（r128 UMD，全局 THREE，随仓库分发）
 * 接口：观察 #fish 的 data-mood 属性（app.js 写入），驱动表情状态机。
 *
 * 模块分区：
 *   [0] 场景/灯光/三阶卡通着色器
 *   [1] 材质表
 *   [2] 几何快捷函数
 *   [3] 角色组装（严格按设定集比例：头身比 2:1）
 *   [4] 表情状态机（data-mood → 眼/眉/嘴/头/手臂/摆尾目标值）
 *   [5] 待机行为（眨眼/呼吸/视线跟随/被拖拽扑腾）
 *   [6] 渲染循环与交互
 * ==================================================================
 */
(function () {
  'use strict';

  const canvas = document.getElementById('petCanvas');
  const fishEl = document.getElementById('fish');
  const petEl = document.getElementById('pet');
  if (!canvas || !fishEl || typeof THREE === 'undefined') return;

  /* ================================================================
   * [0] 场景 / 灯光 / 三阶卡通着色
   * ================================================================ */
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 60);
  camera.position.set(0, 1.8, 9.4);
  camera.lookAt(0, 1.75, 0);

  // 三阶明暗渐变贴图 → MeshToonMaterial 呈现赛璐璐式色块
  const gradTex = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.LuminanceFormat);
  gradTex.minFilter = THREE.NearestFilter;
  gradTex.magFilter = THREE.NearestFilter;
  gradTex.needsUpdate = true;
  function toon(color) { return new THREE.MeshToonMaterial({ color, gradientMap: gradTex }); }

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xfff4e0, 0.85);
  keyLight.position.set(2.5, 6, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xbfd4ff, 0.2);
  fillLight.position.set(-3, 2, 2);
  scene.add(fillLight);

  // 阴影承接面（透明画布上只显示阴影）
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 32),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ================================================================
   * [1] 材质表
   * ================================================================ */
  const M = {
    skin:  toon(0xffece2),
    hair:  toon(0x2e4292),          // 深藏蓝（设定集主色）
    hairTip: toon(0x6f92e8),        // 发梢浅蓝
    navy:  toon(0x24356e),          // 女仆裙藏青
    navyDark: toon(0x18254c),
    white: toon(0xfdfbf4),
    blush: new THREE.MeshBasicMaterial({ color: 0xff9aa4, transparent: true, opacity: 0.6 }),
    irisTop: new THREE.MeshBasicMaterial({ color: 0x6fa0f0 }),
    irisBtm: new THREE.MeshBasicMaterial({ color: 0x2b57c8 }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x14264e }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mouth: new THREE.MeshBasicMaterial({ color: 0x7c4638 }),
    mouthIn: new THREE.MeshBasicMaterial({ color: 0xc2506a }),
    ribbon: toon(0x3d6ce0),
    gem:   new THREE.MeshBasicMaterial({ color: 0x8fb0ff }),
    star:  new THREE.MeshBasicMaterial({ color: 0xd4af5e }),
  };

  /* ================================================================
   * [2] 几何快捷函数
   * ================================================================ */
  function sph(r, mat, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 18), mat);
    m.position.set(x, y, z);
    if (sx) m.scale.set(sx, sy || sx, sz || sx);
    m.castShadow = true;
    return m;
  }
  function cyl(rt, rb, h, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 24), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }
  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }
  function torus(r, t, arc, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 28, arc), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  /* ================================================================
   * [3] 角色组装 —— 2 头身：头(含发) y1.6..3.6，身 y0.6..1.7，腿 y0..0.6
   * ================================================================ */
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  const headG = new THREE.Group();      // 头（歪头/看向鼠标）
  const tailG = new THREE.Group();      // 鲸尾
  const armL = new THREE.Group(), armR = new THREE.Group();
  const legL = new THREE.Group(), legR = new THREE.Group();
  const eyeL = new THREE.Group(), eyeR = new THREE.Group();
  const mouthG = new THREE.Group();
  scene.add(root);
  root.add(bodyG, headG);

  /* ---- 头（大头：脸 r1.0 + 头发轮廓 r1.16，2 头身） ---- */
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

  /* ---- 身体：深蓝女仆裙 + 白围裙(小鲸鱼刺绣) + 褶边 ---- */
  bodyG.add(cyl(0.42, 0.95, 0.95, M.navy, 0, 1.12, 0));        // 裙
  const apron = cyl(0.34, 0.72, 0.6, M.white, 0, 1.08, 0.14);  // 围裙（前弧）
  apron.geometry = new THREE.CylinderGeometry(0.34, 0.72, 0.6, 20, 1, true, -0.8, 1.6);
  bodyG.add(apron);
  bodyG.add(torus(0.94, 0.06, Math.PI * 2, M.white, 0, 0.66, 0)); // 白褶边裙摆
  // 围裙上的小鲸鱼刺绣
  bodyG.add(sph(0.075, M.navyDark, 0, 0.94, 0.66, 1.3, 0.9, 0.4));
  bodyG.add(sph(0.045, M.navyDark, 0.1, 0.99, 0.64, 0.8, 0.5, 0.4));
  // 白衬衣 + 纽扣
  const bib = box(0.46, 0.5, 0.08, M.white, 0, 1.42, 0.4);
  bib.rotation.x = -0.06;
  bodyG.add(bib);
  [1.32, 1.38, 1.44].forEach(y => bodyG.add(sph(0.035, M.navyDark, 0, y, 0.45)));
  // 领口蓝蝴蝶结 + 宝石
  bodyG.add(sph(0.09, M.ribbon, 0, 1.56, 0.44, 1.4, 0.75, 0.5));
  bodyG.add(sph(0.06, M.ribbon, 0, 1.56, 0.5));
  bodyG.add(sph(0.05, M.gem, 0, 1.56, 0.56));
  // 裙身金色小星
  [[-0.32, 0.95], [0.28, 1.05], [0.02, 0.8]].forEach(([x, y]) =>
    bodyG.add(sph(0.03, M.star, x, y, 0.68)));
  // 泡泡袖 + 手臂（肩关节组）
  bodyG.add(sph(0.19, M.navy, -0.52, 1.5, 0));
  bodyG.add(sph(0.19, M.navy, 0.52, 1.5, 0));
  armL.position.set(-0.56, 1.48, 0);
  armR.position.set(0.56, 1.48, 0);
  armL.add(sph(0.12, M.skin, -0.13, -0.3, 0.03, 0.6, 1.5, 0.6));
  armR.add(sph(0.12, M.skin, 0.13, -0.3, 0.03, 0.6, 1.5, 0.6));
  armL.add(sph(0.12, M.skin, -0.2, -0.55, 0.06));
  armR.add(sph(0.12, M.skin, 0.2, -0.55, 0.06));
  bodyG.add(armL, armR);
  // 腿：白袜（褶边）+ 藏青玛丽珍鞋（金扣）
  legL.position.set(-0.22, 0.6, 0);
  legR.position.set(0.22, 0.6, 0);
  legL.add(sph(0.12, M.white, 0, -0.18, 0, 0.7, 1.4, 0.7));
  legR.add(sph(0.12, M.white, 0, -0.18, 0, 0.7, 1.4, 0.7));
  legL.add(sph(0.07, M.white, 0, -0.3, 0.05, 1, 0.6, 1));
  legR.add(sph(0.07, M.white, 0, -0.3, 0.05, 1, 0.6, 1));
  legL.add(sph(0.17, M.navyDark, 0, -0.44, 0.06, 1.4, 0.6, 1.6));
  legR.add(sph(0.17, M.navyDark, 0, -0.44, 0.06, 1.4, 0.6, 1.6));
  legL.add(sph(0.035, M.star, 0.05, -0.42, 0.16));
  legR.add(sph(0.035, M.star, -0.05, -0.42, 0.16));
  bodyG.add(legL, legR);

  /* ---- 大鲸尾（身后右侧，上翘双叶） ---- */
  tailG.position.set(0.2, 0.9, -0.55);
  tailG.rotation.y = 0.32;
  tailG.add(sph(0.34, M.navy, 0.2, -0.12, -0.28, 1, 0.9, 1.7));
  tailG.add(sph(0.3, M.navy, 0.48, 0.22, -0.55, 1, 0.9, 1.5));
  const fluke1 = sph(0.5, M.navy, 0.66, 0.78, -0.62, 1.6, 0.5, 0.5);
  fluke1.rotation.z = 1.0;
  const fluke2 = sph(0.5, M.navy, 0.74, 0.22, -0.64, 1.6, 0.5, 0.5);
  fluke2.rotation.z = -0.7;
  tailG.add(fluke1, fluke2);
  root.add(tailG);

  /* ================================================================
   * [4] 表情状态机 —— data-mood → 各部件目标姿态
   * ================================================================ */
  const MOODS = {
    idle:      { eye: 1,    mouth: 'smile', brow: 0,     headX: 0,     armZ: 0.25, tail: 3 },
    thinking:  { eye: 0.5,  mouth: 'flat',  brow: -0.12, headX: -0.14, armRX: -2.1, armZ: 0.15, tail: 6, headTilt: 0.14 },
    smug:      { eye: 0.55, mouth: 'grin',  brow: -0.05, armZ: 2.3,    tail: 5, headTilt: -0.12 },
    surprised: { eye: 1.35, mouth: 'open',  brow: 0.25,  armZ: 0.7,    tail: 7 },
    happy:     { eye: 0.8,  mouth: 'grin',  brow: -0.15, armZ: 2.6,    tail: 8, hop: true },
    sad:       { eye: 0.6,  mouth: 'frown', brow: 0.32,  headX: 0.4,   armZ: 0.05, tail: 1.2 },
    angry:     { eye: 0.75, mouth: 'frown', brow: 0.45,  armZ: 0.45,   tail: 9, shake: true },
    sleep:     { eye: 0.06, mouth: 'smile', brow: 0,     headX: 0.22,  armZ: 0.1,  tail: 1 },
  };
  let mood = 'idle';
  new MutationObserver(() => {
    const m = fishEl.dataset.mood;
    if (MOODS[m]) mood = m;
  }).observe(fishEl, { attributes: true, attributeFilter: ['data-mood'] });

  /* ================================================================
   * [5] 待机行为
   * ================================================================ */
  let blinkT = 0, nextBlink = 2.5;
  let pokeK = 1;
  let cursor = { x: 0, y: 0 };
  window.addEventListener('mousemove', e => {
    cursor.x = (e.clientX / window.innerWidth) * 2 - 1;
    cursor.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ================================================================
   * [6] 渲染循环
   * ================================================================ */
  const clock = new THREE.Clock();
  const cur = { eye: 1, brow: 0, headX: 0, headTilt: 0, armZ: 0.25, armRX: 0, tailSpeed: 3 };
  const lerp = (a, b, k) => a + (b - a) * k;
  window.__petFrames = 0;
  window.__pet3dErr = null;

  function animate() {
    requestAnimationFrame(animate);
    try {
      const t = clock.getElapsedTime();
      const dt = Math.min(0.05, clock.getDelta());
      const cfg = MOODS[mood] || MOODS.idle;
      const k = 1 - Math.pow(0.0015, dt);
      window.__petFrames++;

      // 呼吸浮动 + 跳跃/抖动
      let rootY = Math.sin(t * 2.2) * 0.05;
      if (cfg.hop) rootY += Math.abs(Math.sin(t * 5)) * 0.3;
      if (cfg.shake) root.position.x = Math.sin(t * 40) * 0.06;
      else root.position.x = 0;
      root.position.y = rootY;

      // 果冻反弹（戳一戳）
      if (pokeK < 1) {
        pokeK = Math.min(1, pokeK + dt / 0.42);
        const s = Math.sin(pokeK * Math.PI) * 0.12;
        root.scale.set(1 + s, 1 - s * 0.7, 1 + s);
        if (pokeK >= 1) root.scale.set(1, 1, 1);
      }

      // 眨眼
      blinkT += dt;
      if (blinkT > nextBlink && cfg.eye > 0.3) {
        blinkT = 0; nextBlink = 2.4 + Math.random() * 2.2;
        eyeL.scale.y = eyeR.scale.y = 0.06;
      }
      const blinkRecover = eyeL.scale.y < 1 ? Math.min(1, eyeL.scale.y + dt * 7) : 1;
      cur.eye = lerp(cur.eye, cfg.eye, k);
      const eyeScaleY = Math.min(blinkRecover, cur.eye);
      eyeL.scale.y = eyeR.scale.y = eyeScaleY;

      // 头：俯仰 + 歪头 + 看向鼠标
      cur.headX = lerp(cur.headX, cfg.headX, k);
      cur.headTilt = lerp(cur.headTilt, cfg.headTilt || 0, k);
      headG.rotation.x = cur.headX;
      headG.rotation.z = cur.headTilt;
      headG.rotation.y = lerp(headG.rotation.y, cursor.x * 0.3, k * 0.6);
      // 瞳孔（irisG 整组）追鼠标
      const px = cursor.x * 0.06, py = -cursor.y * 0.05;
      [eyeL, eyeR].forEach(g => {
        const irisG = g.userData.irisG;
        if (irisG) irisG.position.set(px, py, 0);
      });

      // 眉毛
      cur.brow = lerp(cur.brow, cfg.brow, k);
      browL.rotation.z = cur.brow;
      browR.rotation.z = -cur.brow;
      browL.position.y = 0.4 + Math.max(0, cur.brow) * 0.12;
      browR.position.y = 0.4 + Math.max(0, cur.brow) * 0.12;

      // 嘴形切换
      mouthG.children.forEach(c => { c.visible = false; });
      const shape = { smile: mouthSmile, grin: mouthGrin, open: mouthOpen, flat: mouthFlat, frown: mouthFrown }[cfg.mouth];
      if (shape) shape.visible = true;

      // 手臂
      cur.armZ = lerp(cur.armZ, cfg.armZ, k);
      cur.armRX = lerp(cur.armRX, cfg.armRX || 0, k);
      armL.rotation.z = -cur.armZ;
      armR.rotation.z = cur.armZ;
      armR.rotation.x = cur.armRX;
      armL.rotation.x = cfg.armRX ? -cur.armRX * 0.4 : 0;

      // 摆尾 + 呆毛
      cur.tailSpeed = lerp(cur.tailSpeed, cfg.tail, k);
      tailG.rotation.y = 0.3 + Math.sin(t * cur.tailSpeed) * 0.3;
      tailG.rotation.z = Math.sin(t * cur.tailSpeed * 0.7) * 0.12;
      ahoge.rotation.z = -0.4 + Math.sin(t * (mood === 'thinking' ? 8 : 2.6)) * 0.2;

      // 被拖拽时小短腿扑腾
      if (petEl.classList.contains('dragging')) {
        legL.rotation.x = Math.sin(t * 14) * 0.7;
        legR.rotation.x = -Math.sin(t * 14) * 0.7;
      } else {
        legL.rotation.x = lerp(legL.rotation.x, 0, k);
        legR.rotation.x = lerp(legR.rotation.x, 0, k);
      }

      renderer.render(scene, camera);
    } catch (err) { window.__pet3dErr = (window.__pet3dErr || '') + err.message + '\n'; }
  }
  animate();

  /* ================================================================
   * 交互：点击桌宠 → 果冻反弹（台词/连戳计分由 app.js 的 click 处理）
   * ================================================================ */
  canvas.addEventListener('click', () => {
    if (fishEl.dataset.dragged) return;
    pokeK = 0;
  });

  window.addEventListener('resize', () => {
    renderer.setSize(canvas.width, canvas.height, false);
    camera.aspect = canvas.width / canvas.height;
    camera.updateProjectionMatrix();
  });
})();
