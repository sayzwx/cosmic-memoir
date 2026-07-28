# CosmicMemoir 宇宙回忆录 - 交接文档

> **项目仓库**: https://github.com/sayzwx/cosmic-memoir  
> **线上地址**: https://sayzwx.github.io/cosmic-memoir/  
> **文档日期**: 2026-07-28  
> **技术栈**: React 18 + Vite + Three.js r170+ + React Three Fiber + 原生 JS + Tailwind CSS + Vitest  

---

## 1. 项目概述

### 1.1 这是什么

CosmicMemoir 是一个基于天体物理隐喻的交互式回忆录网站。用户通过虫洞穿梭完成身份验证后，进入由五大天文现象构成的记忆宇宙，在真实的物理模拟中阅读回忆。

### 1.2 五大交互章节

| 章节 | 天体现象 | 交互方式 | 情感主题 |
|------|---------|---------|---------|
| 序章 | 暗物质引力透镜 | 拖拽探索 | 潜意识的底色 |
| 第一章 | 红移与蓝移 | 横向时间轴 | 往事退行 |
| 第二章 | 事件视界 | 纵向深潜坠落 | 不可逆的抉择 |
| 第三章 | 洛希极限 | 双星拖拽逼近 | 亲密关系的潮汐 |
| 终章 | 引力波 | 触发并合 | 永恒的时空涟漪 |

### 1.3 线上访问

- **地址**: https://sayzwx.github.io/cosmic-memoir/
- **登录凭证**: 用户名 `mjsx`，密码 `foo`
- **费用**: 完全免费（GitHub Pages 公开仓库）

---

## 2. 目录结构

