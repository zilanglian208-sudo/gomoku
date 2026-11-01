# 智能五子棋 · 微信小程序版

本项目是 `E:\wuziqi` 网页版五子棋的微信小程序移植版：
**AI 引擎原样复用**（`utils/engine.js`），界面层用 WXML/WXSS + Canvas 重写，
包含网页版的全部 v2.0 特性（落子动画、音效、AI 台词、计时器、连胜、纸屑）。

## 上线步骤（需要你本人操作）

### 1. 注册小程序账号
1. 打开 https://mp.weixin.qq.com → 立即注册 → 选「小程序」
2. 用邮箱注册，主体类型选「个人」，用身份证+微信扫码验证
3. 注册完成后在「设置 → 基本设置」里能看到 **AppID**（类似 `wx1234567890abcdef`）

### 2. 填入 AppID
把本项目 `project.config.json` 里的 `"touristappid"` 换成你的 AppID。

### 3. 安装微信开发者工具并导入项目
1. 下载「微信开发者工具（稳定版）」：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. 打开工具，用微信扫码登录
3. 「导入项目」→ 选择本目录（`wechat-miniprogram`）→ AppID 会自动读取
4. 模拟器里应该立刻看到游戏；点「预览」生成二维码，用手机微信扫码即可真机试玩

### 4. 提交审核并发布
1. 开发者工具右上角「上传」，填版本号（如 1.0.0）和备注
2. 回到 mp.weixin.qq.com →「版本管理」→「开发版本」→「提交审核」
3. 类目建议：**休闲益智**（个人主体可用的类目；如被要求补充资质按提示处理）
4. 审核通常 1-3 天，通过后点「发布」，用户就能在微信里搜索/扫码玩了

## ⚠️ 上架前必读

- **类目与资质**：个人主体的小程序没有「游戏」类目。五子棋这类无内购休闲棋类，
  通常以「休闲益智」等类目提审可以通过，但**微信的审核政策会变化**，以提交时的实际提示为准。
  如果个人主体被驳回，需要注册企业主体（个体工商户也可以）再发。
- **名称唯一**：小程序名称全微信唯一，建议提前想好 2-3 个备选（如「五子棋智能对弈」）。
- 本目录代码按官方 Canvas 2D / InnerAudioContext API 编写并通过语法校验，
  **但最终以开发者工具真机预览为准**——如遇 API 版本差异，开发者工具的控制台会给出具体提示。

## 目录结构

```
project.config.json   项目配置（AppID 在这里填）
app.json / app.js     小程序入口与全局配置
utils/engine.js       AI 引擎（与网页版 game.js 完全一致，CommonJS 模块）
pages/index/          游戏页（WXML 布局 + Canvas 棋盘 + 控制器）
assets/sounds/        WAV 音效（由 tools/gen-sounds.js 生成）
tools/gen-sounds.js   音效生成脚本（node tools/gen-sounds.js 可重新生成）
```

## 与网页版的差异

| 项 | 网页版 | 小程序版 |
|---|---|---|
| 界面 | HTML + CSS | WXML + WXSS |
| 棋盘 | 浏览器 Canvas | `<canvas type="2d">` 组件 |
| 音效 | WebAudio 实时合成 | 打包的 WAV 文件（音色一致） |
| 存储 | localStorage | wx.setStorageSync |
| AI 引擎 | game.js | utils/engine.js（同一份代码） |
