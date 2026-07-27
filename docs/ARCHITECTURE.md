# CosmicMemoir 架构确认与任务拆解

> **文档定位**：基于《宇宙回忆录网站完整方案》的架构确认与实施拆解  
> **产出时间**：2026-07-27  
> **角色**：前端架构师  
> **确认结论**：方案架构清晰、分层合理，可直接进入实施阶段

---

## 目录

1. [架构总览](#1-架构总览)
2. [页面与路由](#2-页面与路由)
3. [数据契约确认](#3-数据契约确认)
4. [UI 布局确认](#4-ui-布局确认)
5. [任务清单](#5-任务清单)
6. [技术风险与注意事项](#6-技术风险与注意事项)

---

## 1. 架构总览

### 1.1 分层架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UI 层 (Tailwind + Custom CSS)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  登录卡片     │  │  文案叠加层   │  │  参数显示 / 导航 / HUD   │   │
│  │  (login.html)│  │(narrative UI)│  │  (z-index 叠加于 Canvas) │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                     渲染层 (Three.js WebGL)                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐    │
│  │DarkMatter  │ │ Redshift   │ │EventHorizon│ │ RocheLimit     │    │
│  │Renderer    │ │ Renderer   │ │ Renderer   │ │ Renderer       │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘    │
│  ┌────────────────┐  ┌─────────────────────────────────────────┐    │
│  │GravWaveRenderer│  │          GLSL Shaders                    │    │
│  └────────────────┘  │  blackhole.vert/.frag, lensing.frag,    │    │
│                      │  accretionDisk.frag, common.glsl         │    │
│                      └─────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                     引擎层 (Engine Core)                             │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────────┐      │
│  │ CelestialRenderer│  │ SceneRouter  │  │ InputAdapter       │      │
│  │ (抽象基类)       │  │ (场景路由)    │  │ (统一输入适配)      │      │
│  └─────────────────┘  └──────────────┘  └────────────────────┘      │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────────┐      │
│  │ DataLoader      │  │ Performance  │  │ CosmicMemoirApp    │      │
│  │ (数据加载/缓存)  │  │ Profiler     │  │ (主应用控制器)      │      │
│  └─────────────────┘  └──────────────┘  └────────────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                     数据层 (Static JSON)                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  data/memories.json                                         │    │
│  │  ├── universeConfig (全局配置: 物理常数/主题/音频)            │    │
│  │  └── memories[] (30-40 条回忆, 含 5 种 celestialType)        │    │
│  └─────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                     认证层 (Frontend Auth)                           │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐      │
│  │ login.js        │  │ auth-guard.js                        │      │
│  │ SHA-256 哈希比对 │  │ sessionStorage 令牌校验 + 路由守卫    │      │
│  │ 虫洞穿梭动画     │  │ 1h 会话超时 / 5次锁定60s             │      │
│  └─────────────────┘  └──────────────────────────────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                     资源层 (Assets)                                  │
│  memories/*.jpg  audio/*.ogg  video/*.mp4  fonts/*.woff2            │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则确认

| 原则 | 方案体现 | 确认状态 |
|------|---------|---------|
| **数据与视图分离** | 所有渲染参数从 `data.physicsParams` 读取，禁止硬编码 | ✅ 确认 |
| **继承而非修改基类** | 5 个 Renderer 继承 `CelestialRenderer`，不修改基类 | ✅ 确认 |
| **统一输入抽象** | 所有 DOM 事件经 `InputAdapter` 转发，Renderer 不直接监听 DOM | ✅ 确认 |
| **动态加载** | `SceneRouter` 使用 `import()` 动态导入渲染器，按需加载 | ✅ 确认 |
| **资源生命周期管理** | 基类 `destroy()` 统一释放 geometry/material/texture/event | ✅ 确认 |
| **无后端架构** | 纯 JSON 静态文件，后期可无缝迁移至 API | ✅ 确认 |
| **双端预留** | `InputAdapter` 已封装触摸事件分支，Android 仅需启用 | ✅ 确认 |

### 1.3 五大渲染器职责确认

| 渲染器 | 文件 | 物理现象 | 交互方式 | 核心技术点 |
|--------|------|---------|---------|-----------|
| **DarkMatterRenderer** | `renderers/DarkMatterRenderer.js` | 暗物质引力透镜 | 拖拽记忆星系到暗物质区域 | 透镜 shader (光线弯曲)、爱因斯坦环、剪切场等高线、3 弧交点解锁 |
| **RedshiftRenderer** | `renderers/RedshiftRenderer.js` | 红移/蓝移 (多普勒) | 水平拖拽时间轴 | 色温映射 (2000K→6500K)、哈勃流间距膨胀、本动速度逆行、z 值实时显示 |
| **EventHorizonRenderer** | `renderers/EventHorizonRenderer.js` | 事件视界 (黑洞) | 向下滚动深潜 | 引力透镜 shader、吸积盘动画、滚轮阻尼 (时间膨胀)、光子球层、视界穿越不可逆 |
| **RocheLimitRenderer** | `renderers/RocheLimitRenderer.js` | 洛希极限 (潮汐力) | 拖拽双星 + 滑块调密度 | 潮汐形变 (椭球)、洛希极限实时计算、撕裂碎裂成环、潮汐锁定轨道 |
| **GravitationalWaveRenderer** | `renderers/GravitationalWaveRenderer.js` | 引力波 (双星并合) | 拖拽调轨道 + 点击并合 | 旋近轨道扰动、时空涟漪正弦波扩散、永久文本形变、啁啾音效 |

### 1.4 SceneRouter 路由机制确认

```
                    ┌──────────────────┐
                    │  CosmicMemoirApp  │
                    │   .loadChapter()  │
                    └────────┬─────────┘
                             │ memoryData
                             ▼
                    ┌──────────────────┐
                    │   SceneRouter     │
                    │    .mount()       │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              │              │
     [卸载旧场景]            │              │
     destroy() +            │              │
     collapseTransition     │              │
              │              │              │
              ▼              ▼              │
     RendererRegistry[memoryData.celestialType]
     (async import 对应 Renderer)
              │              │              │
              ▼              │              │
     new RendererClass(canvas, data, opts)
     await renderer.init()
     renderer.start()
              │              │              │
              ▼              ▼              ▼
     window.dispatchEvent('sceneMounted')
```

**路由注册表**（动态 import）：

| celestialType | 模块路径 | 触发条件 |
|---------------|---------|---------|
| `darkMatter` | `../renderers/DarkMatterRenderer.js` | chapterIndex=0 的记忆 |
| `redshift` | `../renderers/RedshiftRenderer.js` | chapterIndex=1 的记忆 |
| `eventHorizon` | `../renderers/EventHorizonRenderer.js` | chapterIndex=2 的记忆 |
| `rocheLimit` | `../renderers/RocheLimitRenderer.js` | chapterIndex=3 的记忆 |
| `gravitationalWave` | `../renderers/GravitationalWaveRenderer.js` | chapterIndex=4 的记忆 |

### 1.5 InputAdapter 输入抽象确认

统一手势对象映射（PC ↔ Android 对齐）：

| 场景交互 | PC 输入 | Android 输入 | 统一输出事件 | 数据结构 |
|---------|--------|-------------|------------|---------|
| 事件视界深潜 | `wheel` (deltaY) | 垂直滑动 | `scroll` | `{ deltaY, deltaX, ctrlKey }` |
| 红移时间轴 | 鼠标拖拽 | 水平滑动+惯性 | `dragStart`/`drag`/`dragEnd` | `{ x, y, deltaX, deltaY }` |
| 洛希双星 | 鼠标拖拽星体 | 单指拖拽星体 | `dragStart`/`drag`/`dragEnd` | `{ x, y, phase, target }` |
| 暗物质透镜 | 鼠标拖拽星系 | 单指拖拽星系 | `dragStart`/`drag`/`dragEnd` | `{ x, y, phase, target }` |
| 引力波并合 | 点击按钮 | 点击按钮 | `tap` | `{ x, y }` |
| 缩放/密度 | 滚轮或滑块 | 双指捏合 | `pinch` | `{ scale, centerX, centerY }` |

**数据流路径**：
```
DOM Event → InputAdapter.handle*() → emit(event, data)
  → CosmicMemoirApp.bindInput() → SceneRouter.handleInput(eventType, data)
  → currentScene.onScroll/onDrag/onTap/onPinch()
```

---

## 2. 页面与路由

### 2.1 页面流转图

```
                    ┌─────────────┐
                    │  index.html │
                    │  (入口跳转)  │
                    └──────┬──────┘
                           │ 检查 sessionStorage token
                    ┌──────┴──────┐
                    │             │
              有 token         无 token
              (未过期)          (或已过期)
                    │             │
                    ▼             ▼
          ┌──────────────┐  ┌──────────────┐
          │ universe.html│  │  login.html  │
          │  (主宇宙页)   │  │  (登录验证)   │
          └──────┬───────┘  └──────┬───────┘
                 │                 │
          auth-guard.js      SHA-256 校验
          (守卫检查)          │
                 │       ┌────┴────┐
                 │     失败       成功
                 │       │         │
                 │       ▼         │ 虫洞穿梭动画 (2s)
                 │  锁定/重试      │
                 │       │         ▼
                 │       │    ┌──────────────┐
                 │       │    │ universe.html│
                 │       │    │  (主宇宙页)   │
                 │       │    └──────┬───────┘
                 │       │           │
                 └───────┴───────────┘
```

### 2.2 主宇宙页章节流转

```
universe.html (CosmicMemoirApp.init)
    │
    ├── loadChapter(0) → 序章: 暗物质 [darkMatter]
    │   ├── memory[0] → memory[1] → ... (按 order 排序)
    │   └── nextMemory() → 章节结束
    │
    ├── [坍缩跃迁转场] → loadChapter(1) → 第一章: 红移 [redshift]
    │   └── ...
    │
    ├── [坍缩跃迁转场] → loadChapter(2) → 第二章: 事件视界 [eventHorizon]
    │   └── ...
    │
    ├── [坍缩跃迁转场] → loadChapter(3) → 第三章: 洛希极限 [rocheLimit]
    │   └── ...
    │
    ├── [坍缩跃迁转场] → loadChapter(4) → 终章: 引力波 [gravitationalWave]
    │   └── ...
    │
    └── window.dispatchEvent('memoirComplete') → 结束页
```

### 2.3 章间转场设计（坍缩跃迁）

每个转场分 4 个阶段：

| 阶段 | 时长 | 视觉效果 |
|------|------|---------|
| **坍缩** | ~1s | 当前场景所有元素被引力拉向屏幕中央，颜色蓝移至高能紫外 |
| **奇点** | 0.5s | 屏幕纯黑，只剩中央一个无限小光点 |
| **爆发** | 2s | 光点膨胀为虫洞环，用户视角被吸入，经历超空间隧道 |
| **抵达** | ~0.8s | 新章节场景从隧道尽头浮现，像飞船退出超光速 |

> 转场由 `SceneRouter.playCollapseTransition()` + `playWormholeEntry()` 驱动，使用 GSAP 时间轴控制。

### 2.4 认证安全机制确认

| 安全特性 | 实现方式 | 确认状态 |
|---------|---------|---------|
| 密码存储 | SHA-256 哈希，不存明文（`crypto.subtle.digest`） | ✅ |
| SQL 注入免疫 | 纯 JSON 静态数据，无 SQL 查询 | ✅ |
| 暴力破解防护 | 5 次错误锁定 60 秒（`localStorage` 持久化计数） | ✅ |
| 会话管理 | `sessionStorage` 存储令牌，关闭标签即失效 | ✅ |
| 会话超时 | 1 小时过期（`cm_loginTime` 时间戳校验） | ✅ |
| 路由守卫 | `auth-guard.js` 在 `<head>` 引入，无令牌则 `replace` 到 login | ✅ |
| 令牌生成 | 时间戳 + 随机数 + userAgent 的 SHA-256 | ✅ |

> **安全注意**：前端哈希认证本质上无法防住有经验的逆向者（JS 源码可见）。方案文档已在第 11 章标注"如需更高安全性，建议后期迁移到后端 JWT 认证"。当前级别适用于个人回忆录项目。

---

## 3. 数据契约确认

### 3.1 memories.json 顶层结构

```
memories.json
├── universeConfig (全局配置)
│   ├── globalConstants     → 物理常数 (G, c, hubbleParam, planckTime)
│   ├── theme               → 主题配色 (colorSpace, colorNebula, fontHeading, fontMono)
│   └── audio               → 音频配置 (masterVolume, ambientEnabled)
│
└── memories[] (30-40 条回忆)
    ├── id                  → "mem_年份_关键词" (正则: ^mem_[0-9]{4}_[a-z]+$)
    ├── meta
    │   ├── title           → 标题 (maxLength 50)
    │   ├── date            → 日期 (YYYY-MM-DD)
    │   ├── chapterIndex    → 章节索引 (0-4)
    │   ├── order           → 章内显示顺序
    │   ├── tags[]          → 标签 (maxItems 5)
    │   ├── emotionalTemperature → 色温 K (1000-12000)
    │   ├── isHidden        → 是否隐藏记忆
    │   └── unlockCondition → 解锁条件描述
    ├── celestialType       → 路由字段 (5 选 1)
    ├── narrative
    │   ├── prologueText    → 交互前引导文案
    │   ├── bodyText        → 核心回忆正文
    │   ├── epilogueText    → 交互后收尾文案
    │   └── quote           → 可引用金句
    ├── media
    │   ├── primaryImage    → 主图路径
    │   ├── secondaryImages[] → 辅助图片 (maxItems 3)
    │   ├── ambientAudio    → 环境音
    │   ├── spatialAudio    → 3D 空间音效
    │   └── videoLoop       → 循环视频
    ├── physicsParams       → 天体专属物理参数 (直接映射 shader uniform)
    └── interactionConfig
        ├── entryTrigger    → 进入交互方式 (scroll/drag/click/tap/pinch/auto)
        ├── exitBehavior    → 离开行为 (free/noEscape/collapse/fade)
        ├── ambientParticles → 环境粒子数量
        └── cameraStart     → 相机初始位置 (position[3] + lookAt[3])
```

### 3.2 五种 celestialType 物理参数表

#### darkMatterParams（暗物质引力透镜）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `lensStrength` | number | 1.5 | 透镜强度（光线弯曲程度） |
| `einsteinRadius` | number | 120 | 爱因斯坦环半径（像素） |
| `shearFieldOpacity` | number | 0.15 | 剪切场等高线透明度 |
| `hiddenMemoryCount` | integer | 3 | 可解锁的隐藏记忆数量 |
| `convergenceThreshold` | number | 0.8 | 弧线交点收敛阈值 |

#### redshiftParams（红移/蓝移）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `hubbleConstant` | number | 70 | 哈勃常数（km/s/Mpc） |
| `maxRedshift` | number | 8.0 | 最大红移量 z |
| `colorTempNow` | number | 6500 | 当前色温（K） |
| `colorTempPast` | number | 2000 | 过去色温（K） |
| `expansionRate` | number | 0.15 | 宇宙膨胀速率（卡片间距指数） |
| `peculiarVelocity` | number | 0.3 | 本动速度（逆行漂移） |

#### eventHorizonParams（事件视界）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `schwarzschildRadius` | number | 150 | 史瓦西半径 |
| `spin` | number | 0.85 | 黑洞自旋 (0-1，克尔黑洞) |
| `accretionRate` | number | 0.3 | 吸积率 |
| `lensingStrength` | number | 1.2 | 引力透镜强度 |
| `timeDilationFactor` | number | 4.0 | 时间膨胀因子（滚轮阻尼） |
| `photonSphereRadius` | number | 225 | 光子球半径 |

#### rocheLimitParams（洛希极限）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `primaryMass` | number | 100 | 主星质量 |
| `secondaryMass` | number | 30 | 伴星质量 |
| `secondaryDensity` | number | 1.0 | 伴星密度（决定洛希极限距离） |
| `tidalLockingDistance` | number | 200 | 潮汐锁定距离 |
| `debrisCount` | integer | 1000 | 撕裂碎片数量 |
| `accretionTemperature` | number | 4500 | 吸积温度（K，碎片发光色温） |

#### gravitationalWaveParams（引力波）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `primaryMass` | number | 35 | 主星质量（太阳质量） |
| `secondaryMass` | number | 30 | 伴星质量 |
| `orbitalDecayRate` | number | 0.02 | 轨道衰减速率 |
| `waveAmplitude` | number | 1.5 | 时空涟漪振幅 |
| `ringdownFrequency` | number | 250 | 振铃频率（Hz） |
| `massEnergyRatio` | number | 0.05 | 质能转化比（引力波辐射损失） |

### 3.3 celestialType ↔ chapterIndex 映射

| chapterIndex | 章节名 | celestialType | 情感主题 | 交互深度 |
|-------------|--------|--------------|---------|---------|
| 0 | 序章 | `darkMatter` | 潜意识的底色 | 轻交互：拖拽探索 |
| 1 | 第一章 | `redshift` | 时间光谱·往事退行 | 中交互：横向时间轴 |
| 2 | 第二章 | `eventHorizon` | 不可逆的抉择 | 重交互：纵向深潜坠落 |
| 3 | 第三章 | `rocheLimit` | 亲密关系的潮汐 | 重交互：双星拖拽逼近 |
| 4 | 终章 | `gravitationalWave` | 永恒的时空涟漪 | 轻交互：触发即播放 |

---

## 4. UI 布局确认

### 4.1 登录页 (login.html)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│    #starfield (Canvas, z-index:1, 全屏固定)              │
│    · 400 颗星点，2D Canvas 闪烁动画                       │
│    · 背景: #000011                                      │
│                                                         │
│           ┌─────────────────────────┐                   │
│           │   .login-portal          │                   │
│           │   (z-index:10)           │                   │
│           │   backdrop-filter:blur   │                   │
│           │   420px 宽, 居中垂直      │                   │
│           │                          │                   │
│           │   奇点验证 (标题)          │                   │
│           │   AUTHENTICATION REQUIRED │                   │
│           │                          │                   │
│           │   [观测者 ID     ]        │                   │
│           │   [引力密钥     ]        │                   │
│           │   [事件视界尚未形成]       │  ← 按钮初始态      │
│           │   输入凭证以坍缩波函数     │  ← hint           │
│           └─────────────────────────┘                   │
│                                                         │
│    #wormhole-overlay (Canvas, z-index:100, 初始 opacity:0)│
│    · 800 粒子虫洞穿梭动画                                 │
│    · 验证成功后激活: forming→traveling→exit               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**登录页关键交互状态**：
- **初始态**：按钮 disabled，文案"事件视界尚未形成"
- **输入态**：用户名+密码均非空 → 按钮激活，文案"启动虫洞引擎"
- **校验中**：hint "正在校验时空坐标..."，600ms 延迟
- **成功**：卡片淡出+放大 → 虫洞动画启动 → 2s 后跳转 `universe.html`
- **失败**：卡片左右震动 → hint 红色提示剩余次数
- **锁定**：5 次失败 → 60s 倒计时锁定，hint "探测到异常引力波"

### 4.2 主宇宙页 (universe.html)

```
┌─────────────────────────────────────────────────────────┐
│  #main-canvas (Three.js WebGL, 全屏, z-index:1)         │
│  · 由 SceneRouter 动态挂载当前章节渲染器                  │
│  · 所有 3D 场景在此渲染                                   │
│                                                         │
│  ┌─ UI 叠加层 (z-index:10+, pointer-events:none) ──────┐│
│  │                                                     ││
│  │  ┌─ 左上角 ─┐                    ┌─ 右上角 ─────┐   ││
│  │  │ 章节     │                    │ 物理参数 HUD  │   ││
│  │  │ 标题     │                    │ (JetBrains   │   ││
│  │  │ (Serif)  │                    │  Mono)       │   ││
│  │  └──────────┘                    └──────────────┘   ││
│  │                                                     ││
│  │            ┌─ 中央/场景内 ──────────┐                ││
│  │            │  narrative 文案层       │                ││
│  │            │  · prologueText        │                ││
│  │            │  · bodyText (交互后)   │                ││
│  │            │  · epilogueText        │                ││
│  │            │  · quote (金句)        │                ││
│  │            └────────────────────────┘                ││
│  │                                                     ││
│  │  ┌─ 底部 ────────────────────────────────────────┐  ││
│  │  │  导航/进度指示 (当前章节 / 记忆序号)            │  ││
│  │  └────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.3 五大场景交互布局

#### 序章：暗物质引力透镜

```
┌─────────────────────────────────────────────────────────┐
│  [可见记忆星系卡片]    [可见记忆星系卡片]    [可见星系]    │
│     · 有图有文字         · 可拖拽              · 可拖拽   │
│                                                         │
│         ░░░░░░░░░░░░░░░░░░░░░░░░░░░                    │
│         ░  暗物质密度场 (透明, 仅引力效应)  ░            │
│         ░  · 鼠标悬停 → 引力等势线       ░            │
│         ░  · 拖拽星系到此 → 背景光弧形扭曲  ░            │
│         ░░░░░░░░░░░░░░░░░░░░░░░░░░░                    │
│                                                         │
│  [边缘: 剪切场等高线] ← 半透明, 暗示暗物质分布             │
│                                                         │
│  ★ 3 个爱因斯坦弧交于一点 → 暗物质显形 → 隐藏记忆浮现     │
│  (仅文字, 无图片: "这是无法被镜头记录的质量。你叫它童年。") │
└─────────────────────────────────────────────────────────┘
```

#### 第一章：红移与蓝移

```
┌─────────────────────────────────────────────────────────┐
│  [过去 ←───────────────────────────────────── 现在]      │
│                                                         │
│  z=8.2          z≈4            z≈1           z≈0        │
│  红色模糊      橙色          暖白          蓝白锐利      │
│  间距大 ←── 卡片间距指数增大(哈勃流) ──→ 间距小          │
│                                                         │
│  ★ 某些卡片有"本动速度"，逆哈勃流漂移，需点击"抓住"       │
│                                                         │
│  ┌─ 底部时间轴 ──────────────────────────────────────┐  │
│  │ ◄ [拖拽此轴控制红移量] ►                          │  │
│  │ 左拖→过去(红移) / 右拖→现在(蓝移)                 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  [右上角: z 值实时显示]  z=0 现在  z>5 深空早期          │
└─────────────────────────────────────────────────────────┘
```

#### 第二章：事件视界

```
┌─────────────────────────────────────────────────────────┐
│  ▲ 顶部引导文案 (引力透镜扭曲中)                          │
│  "前方是 2008 年的奇点。警告：视界内的信息无法向外传递。" │
│  · 文字/图片随滚动深入被奇点引力场扭曲                    │
│                                                         │
│              ╭─── 光子球层 (高亮光子轨道) ───╮           │
│              │                                │          │
│              │     ●  黑洞 (纯黑球体)         │          │
│              │    ╱╲╱╲╱╲ 吸积盘 (旋转光环)    │          │
│              │                                │          │
│              ╰────────────────────────────────╯          │
│                                                         │
│  ▼ 向下滚动 = 向黑洞深潜                                 │
│  · 滚轮阻尼增加 (时间膨胀: "越接近那个时刻，时间越粘稠")  │
│  · 滚过 50% → 背景纯黑, UI 消失, 只能继续坠落            │
│  · 不可逆: 想回看只能刷新页面                             │
│                                                         │
│  [视界线 50%处] → 核心记忆正文浮现                        │
│  "你已越过事件视界。从此，所有通往过去的路径都指向未来。" │
└─────────────────────────────────────────────────────────┘
```

#### 第三章：洛希极限

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│    ●────────────── d ──────────────●                     │
│  "我" (大星)                    "你" (小星)              │
│  primaryMass:100              secondaryMass:30           │
│                                                         │
│  · 拖拽任一星体调整距离 d                                │
│  · 靠近时 → 潮汐隆起 (椭球形变), 文字被"拉向"对方         │
│                                                         │
│           ┊ ← 洛希极限分界线 (发光, 实时计算)            │
│           ┊   d < d_R → 撕裂!                            │
│                                                         │
│  ★ 距离 < 洛希极限:                                     │
│    小星优雅拉伸→碎裂→形成发光星环 (1000 碎片高速旋转)    │
│    记忆碎片在星环中旋转                                  │
│                                                         │
│  ★ 距离 > 洛希极限 + 点击"锁定":                        │
│    双星潮汐锁定 → 永远同一面朝向彼此旋转                 │
│    → 光桥连接两者, 记忆文字浮现                          │
│                                                         │
│  [底部: d=xxx, d_R=xxx, F_tidal=xxx 实时显示]           │
│  [密度滑块: 调节 secondaryDensity]                      │
└─────────────────────────────────────────────────────────┘
```

#### 终章：引力波

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│         ●────缠绕轨道────●                               │
│      primaryMass:35   secondaryMass:30                   │
│      (双致密星体共舞)                                    │
│                                                         │
│  · 拖拽 → 调整轨道速度和质量比                           │
│  · 拖拽时周围记忆碎片(小星体)被扰动, 周期性摇摆           │
│    (引力波驻波效应)                                      │
│                                                         │
│  ════════════════════════════════════════               │
│  [并合按钮] ← 点击触发                                   │
│  ════════════════════════════════════════               │
│                                                         │
│  ★ 并合瞬间:                                            │
│    1. 时空涟漪: 所有元素横向拉伸→纵向压缩, 正弦波扩散     │
│    2. 啁啾音效: LIGO 真实引力波波形转化 (频率升高)        │
│    3. 永久形变: 记忆文本呈波浪形排列 (永久偏移)           │
│    4. 合并为更大黑洞, 质量损失=引力波能量                │
│       "质量减少了 3 个太阳质量。它们变成了时空的形状。"   │
│                                                         │
│  [终章结语 + 致谢 + 结束页]                              │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 任务清单

### 5.1 P0 - MVP 必须（阶段一，2-3 周）

> **MVP 目标**：登录页 + 事件视界单章可完整运行（视觉冲击力最强）

| # | 任务名称 | 涉及文件 | 实现要点 | 依赖 | 预估 |
|---|---------|---------|---------|------|------|
| P0-1 | 项目目录结构搭建 | 全部目录骨架 | 按方案第 10 章创建完整目录树；`index.html`→`login.html` 跳转逻辑；配置 Live Server | 无 | 15min |
| P0-2 | 登录页 HTML + CSS | `login.html`, 内联 CSS | 深空星场 Canvas + 居中登录卡片 + 虫洞穿梭遮罩层；Tailwind CDN + Google Fonts | P0-1 | 30min |
| P0-3 | 星场背景动画 | `js/login.js` (Starfield 类) | 2D Canvas, 400 星点闪烁, `requestAnimationFrame` 循环 | P0-2 | 20min |
| P0-4 | 登录认证逻辑 | `js/login.js` (认证部分) | SHA-256 哈希比对 (`crypto.subtle`)；5 次锁定 60s；sessionStorage 令牌；输入监听激活按钮 | P0-3 | 30min |
| P0-5 | 虫洞穿梭动画 | `js/login.js` (WormholeAnimation 类) | 800 粒子, forming→traveling→exit 三阶段；拉丝光流+蓝移红移+中央虫洞环；2s 后跳转 universe.html | P0-4 | 40min |
| P0-6 | 路由守卫 | `js/auth-guard.js` | IIFE 检查 sessionStorage token + 1h 超时；无令牌 `replace` 到 login.html | 无 | 10min |
| P0-7 | 主宇宙页骨架 | `universe.html`, `js/app.js` | 全屏 Canvas + auth-guard 引入 + module 脚本加载 app.js | P0-6 | 15min |
| P0-8 | CelestialRenderer 基类 | `engine/core/CelestialRenderer.js` | Three.js Scene/Camera/Renderer 初始化；init/update/onScroll/onDrag/onTap/onPinch 抽象方法；renderFrame 循环；start/pause/destroy 资源管理；loadTexture/bindEvent/addDisposable 辅助方法 | 无 | 40min |
| P0-9 | DataLoader | `engine/core/DataLoader.js` | `loadUniverse()` fetch + Map 缓存；`getMemoriesByChapter()`；`getMemoryById()`；`getConfig()`；`preloadImages()` Promise.allSettled | 无 | 25min |
| P0-10 | InputAdapter (PC 端) | `engine/core/InputAdapter.js` | 鼠标 mousedown/move/up + wheel；统一 emit scroll/dragStart/drag/dragEnd/tap/pinch；on/off 事件订阅；destroy 清理 | 无 | 30min |
| P0-11 | SceneRouter 基础版 | `engine/core/SceneRouter.js` | RendererRegistry 动态 import；mount() 卸载旧场景→实例化新场景→init→start；handleInput 转发；handleResize；collapse/wormhole 转场接口（先留 placeholder） | P0-8 | 30min |
| P0-12 | EventHorizonRenderer | `engine/renderers/EventHorizonRenderer.js` | 继承 CelestialRenderer；init() 构建黑洞球体+吸积盘+光子球；onScroll() 滚轮深潜+阻尼(时间膨胀)；引力透镜扭曲；50%视界穿越→纯黑+UI隐藏；记忆正文浮现 | P0-8, P0-11 | 60min |
| P0-13 | 引力透镜 Shader | `engine/shaders/blackhole.vert`, `blackhole.frag`, `gravitationalLensing.frag`, `accretionDisk.frag`, `common.glsl` | 后处理透镜扭曲 shader；吸积盘发光+多普勒色温；光子球高亮 | P0-12 | 50min |
| P0-14 | CosmicMemoirApp 控制器 | `engine/App.js` | 组合 SceneRouter+InputAdapter+DataLoader+PerformanceProfiler；init() 加载数据+loadChapter(0)；bindInput 转发；bindResize 防抖；nextMemory 章节推进 | P0-9, P0-10, P0-11 | 30min |
| P0-15 | MVP 数据文件 | `data/memories.json` | universeConfig + 3-5 条 eventHorizon 记忆（含示例文案/物理参数/交互配置） | 无 | 20min |
| P0-16 | PerformanceProfiler | `engine/core/PerformanceProfiler.js` | FPS 采样(30 帧窗口)；动态降级 high/medium/low；qualityChange 事件；getSettings() 返回粒子数/阴影/Bloom/抗锯齿配置 | 无 | 20min |
| P0-17 | 本地部署测试 | - | Live Server 启动；全流程走通: index→login→虫洞→universe→事件视界深潜 | P0-1~P0-16 | 15min |

### 5.2 P1 - 五章串联（阶段二，3-4 周）

| # | 任务名称 | 涉及文件 | 实现要点 | 依赖 | 预估 |
|---|---------|---------|---------|------|------|
| P1-1 | DarkMatterRenderer | `engine/renderers/DarkMatterRenderer.js` | 可见记忆星系卡片(有图有文)+拖拽；暗物质密度场(透明,仅引力效应)；光线弯曲 shader；爱因斯坦环；剪切场等高线；3 弧交点→隐藏记忆解锁 | P0-8 | 60min |
| P1-2 | 暗物质透镜 Shader | `engine/shaders/` (新增 lensing 相关) | 引力透镜光线弯曲后处理；等势线渲染；弧形扭曲 | P1-1 | 40min |
| P1-3 | RedshiftRenderer | `engine/renderers/RedshiftRenderer.js` | 水平时间轴拖拽；色温映射 2000K→6500K(着色器)；哈勃流间距指数膨胀；本动速度逆行卡片；z 值实时 HUD | P0-8 | 50min |
| P1-4 | RocheLimitRenderer | `engine/renderers/RocheLimitRenderer.js` | 双星系统 3D；拖拽调整距离；潮汐形变(椭球 mesh 变形)；洛希极限实时计算+发光分界线；撕裂碎片(Cannon-es 质点弹簧)；潮汐锁定轨道 | P0-8 | 60min |
| P1-5 | GravitationalWaveRenderer | `engine/renderers/GravitationalWaveRenderer.js` | 双致密星体缠绕轨道；拖拽调轨道速度/质量比；并合触发→时空涟漪正弦波扩散；永久文本形变；啁啾音效；质量损失显示 | P0-8 | 60min |
| P1-6 | 坍缩跃迁转场动画 | `engine/core/SceneRouter.js` (playCollapseTransition) | GSAP 时间轴: 元素拉向中心→蓝移→纯黑奇点→虫洞环爆发→隧道穿梭→新场景浮现 | P0-11, 所有 P1 渲染器 | 40min |
| P1-7 | 虫洞进入转场 | `engine/core/SceneRouter.js` (playWormholeEntry) | 首次进入序章的虫洞抵达动画 | P1-6 | 20min |
| P1-8 | 章节导航与进度系统 | `js/app.js`, `universe.html` UI 层 | nextMemory 逻辑完善；章节进度指示器；记忆序号显示；结束页 | P0-14 | 30min |
| P1-9 | 完整回忆数据填充 | `data/memories.json` | 30-40 条真实回忆数据，覆盖 5 个章节；含文案/标签/色温/物理参数 | P0-15 | 60min |
| P1-10 | 图片/音频资源准备 | `assets/memories/*.jpg`, `assets/audio/*.ogg`, `assets/video/*.mp4` | 30-40 张照片(WebP, max 1920px)；环境音频(Ogg)；吸积盘视频 | 无 | 60min |
| P1-11 | 响应式布局 (PC 端) | `css/custom.css`, 各 HTML | 全屏 Canvas 适配；UI 叠加层定位；不同分辨率测试 | P1-8 | 30min |
| P1-12 | GSAP 集成 | `lib/gsap.min.js` 或 CDN | ScrollTrigger 引入；动画时间轴；缓动函数 | P1-6 | 15min |

### 5.3 P2 - Polish（阶段三，2-3 周）

| # | 任务名称 | 涉及文件 | 实现要点 | 依赖 | 预估 |
|---|---------|---------|---------|------|------|
| P2-1 | Android 触摸事件适配 | `engine/core/InputAdapter.js` | 启用 touchstart/move/end；单指拖拽；双指捏合；惯性滑动 | P0-10 | 30min |
| P2-2 | 移动端性能优化 | 各 Renderer | 纹理压缩；粒子数减少；Bloom 关闭；pixelRatio 限制 | P0-16 | 40min |
| P2-3 | PWA 支持 | `manifest.json`, `service-worker.js` | 离线缓存；添加到主屏幕；资源预缓存 | 无 | 40min |
| P2-4 | 加载进度条与预加载 | `js/app.js`, `universe.html` | DataLoader.preloadImages 进度反馈；LoadingManager onComplete；资源预缓存 | P0-9 | 25min |
| P2-5 | 音效系统集成 | `engine/core/AudioManager.js` (新增) | 三层音效: 环境底噪+交互反馈+叙事音效；Web Audio API；空间音频 | P1-10 | 40min |
| P2-6 | 视觉调优 | 各 Renderer + Shader | 动画缓动精修；色温精确校准；粒子参数微调；Bloom/后处理调优 | 所有 P1 | 40min |
| P2-7 | Cannon-es 物理引擎集成 | `engine/physics/` (新增) | 洛希极限撕裂的质点弹簧系统；引力波驻波模拟 | P1-4, P1-5 | 40min |
| P2-8 | 全面测试与 Bug 修复 | 全项目 | 多浏览器测试(Chrome/Firefox/Edge)；性能 profiling；边界情况处理 | 所有 | 60min |
| P2-9 | 密码修改工具 | `js/login.js` 或独立脚本 | 提供密码哈希生成命令/脚本；更新 passwordHash | 无 | 10min |

### 5.4 任务依赖关系图

```
P0-1 (目录结构)
 ├── P0-2 (登录HTML) → P0-3 (星场) → P0-4 (认证) → P0-5 (虫洞动画)
 ├── P0-6 (路由守卫) → P0-7 (宇宙页骨架)
 │
P0-8 (基类) ─────────────────────────────────┐
P0-9 (DataLoader) ──────────────────┐        │
P0-10 (InputAdapter) ───────────────┤        │
P0-16 (Profiler) ───────────────────┤        │
                                    ├── P0-11 (SceneRouter) ──┤
                                    │                         ├── P0-12 (EventHorizon)
                                    │                         │      ↓
                                    │                         ├── P0-13 (Shaders)
                                    │                         │      ↓
                                    └── P0-14 (App) ──────────┤
                                                              ↓
                                              P0-15 (数据) → P0-17 (测试)
                                                              ↓
                                                    ═══ MVP 完成 ═══
                                                              ↓
                                    P1-1~P1-5 (四个渲染器) ── 并行
                                              ↓
                                    P1-6~P1-7 (转场动画)
                                              ↓
                                    P1-8~P1-12 (串联+资源)
                                              ↓
                                    ═══ 五章串联完成 ═══
                                              ↓
                                    P2-1~P2-9 (Polish)
```

### 5.5 可并行任务标注

以下任务之间无依赖，可并行开发：

| 并行组 | 任务 | 前置条件 |
|--------|------|---------|
| **组 A** | P0-6 (路由守卫) + P0-8 (基类) + P0-9 (DataLoader) + P0-10 (InputAdapter) + P0-16 (Profiler) + P0-15 (数据) | P0-1 完成 |
| **组 B** | P1-1 (暗物质) + P1-3 (红移) + P1-4 (洛希) + P1-5 (引力波) | P0-8 完成 |
| **组 C** | P2-1 (触摸) + P2-3 (PWA) + P2-5 (音效) + P2-9 (密码工具) | 无强依赖 |

---

## 6. 技术风险与注意事项

### 6.1 高风险项

| 风险 | 级别 | 影响范围 | 缓解措施 |
|------|------|---------|---------|
| **引力透镜 Shader 复杂度** | 🔴 高 | P0-13, P1-2 | 后处理 shader 需要扭曲屏幕 UV，计算量大。建议先实现简化版(径向扭曲)，再迭代到完整爱因斯坦环效果。参考 Three.js `EffectComposer` + 自定义 `ShaderPass` |
| **Cannon-es 物理引擎未集成** | 🔴 高 | P1-4, P1-5, P2-7 | 方案中提到 Cannon-es 但引擎层无物理模块。洛希撕裂和引力波驻波需要质点弹簧系统。建议 P2 阶段新增 `engine/physics/` 模块，MVP 阶段用简化几何变形替代 |
| **ES Module 本地加载限制** | 🟡 中 | 全项目 | `file://` 协议下 ES Module 的 `import` 会被 CORS 拦截。**必须使用 HTTP 服务器**（Live Server / `python -m http.server`）。部署时也需确保服务器正确设置 MIME 类型 |
| **动态 import 路径** | 🟡 中 | P0-11 | `RendererRegistry` 使用相对路径 `import('../renderers/XxxRenderer.js')`，需确保运行时 base URL 正确。建议在 `universe.html` 中以 `<script type="module">` 加载 app.js，确保相对路径基于 `engine/core/` |
| **Canvas 尺寸初始化** | 🟡 中 | P0-8 | `CelestialRenderer` 构造函数中使用 `canvas.clientWidth/clientHeight`，若 Canvas 尚未布局完成可能为 0。建议在 `init()` 中再次校验尺寸，或使用 `ResizeObserver` |
| **内存泄漏** | 🟡 中 | P0-8, P0-11 | 频繁切换场景时 Three.js 资源(Geometry/Material/Texture)可能泄漏。基类 `destroy()` 已实现清理，但需确保子类将所有资源注册到 `disposables` 数组 |

### 6.2 安全注意事项

| 项目 | 说明 | 风险等级 |
|------|------|---------|
| **前端哈希可逆** | SHA-256 哈希写在 JS 源码中，有经验者可直接读取并暴力破解。当前适用于个人回忆录，非生产级安全 | 🟡 中 |
| **sessionStorage 可伪造** | 令牌存储在前端，用户可直接在控制台写入。路由守卫仅防正常用户误访问，无法防恶意用户 | 🟡 中 |
| **memories.json 完全公开** | 所有回忆内容（含隐藏记忆）可通过直接访问 JSON 文件获取。`isHidden` 仅控制 UI 显示，非真正的访问控制 | 🟢 低（个人项目可接受） |
| **localStorage 计数器可清除** | 失败次数计数存储在 localStorage，用户可手动清除绕过锁定 | 🟢 低 |

### 6.3 性能注意事项

| 场景 | 预期瓶颈 | 优化建议 |
|------|---------|---------|
| **事件视界引力透镜** | 后处理 shader 全屏逐像素计算 | 降级时降低渲染分辨率(0.5x)，或切换为简化版径向扭曲 |
| **暗物质 800 粒子** | 粒子系统 + 透镜后处理叠加 | `PerformanceProfiler` 降级时粒子数 ×0.2 |
| **洛希极限 1000 碎片** | 物理模拟 + 碎片渲染 | 降级时碎片数 ×0.2，简化碰撞检测 |
| **章间转场** | GSAP 动画 + Three.js 渲染同时进行 | 转场期间暂停旧场景 `renderFrame()`，仅渲染转场层 |
| **纹理加载** | 30-40 张高清图片 | 使用 WebP 格式；按章节懒加载；`DataLoader.preloadImages()` 仅预加载当前章节 |

### 6.4 开发规范确认（来自第 11 章交接清单）

| 规范 | 确认 |
|------|------|
| Three.js 版本 r160+，GSAP 版本 3.12+ | ✅ |
| 所有 Renderer 继承 CelestialRenderer，禁止直接修改基类 | ✅ |
| 所有动画参数必须从 `data.physicsParams` 读取，禁止硬编码 | ✅ |
| 输入事件必须通过 InputAdapter 转发，禁止在 Renderer 中直接监听 DOM | ✅ |
| 图片资源 WebP 格式，最大宽度 1920px | ✅ |
| 音频资源 Ogg Vorbis 或 AAC 格式 | ✅ |
| 部署前开启 PerformanceProfiler，确保低端设备帧率 > 24fps | ✅ |
| 内容编辑仅需修改 `data/memories.json` | ✅ |

### 6.5 架构决策记录

| 决策点 | 方案选择 | 理由 |
|--------|---------|------|
| **模块系统** | ES Module (原生 `import/export`) | 无需构建工具，纯静态部署；Three.js r160+ 原生支持 ESM |
| **状态管理** | 无框架，App 控制器集中管理 | 项目规模小，引入 Vue/React 过度设计 |
| **路由方案** | 多 HTML 文件 + `window.location` 跳转 | 无 SPA 框架，多页面方案更简单；auth-guard 独立引入 |
| **CSS 方案** | Tailwind CDN + 内联/自定义 CSS | 快速开发，不干扰 Canvas 层；后期可迁移到构建版 |
| **物理引擎** | MVP 不用，P2 阶段引入 Cannon-es | MVP 优先视觉冲击；物理模拟为增强项 |
| **部署方式** | 静态文件托管 (Live Server / Nginx / GitHub Pages) | 无后端，纯静态文件 |

---

## 附录：MVP 验收标准

MVP（阶段一）完成后需满足以下验收条件：

- [ ] `index.html` 自动跳转到 `login.html`
- [ ] 登录页星场背景正常闪烁
- [ ] 输入正确凭证 → 虫洞穿梭动画播放 → 跳转 `universe.html`
- [ ] 输入错误凭证 → 震动反馈 + 剩余次数提示
- [ ] 5 次错误 → 60 秒锁定倒计时
- [ ] 直接访问 `universe.html` → 被路由守卫拦截回 `login.html`
- [ ] 事件视界场景：黑洞 + 吸积盘 + 光子球正确渲染
- [ ] 向下滚动 → 引力透镜扭曲 + 滚轮阻尼(时间膨胀)
- [ ] 滚过 50% → 背景纯黑 + UI 消失 + 记忆正文浮现
- [ ] `PerformanceProfiler` 正常运行，FPS 显示正常
- [ ] 窗口缩放 → Canvas 正确响应

---

> **下一步行动**：按 P0 任务清单顺序执行，优先完成 P0-1（目录结构）和并行组 A 中的独立模块。MVP 预计 2-3 周内完成。