```
cosmic-memoir/
├── index.html                    # Vite 入口页（React 登录应用，检测 token 跳转）
├── login.html                    # 旧登录页重定向到 index.html（兼容 auth-guard）
├── universe.html                 # 主宇宙页（全屏 Canvas + UI 叠加层）
├── vite.config.js                # Vite 构建配置
│
├── src/                          # React 登录应用源码
│   ├── main.jsx                  # React 入口
│   ├── App.jsx                   # 主应用组件
│   ├── components/
│   │   ├── Scene.jsx             # R3F Canvas + 场景组合
│   │   ├── CameraRig.jsx         # 相机控制器（轨道漂移 + 拖拽/滚轮 + 视差）
│   │   ├── GalaxyParticles.jsx   # 螺旋星系粒子系统（50k GPU instanced）
│   │   ├── BlackHole.jsx         # 事件视界 + 光子环
│   │   ├── AccretionDisk.jsx     # 吸积盘着色器（湍流 + 多普勒）
│   │   ├── PhotonSystem.jsx      # 密码输入光子发射系统
│   │   ├── Effects.jsx           # 后处理（Bloom / DoF / 色差 / 颗粒 / 暗角）
│   │   └── LoginOverlay.jsx      # 玻璃拟态登录卡片 UI
│   ├── shaders/
│   │   ├── common.js             # 公共 GLSL（噪声 + 黑体色温）
│   │   ├── galaxy.js             # 星系粒子着色器
│   │   ├── accretionDisk.js      # 吸积盘着色器
│   │   └── photon.js             # 光子着色器
│   ├── hooks/
│   │   ├── useAuth.js            # SHA-256 认证逻辑
│   │   └── useResponsive.js      # 响应式 + 陀螺仪
│   ├── store/
│   │   └── sharedState.js        # 3D 场景与 UI 共享可变状态
│   └── styles/
│       └── login.css             # 登录页样式（玻璃拟态）
│
├── css/
│   └── custom.css                # 深空主题自定义样式
│
├── js/
│   ├── login.js                  # 旧登录逻辑（已弃用，保留参考）
│   ├── auth-guard.js             # 路由守卫（IIFE，检查 token + 1h 超时）
│   └── app.js                    # 主应用入口（实例化 CosmicMemoirApp）
│
├── engine/                       # 核心引擎（数据与视图分离）
│   ├── App.js                    # CosmicMemoirApp 主控制器
│   │
│   ├── core/                     # 引擎核心模块
│   │   ├── CelestialRenderer.js  # 渲染器抽象基类（Three.js 封装）
│   │   ├── SceneRouter.js        # 场景路由器（动态 import 渲染器）
│   │   ├── InputAdapter.js       # 统一输入适配器（鼠标/触摸）
│   │   ├── DataLoader.js         # 数据加载器（fetch + 缓存）
│   │   └── PerformanceProfiler.js # 性能分析器（FPS 降级）
│   │
│   ├── renderers/                # 五大天体渲染器
│   │   ├── DarkMatterRenderer.js       # 暗物质引力透镜
│   │   ├── RedshiftRenderer.js         # 红移蓝移
│   │   ├── EventHorizonRenderer.js     # 事件视界（黑洞 + 吸积盘）
│   │   ├── RocheLimitRenderer.js       # 洛希极限（双星撕裂）
│   │   └── GravitationalWaveRenderer.js # 引力波（双星并合）
│   │
│   └── shaders/                  # GLSL 着色器
│       ├── common.glsl           # 公共函数（噪声 + 黑体色温 + 多普勒）
│       ├── blackhole.vert        # 黑洞顶点着色器
│       ├── blackhole.frag        # 黑洞片段着色器（菲涅尔红移）
│       ├── gravitationalLensing.frag # 引力透镜后处理（径向扭曲 + 爱因斯坦环）
│       └── accretionDisk.frag    # 吸积盘（fbm 湍流 + 多普勒色温）
│
├── data/
│   └── memories.json             # 回忆录数据（你唯一需要编辑的文件）
│
├── tests/                        # 测试文件
│   ├── __mocks__/three.js        # Three.js mock
│   ├── auth-guard.test.js        # 路由守卫测试（9 用例）
│   ├── DataLoader.test.js        # 数据加载器测试（17 用例）
│   ├── InputAdapter.test.js      # 输入适配器测试（16 用例）
│   ├── PerformanceProfiler.test.js # 性能分析器测试（18 用例）
│   └── memories.test.js          # 数据完整性测试（19 用例）
│
├── docs/
│   ├── ARCHITECTURE.md           # 架构确认与任务拆解（737 行）
│   ├── CODE_REVIEW.md            # 代码审查报告（1008 行）
│   └── HANDOVER.md               # 本文件
│
├── .github/workflows/
│   └── deploy.yml                # GitHub Actions 部署工作流
│
├── .nojekyll                     # 禁用 Jekyll 处理
├── .gitignore                    # 忽略 node_modules 等
├── package.json                  # 项目配置（Vite + React + R3F + vitest）
└── vitest.config.js              # Vitest 配置
```

---

## 3. 快速开始

### 3.1 本地运行

项目分为两部分：新的 React 登录页（Vite 开发服务器）和原宇宙页（静态文件）。

```bash
cd cosmic-memoir
npm install        # 首次需要安装依赖

# 启动 Vite 开发服务器（React 登录页）
npm run dev
# 访问 http://localhost:5173

# 构建生产版本
npm run build
# 输出到 dist/ 目录

# 预览构建结果
npm run preview
# 访问 http://localhost:4173
```

> 原宇宙页 `universe.html` 在开发模式下直接从根目录访问 `http://localhost:5173/universe.html`，构建后通过 `vite-plugin-static-copy` 复制到 `dist/`。

### 3.2 运行测试

```bash
cd cosmic-memoir
npm install        # 首次需要安装依赖
npx vitest run     # 运行全部测试（79 个用例）
npx vitest         # watch 模式
```

### 3.3 部署到 GitHub Pages

项目现在需要构建步骤，因此使用 GitHub Actions 自动部署。工作流位于 `.github/workflows/deploy.yml`。

