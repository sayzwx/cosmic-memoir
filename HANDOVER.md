# CosmicMemoir 交接文档

## 项目概述

登录页 + 宇宙回忆录，基于 Three.js/R3F 登录页 + Canvas 2D 回忆录页面。

## 架构

### 登录页 (React + R3F + Vite)

| 文件 | 说明 |
|------|------|
| `src/App.jsx` | 根组件，协调 Scene 和 LoginOverlay |
| `src/components/Scene.jsx` | Canvas 容器，组合所有 3D 组件 |
| `src/components/LoginOverlay.jsx` | DOM 层登录表单 |
| `src/components/CameraRig.jsx` | 相机控制 + 转场动画 |
| `src/components/BlackHole.jsx` | 黑洞（事件视界 + 光子环 + 辉光） |
| `src/components/AccretionDisk.jsx` | 吸积盘粒子系统 |
| `src/components/GalaxyParticles.jsx` | 银河旋臂粒子 |
| `src/components/NebulaBackground.jsx` | 程序化星云背景 |
| `src/components/CompanionStars.jsx` | 5 颗可点击伴星 |
| `src/components/PhotonSystem.jsx` | 光子发射粒子 |
| `src/components/EventHorizonTunnel.jsx` | 虫洞转场全屏 Shader |
| `src/components/Effects.jsx` | 后处理（Bloom/色差/暗角/噪点） |
| `src/hooks/useAuth.js` | 本地认证（SHA-256, sessionStorage token, 锁定机制） |
| `src/hooks/useResponsive.js` | 响应式检测 + 手机陀螺仪 |
| `src/store/sharedState.js` | 跨组件共享可变状态 |
| `src/shaders/galaxy.js` | 银河粒子着色器 |
| `src/shaders/accretionDisk.js` | 吸积盘着色器 |
| `src/shaders/nebula.js` | 星云着色器 |
| `src/shaders/photon.js` | 光子着色器 |
| `src/shaders/common.js` | 公共噪声/旋转函数 |

### 回忆录页 (Canvas 2D + Tailwind)

| 文件 | 说明 |
|------|------|
| `universe.html` | 回忆录主页面 |
| `js/app.js` | 应用入口，场景路由 |
| `js/auth-guard.js` | 认证守卫 IIFE |
| `js/login.js` | 登录逻辑 |
| `engine/core/*` | DataLoader, InputAdapter, SceneRouter, PerformanceProfiler, CelestialRenderer |
| `engine/renderers/*` | DarkMatter, EventHorizon, GravitationalWave, Redshift, RocheLimit 渲染器 |
| `engine/shaders/*` | WebGL shader |
| `data/memories.json` | 记忆数据 |

### 测试 (Vitest)

5 个测试文件，79 用例：
- `auth-guard.test.js` (9) — auth-guard.js 认证守卫
- `DataLoader.test.js` (17) — 数据加载
- `InputAdapter.test.js` (16) — 输入适配
- `memories.test.js` (19) — 记忆系统
- `PerformanceProfiler.test.js` (18) — 性能分析

## 关键流程

1. 用户打开页面 → Three.js 银河星云场景
2. 点击伴星 → 表单展开（粒子聚合动画）
3. 输入凭据 → 认证（用户名 `mjsx`，密码 SHA-256 `foo`）
4. 成功后：表单卸载 → 相机直线进入黑洞 → 约 2.3s 穿过事件视界 → 虫洞层 (14 深度环 + 三股蓝金螺旋 + 星际星线) → 暖白闪光 → 约 4.5s 跳转 `universe.html`

## 转场关键参数

- `CameraRig.jsx` 中 `TRANSITION_DURATION_MS = 4000`（基于真实时间，不受帧率影响）
- `EventHorizonTunnel.jsx` 中 `uProgress > 0.41` 时 mesh 可见，即 4s \* 0.41 ≈ 1.64s 后虫洞出现
- `LoginOverlay.jsx` 中 `setTimeout(4500)` 跳转
- 相机轴旋转：`Math.PI * 4 * easeInOutCubic(progress)` 两圈后自动回正

## 部署 (GitHub Pages)

- 地址：https://sayzwx.github.io/cosmic-memoir/
- 源码：`main` 分支
- 产物：`gh-pages` 分支（由 `npx gh-pages -d dist` 发布）
- 构建：`npm run build`
- 发布：`npx gh-pages -d dist -b gh-pages -m "message"`
- 退出登录：`?logout`

## 常用命令

```
npm install          # 安装依赖
npm run dev          # 开发服务器 (localhost:5174)
npm run build        # 生产构建到 dist/
npm test             # 运行 79 项测试
npx gh-pages -d dist -b gh-pages -m "deploy: msg"
```

## 注意事项

- 手机端：关闭景深，粒子 12K，DPR=1，无 MSAA，支持陀螺仪
- PC 端：DPR=1.5，无景深，无 MSAA，保留 Bloom/色差/暗角
- 认证凭据硬编码在 `useAuth.js`，如有需要可改为 API 调用
- Shader 编译需要 `WebGL2` 支持，部分旧设备可能回退到 WebGL1
- 照片/截图文件（`current_screenshot.png` 等）在 `.gitignore` 中未排除，提交时注意