**首次配置**（仅一次）：
1. GitHub 仓库 → Settings → Pages
2. Source 选择 **GitHub Actions**（不是 "Deploy from a branch"）
3. 保存

**更新网站**：
```bash
cd cosmic-memoir
git add -A
git commit -m "update: 你的修改说明"
git push
```

推送后 GitHub Actions 会自动构建并部署（约 1-3 分钟）。

**本地构建验证**：
```bash
npm run build    # 构建到 dist/
npm run preview  # 本地预览构建结果
```

---

## 4. 架构说明

### 4.1 分层架构

```
┌──────────────────────────────────────────────┐
│  UI 层 (HTML + CSS + Tailwind)               │
│  login.html / universe.html / css/custom.css │
├──────────────────────────────────────────────┤
│  应用层                                       │
│  js/app.js (入口) → engine/App.js (控制器)    │
├──────────────────────────────────────────────┤
│  引擎层                                       │
│  SceneRouter → InputAdapter → DataLoader     │
│  PerformanceProfiler                         │
├──────────────────────────────────────────────┤
│  渲染层                                       │
│  CelestialRenderer (基类)                     │
│    ├─ DarkMatterRenderer                     │
│    ├─ RedshiftRenderer                       │
│    ├─ EventHorizonRenderer                   │
│    ├─ RocheLimitRenderer                     │
│    └─ GravitationalWaveRenderer              │
├──────────────────────────────────────────────┤
│  数据层                                       │
│  data/memories.json (静态 JSON)              │
├──────────────────────────────────────────────┤
│  认证层                                       │
│  js/login.js (SHA-256 + 虫洞动画)             │
│  js/auth-guard.js (路由守卫)                  │
└──────────────────────────────────────────────┘
```

### 4.2 页面流程

```
用户访问
  ↓
index.html → 检测 sessionStorage cm_token
  ├── 有 token 且未过期 → 跳转 universe.html
  └── 无 token → 跳转 login.html
                    ↓
              输入凭证 (mjsx / foo)
                    ↓
              SHA-256 校验通过 → 虫洞穿梭动画 → 跳转 universe.html
                    ↓
              auth-guard.js 检查 token → 通过则加载主应用
                    ↓
              CosmicMemoirApp.init()
                    ↓
              DataLoader 加载 memories.json
                    ↓
              SceneRouter 按章节挂载渲染器
                    ↓
              五大章节依次体验 → 结束
```

### 4.3 核心设计原则

| 原则 | 说明 |
|------|------|
| 数据与视图分离 | 所有内容存储在 `memories.json`，渲染器从数据读取参数 |
| 继承基类 | 所有渲染器继承 `CelestialRenderer`，禁止直接修改基类 |
| 统一输入 | 所有输入通过 `InputAdapter` 转发，渲染器不直接监听 DOM |
| 物理参数驱动 | 所有动画参数从 `data.physicsParams` 读取，禁止硬编码 |
| 资源管理 | `destroy()` 方法正确释放 Geometry/Material/Texture/事件 |

### 4.4 React 登录页架构（新增）

新的登录页使用 React + React Three Fiber 构建，位于 `src/` 目录。

```
┌──────────────────────────────────────────────┐
│  UI 层 (React + CSS)                          │
│  LoginOverlay.jsx（玻璃拟态卡片 + 输入交互）   │
├──────────────────────────────────────────────┤
│  共享状态层                                    │
│  sharedState.js（可变对象，UI↔3D 桥接）       │
├──────────────────────────────────────────────┤
│  3D 场景层 (R3F Canvas)                       │
│  Scene.jsx                                    │
│    ├─ CameraRig.jsx（轨道漂移 + 拖拽 + 视差） │
│    ├─ GalaxyParticles.jsx（50k instanced 星系）│
│    ├─ BlackHole.jsx（事件视界 + 光子环）      │
│    ├─ AccretionDisk.jsx（湍流 + 多普勒着色器）│
│    ├─ PhotonSystem.jsx（密码光子发射）        │
│    └─ Effects.jsx（Bloom / DoF / 色差 / 颗粒）│
├──────────────────────────────────────────────┤
│  认证层                                       │
│  useAuth.js（SHA-256 校验 + sessionStorage）  │
└──────────────────────────────────────────────┘
```

**关键设计**：

| 设计 | 实现 |
|------|------|
| UI 与 3D 通信 | `sharedState.js` 可变对象，事件处理器直接写入，`useFrame` 每帧读取 |
| 登录卡片 3D 透视 | CSS `perspective + rotateY/X`，由 CameraRig 直接操作 DOM transform |
| 引力波脉冲 | `sharedState.pulseRadius/Strength` 写入 → 星系顶点着色器扩散环形扰动 |
| 光子发射 | `sharedState.photons` 队列 → PhotonSystem 池化管理（60 粒子上限） |
| 验证动画 | FOV 75→120 + 色差增强 + 粒子坍缩 + Bloom 增强，2.6s 后跳转 universe.html |
| 移动端降级 | 粒子数 50k→15k，DPR 锁定 1，陀螺仪替代鼠标视差 |

---

## 5. 数据编辑指南

### 5.1 你唯一需要编辑的文件

**`data/memories.json`** — 修改这个文件即可更新所有内容，无需改代码。

### 5.2 添加一条新回忆

复制一个现有条目，修改以下字段：

```json
{
  "id": "mem_2020_keyword",              // 格式: mem_年份_关键词（全小写）
  "meta": {
    "title": "回忆标题",                  // 最多 50 字
    "date": "2020-06-15",                // 格式: YYYY-MM-DD
    "chapterIndex": 2,                   // 0=序章 1=红移 2=事件视界 3=洛希 4=引力波
    "order": 3,                          // 章节内显示顺序
    "tags": ["标签1", "标签2"],          // 最多 5 个
    "emotionalTemperature": 3500,        // 色温 K: 2000=暖红/悲伤, 9000=冷蓝/理性
    "isHidden": false                    // 是否隐藏记忆
  },
  "celestialType": "eventHorizon",       // 必须与 chapterIndex 匹配
  "narrative": {
    "prologueText": "交互前的引导文案",
    "bodyText": "核心回忆正文，支持换行",
    "epilogueText": "交互后的收尾文案",
    "quote": "可引用的金句"
  },
  "media": {
    "primaryImage": null,                // 图片路径如 "/assets/memories/photo.jpg"
    "secondaryImages": [],               // 辅助图片，最多 3 张
    "ambientAudio": null,                // 环境音路径
    "spatialAudio": null,
    "videoLoop": null                    // 循环视频
  },
  "physicsParams": {
    "eventHorizon": {                    // key 必须与 celestialType 一致
      "schwarzschildRadius": 150,        // 史瓦西半径
      "spin": 0.85,                      // 自旋 0-1
      "accretionRate": 0.3,              // 吸积率
      "lensingStrength": 1.2,            // 引力透镜强度
      "timeDilationFactor": 4.0,         // 时间膨胀因子
      "photonSphereRadius": 225          // 光子球半径
    }
  },
  "interactionConfig": {
    "entryTrigger": "scroll",            // scroll/drag/click/tap/pinch/auto
    "exitBehavior": "noEscape",          // free/noEscape/collapse/fade
    "ambientParticles": 500,             // 环境粒子数量
    "cameraStart": {
      "position": [0, 0, 800],           // 相机初始位置 [x, y, z]
      "lookAt": [0, 0, 0]               // 相机看向的点
    }
  }
}
```

### 5.3 五种章节的物理参数

| celestialType | chapterIndex | physicsParams key | 参数列表 |
|---------------|-------------|-------------------|---------|
| `darkMatter` | 0 | `darkMatter` | lensStrength, einsteinRadius, shearFieldOpacity, hiddenMemoryCount, convergenceThreshold |
| `redshift` | 1 | `redshift` | hubbleConstant, maxRedshift, colorTempNow, colorTempPast, expansionRate, peculiarVelocity |
| `eventHorizon` | 2 | `eventHorizon` | schwarzschildRadius, spin, accretionRate, lensingStrength, timeDilationFactor, photonSphereRadius |
| `rocheLimit` | 3 | `rocheLimit` | primaryMass, secondaryMass, secondaryDensity, tidalLockingDistance, debrisCount, accretionTemperature |
| `gravitationalWave` | 4 | `gravitationalWave` | primaryMass, secondaryMass, orbitalDecayRate, waveAmplitude, ringdownFrequency, massEnergyRatio, initialOrbitRadius |

### 5.4 celestialType 与 chapterIndex 映射

```
chapterIndex 0 → celestialType: "darkMatter"
chapterIndex 1 → celestialType: "redshift"
chapterIndex 2 → celestialType: "eventHorizon"
chapterIndex 3 → celestialType: "rocheLimit"
chapterIndex 4 → celestialType: "gravitationalWave"
```

> **重要**：`celestialType` 和 `physicsParams` 的 key 必须一致，且与 `chapterIndex` 匹配，否则渲染器获取不到参数。

### 5.5 添加图片资源

1. 将图片放入 `assets/memories/` 目录（需手动创建）
2. 图片建议 WebP 格式，最大宽度 1920px
3. 在 `memories.json` 中填写路径：`"primaryImage": "/assets/memories/2020_photo.jpg"`
4. 注意路径以 `/` 开头（相对于网站根目录）

### 5.6 修改密码

1. 生成新密码的 SHA-256 哈希：
```bash
node -e "require('crypto').createHash('sha256').digest('你的新密码', 'hex')" 2>/dev/null || \
node -e "console.log(require('crypto').createHash('sha256').update('你的新密码').digest('hex'))"
```

2. 将输出的哈希值替换 `js/login.js` 第 3 行的 `passwordHash`

3. 也可同时修改用户名（第 2 行 `username`）

---

## 6. 认证系统

### 6.1 工作原理

```
登录页 (login.html)
  │
  ├── 用户输入用户名 + 密码
  ├── 密码经 SHA-256 哈希（crypto.subtle.digest）
  ├── 与 js/login.js 中硬编码的哈希比对
  │
  ├── 成功 → sessionStorage 存入 cm_token + cm_loginTime
  │         → 播放虫洞穿梭动画
  │         → 跳转 universe.html
  │
  └── 失败 → 震动反馈 + 剩余次数提示
              5 次失败 → 锁定 60 秒
```

### 6.2 路由守卫 (auth-guard.js)

- 在 `universe.html` 的 `<head>` 中引入
- 检查 `sessionStorage.cm_token` 是否存在
- 检查 `sessionStorage.cm_loginTime` 是否在 1 小时内
- 未通过 → 跳转 `login.html`
- 关闭浏览器标签 → sessionStorage 清除 → 需重新登录

### 6.3 安全限制

| 特性 | 状态 | 说明 |
|------|------|------|
| 密码存储 | SHA-256 哈希 | 不存明文，但前端哈希可被逆向 |
| SQL 注入 | 免疫 | 纯 JSON 数据，无 SQL |
| 暴力破解 | 5 次锁定 60s | localStorage 持久化计数 |
| 会话超时 | 1 小时 | sessionStorage 关闭标签即失效 |
| 隐藏记忆 | 仅 UI 层 | JSON 文件可被直接访问 |

> 这是个人回忆录项目，当前安全级别适用。如需更高安全性，建议迁移到后端 JWT 认证。

---

## 7. 渲染器开发指南

### 7.1 创建新渲染器

如果需要新增一种天体交互场景：

1. 在 `engine/renderers/` 创建新文件，继承 `CelestialRenderer`：

```javascript
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CelestialRenderer } from '../core/CelestialRenderer.js';

export class MyRenderer extends CelestialRenderer {
  async init() {
    // 从 this.params 读取物理参数
    const p = this.params.myType || {};
    
    // 构建 Three.js 场景
    // 所有资源注册到 this.addDisposable()
    // 所有 DOM 事件通过 this.bindEvent()
  }
  
  update(deltaTime, elapsedTime) {
    // 每帧更新逻辑
  }
  
  onScroll(deltaY, deltaX) { /* 滚轮交互 */ }
  onDrag(deltaX, deltaY, startX, startY, currentX, currentY) { /* 拖拽交互 */ }
  onTap(x, y) { /* 点击交互 */ }
  onPinch(scale, centerX, centerY) { /* 捏合交互 */ }
  
  onResize(width, height) {
    super.onResize(width, height);
    // 额外的尺寸适配
  }
}
```

2. 在 `engine/core/SceneRouter.js` 的 `RendererRegistry` 中注册：

```javascript
const RendererRegistry = {
  // ... 现有渲染器
  myType: async () => {
    const { MyRenderer } = await import('../renderers/MyRenderer.js');
    return MyRenderer;
  }
};
```

3. 在 `data/memories.json` 中使用新的 `celestialType`

### 7.2 CelestialRenderer 基类提供的能力

| 方法/属性 | 说明 |
|----------|------|
| `this.scene` | THREE.Scene 实例 |
| `this.camera` | THREE.PerspectiveCamera 实例 |
| `this.renderer` | THREE.WebGLRenderer 实例 |
| `this.clock` | THREE.Clock 实例 |
| `this.params` | 从 data.physicsParams 读取 |
| `this.narrative` | 从 data.narrative 读取 |
| `this.media` | 从 data.media 读取 |
| `this.data` | 完整的 memory 数据对象 |
| `this.options` | 传入的选项（quality 等） |
| `this.loadTexture(url)` | 异步加载纹理 |
| `this.addDisposable(obj)` | 注册可释放资源 |
| `this.bindEvent(el, event, handler)` | 绑定 DOM 事件（自动清理） |
| `this.start()` | 启动渲染循环 |
| `this.pause()` | 暂停渲染 |
| `this.destroy()` | 完全销毁，释放所有资源 |

### 7.3 着色器开发

着色器文件位于 `engine/shaders/`，为纯 GLSL 文本文件。

加载方式（参考 EventHorizonRenderer）：

```javascript
async _loadShader(name) {
  const url = new URL(`../shaders/${name}`, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load shader ${name}: ${response.status}`);
  }
  return response.text();
}

async init() {
  const commonSrc = await this._loadShader('common.glsl');
  const myFragSrc = await this._loadShader('myShader.frag');
  
  const material = new THREE.ShaderMaterial({
    vertexShader: myVertSrc,
    fragmentShader: commonSrc + '\n' + myFragSrc,
    uniforms: { time: { value: 0 } }
  });
}
```

`common.glsl` 提供公共函数：
- `hash11(x)` / `hash21(p)` — 哈希噪声
- `noise(p)` / `fbm(p)` — 分形布朗运动噪声
- `blackbody(temp)` — 黑体色温转 RGB
- `dopplerShift(velocity, restColor)` — 多普勒色温偏移
- `smin(a, b, k)` — 平滑最小值
- `rot2d(angle)` — 2D 旋转矩阵

---

## 8. 测试说明

### 8.1 测试概览

| 测试文件 | 用例数 | 覆盖内容 |
|---------|-------|---------|
| `auth-guard.test.js` | 9 | 有效/无效/过期 token、跳转、清除 |
| `DataLoader.test.js` | 17 | 加载/缓存/过滤/排序/错误处理 |
| `InputAdapter.test.js` | 16 | 滚轮/拖拽/点击/捏合/订阅/取消 |
| `PerformanceProfiler.test.js` | 18 | FPS 降级/质量配置/事件触发 |
| `memories.test.js` | 19 | 数据完整性/ID 格式/参数匹配 |
| **合计** | **79** | **全部通过** |

### 8.2 运行测试

```bash
npx vitest run          # 单次运行
npx vitest              # watch 模式
npx vitest run --reporter verbose  # 详细输出
```

### 8.3 Mock 策略

- `tests/__mocks__/three.js` — Mock Three.js 核心类（Scene, Camera, Renderer 等）
- `fetch` — 全局 mock，返回 `memories.json` 数据
- `sessionStorage` / `localStorage` — jsdom 原生支持
- `window.location` — `defineProperty` 覆盖
- `requestAnimationFrame` / `performance.now` — 可控时间轴

---

## 9. 性能优化

### 9.1 PerformanceProfiler 降级策略

| 质量级别 | 触发条件 | 粒子数 | 阴影 | Bloom | 抗锯齿 |
|---------|---------|-------|------|-------|--------|
| high | FPS ≥ 40 | 1.0x | 1.0x | 开 | 开 |
| medium | FPS < 40 | 0.5x | 0.5x | 开 | 关 |
| low | FPS < 20 | 0.2x | 0.2x | 关 | 关 |

### 9.2 资源管理

- 所有 Three.js 资源（Geometry/Material/Texture）注册到 `disposables` 数组
- `destroy()` 方法正确释放所有资源，防止内存泄漏
- `requestAnimationFrame` 在 `pause()` 时取消
- DOM 事件监听器通过 `bindEvent()` 注册，`destroy()` 时自动移除

### 9.3 已知性能瓶颈

| 场景 | 瓶颈 | 优化建议 |
|------|------|---------|
| 事件视界引力透镜 | 全屏后处理 shader | 降级时降低渲染分辨率 |
| 暗物质粒子系统 | 粒子 + 透镜叠加 | 降级时粒子数 ×0.2 |
| 洛希极限碎片 | 1000 碎片物理 | 降级时碎片数 ×0.2 |
| 图片加载 | 30-40 张高清图 | WebP 格式，按章节懒加载 |

---

## 10. GitHub Pages 部署

### 10.1 当前配置

| 项目 | 值 |
|------|-----|
| 仓库 | https://github.com/sayzwx/cosmic-memoir |
| 分支 | main |
| 部署方式 | GitHub Actions 构建 `dist/` 并部署 |
| 工作流 | `.github/workflows/deploy.yml` |
| 访问地址 | https://sayzwx.github.io/cosmic-memoir/ |
| .nojekyll | 已添加（禁用 Jekyll） |
| 费用 | 免费 |

### 10.2 更新网站

```bash
cd cosmic-memoir
git add -A
git commit -m "update: 修改说明"
git push
```

推送后 GitHub Actions 自动构建并部署（约 1-3 分钟）。

> 确保 GitHub Settings → Pages → Source 已设置为 **GitHub Actions**。

### 10.3 如需自定义域名（未来）

1. 购买域名（如 mzjwsx.com）
2. 在域名注册商 DNS 设置：
   - A 记录：`@` → `185.199.108.153`
   - A 记录：`@` → `185.199.109.153`
   - A 记录：`@` → `185.199.110.153`
   - A 记录：`@` → `185.199.111.153`
   - CNAME：`www` → `sayzwx.github.io`
3. 在仓库根目录创建 `CNAME` 文件，内容为域名
4. GitHub Settings → Pages → Custom domain 填入域名
5. 等待 DNS 生效（几分钟到几小时）

---

## 11. 已知限制与待办

### 11.1 当前限制

| 限制 | 影响 | 优先级 |
|------|------|--------|
| 前端哈希认证 | JS 源码可见，哈希可被逆向 | 低（个人项目可接受） |
| 隐藏记忆非真隐藏 | JSON 文件可直接访问 | 低 |
| 新登录页未经真机测试 | 视觉/性能需在实际设备验证 | 高 |
| 无音效系统 | 五大场景无环境音/交互音 | 中（P2 阶段） |
| 无 Android 触摸适配 | InputAdapter 已预留接口但未启用 | 中（P2 阶段） |
| 转场动画为 placeholder | 章间转场使用 setTimeout 而非 GSAP | 中（P1 阶段） |
| 无 PWA 支持 | 无法离线访问 | 低 |

### 11.2 路线图

**阶段二（五章串联）**:
- [ ] 实现 GSAP 章间转场动画（坍缩→奇点→爆发→抵达）
- [ ] 填充 30-40 条真实回忆数据
- [ ] 添加图片/音频资源
- [ ] 章节导航与进度系统完善

**阶段三（Polish）**:
- [ ] Android 触摸事件适配
- [ ] 音效系统（Web Audio API 三层音效）
- [ ] Cannon-es 物理引擎集成（洛希撕裂质点弹簧）
- [ ] PWA 支持（离线缓存）
- [ ] 加载进度条与资源预加载

---

## 12. 关键文件速查

| 我想要... | 编辑这个文件 |
|---------|------------|
| 添加/修改回忆内容 | `data/memories.json` |
| 修改登录密码 | `src/hooks/useAuth.js` → `CREDENTIALS.passwordHash` |
| 修改登录页 UI / 交互 | `src/components/LoginOverlay.jsx` + `src/styles/login.css` |
| 修改星系粒子效果 | `src/components/GalaxyParticles.jsx` + `src/shaders/galaxy.js` |
| 修改黑洞 / 吸积盘 | `src/components/BlackHole.jsx` / `AccretionDisk.jsx` + `src/shaders/accretionDisk.js` |
| 修改后处理效果 | `src/components/Effects.jsx` |
| 修改相机行为 | `src/components/CameraRig.jsx` |
| 修改登录验证动画 | `src/components/CameraRig.jsx`（过渡）+ `src/components/Effects.jsx`（色差/Bloom） |
| 修改主宇宙页 UI | `universe.html` + `js/app.js` |
| 修改某个场景的视觉效果 | `engine/renderers/XxxRenderer.js` |
| 修改着色器 | `engine/shaders/*.frag` / `*.vert` / `*.glsl` |
| 修改全局配色/字体 | `data/memories.json` → `universeConfig.theme` |
| 修改物理参数 | `data/memories.json` → 各条目的 `physicsParams` |
| 添加新场景类型 | `engine/renderers/` 新建 + `SceneRouter.js` 注册 |

---

## 13. 凭证与账号

| 项目 | 值 |
|------|-----|
| GitHub 账号 | `sayzwx` |
| 仓库 | `cosmic-memoir` (Public) |
| 登录用户名 | `mjsx` |
| 登录密码 | `foo` |
| 密码哈希算法 | SHA-256 (`crypto.subtle.digest`) |

---

## 14. 文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| 本交接文档 | `docs/HANDOVER.md` | 项目全貌、编辑指南、部署说明 |
| 架构文档 | `docs/ARCHITECTURE.md` | 6 层架构、42 个任务拆解、数据契约、UI 布局、风险分析 |
| 代码审查 | `docs/CODE_REVIEW.md` | 7 个严重 + 14 个警告 + 8 个建议，含修复建议 |
| 原始方案 | `桌面/宇宙回忆录网站完整方案.md` | 2271 行完整设计方案（项目立项文档） |

---

> **结语**: 这个项目的核心哲学是「让物理规律替你叙事」。你不是在维护一个回忆录网站，你是在管理一个可观测宇宙的模拟器。只需填写星表，恒星便会自行运转。
