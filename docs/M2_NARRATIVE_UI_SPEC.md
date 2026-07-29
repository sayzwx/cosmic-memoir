# M2 叙事 UI 与导航实施规格

## 1. 状态

- 规划状态：已确认，等待实施。
- 所属阶段：主页面优化。
- 依赖模块：M3 应用流程、M4 场景路由与转场、M5 输入系统、M6 内容系统、M8-M12 场景渲染器。
- 登录页面：已完成并冻结，不纳入本模块改造。

## 2. 目标

建立一套轻量、沉浸、物理感一致的叙事界面系统。在不割裂 3D 场景沉浸感的前提下，传递章节标题、正文、实时物理状态、导航和双轨进度。M2 是五个视觉章节共享的信息骨架，不承载场景自身的 3D 交互实现。

## 3. 范围

### 3.1 保留

| 项 | 规则 |
|---|---|
| 章节标题层级 | 主标题 + 物理概念标签，维持叙事节奏 |
| 正文渐入渐出 | 仅使用 `opacity` 与 `transform` |
| 进度概念 | 同时展示旅程位置和场景探索深度 |
| 前后导航 | 始终存在明确路径；转场期间可见但不可操作 |
| 暗色基调 | 低饱和、低遮挡，不与 Canvas 发光效果争夺焦点 |

### 3.2 删除

| 项 | 规则 |
|---|---|
| 传统固定导航栏 | 不引入顶部或侧边菜单 |
| 浏览器原生滚动条 | 页面保持全屏；正文使用内部滚动容器 |
| 模态内容弹窗 | 术语解释使用非模态浮层 |
| 面包屑 | 由章节轨道和记忆进度替代 |
| 高饱和装饰 | 强调色仅用于状态、焦点和进度 |

### 3.3 新增

| 能力 | 说明 |
|---|---|
| 物理 HUD | 默认折叠；显示当前场景实时量；桌面右上展开，移动端底部半屏展开 |
| 叙事遮罩 | 与 M4 转场共用时间轴，承载章节登场和退场文案 |
| 双轨进度 | 叙事轨表示整个旅程位置；探索轨表示当前场景交互完成度 |
| Epilogue | 汇总完成章节、隐藏内容、总耗时，并提供重新启程 |
| 章节主题 | 按 `celestialType` 设置低饱和强调色，不修改场景配色 |
| 阅读模式 | `compact` 仅显示标题和引导；`deep` 显示完整正文、金句和物理注释 |
| 纯观赏模式 | 收起正文、HUD 和辅助信息，保留低透明度导航唤醒区 |

## 4. 已冻结的产品决策

### 4.1 导航粒度

左右导航的默认粒度为“上一条/下一条记忆”，跨越章节边界时由 M3 自动进入上一章或下一章。左侧章节轨用于展示和直接跳转章节，不替代记忆级导航。

原因：当前 `CosmicMemoirApp.nextMemory()` 和 `prevMemory()` 已按记忆推进；每章存在多条回忆。如果箭头直接按章节切换，会导致章内记忆无法访问。

### 4.2 进度跳转确认

- 点击当前章节节点：不执行操作。
- 点击相邻章节节点：直接跳转。
- 跨越两个及以上章节：显示 2 秒内可撤销的非模态确认条，不使用阻断弹窗。
- 转场进行中：所有进度跳转禁用。

### 4.3 滚轮输入优先级

正文不全局抢占滚轮。输入优先级如下：

1. 指针位于深度阅读正文内部：滚动正文。
2. HUD 已展开且指针位于 HUD 内部：滚动 HUD。
3. 当前场景声明独占滚轮：转发给场景，例如 `eventHorizon`。
4. 其他场景：向下滚动展开正文，向上滚动收起正文。

`Space` 始终切换正文；焦点位于输入、按钮或链接时不截获空格键。

### 4.4 移动端渲染行为

移动端正文滚动期间调用场景 `pause()`；滚动停止 150ms 后调用 `start()`。桌面端正文展开不暂停场景，只允许 M7 根据当前性能等级降低质量。

### 4.5 HUD 更新频率

场景状态可以逐帧变化，但 DOM HUD 最多以 15Hz 更新。M2 保存最新采样，在 `requestAnimationFrame` 中批量写入文本和 CSS 变量，避免“误差小于 1 帧”造成不必要的 DOM 压力。

## 5. 信息架构

### 5.1 页面层级

| 层级 | 元素 | 说明 |
|---|---|---|
| L0 | `#main-canvas` | 3D 场景，不属于 M2 |
| L1 | 叙事遮罩 | 仅在初始加载、转场和结束时覆盖场景 |
| L2 | 章节标题 | 左上安全区内，轻量常驻 |
| L2 | HUD | 桌面右上、移动端右下入口 |
| L2 | 正文阅读面板 | 居中偏下，按模式展开 |
| L2 | 双轨进度 | 桌面左侧垂直，移动端底部水平 |
| L2 | 前后导航 | 桌面左右边缘，移动端使用手势和辅助按钮 |
| L3 | 术语解释浮层 | 锚定概念标签，非模态，可独立关闭 |
| L3 | 跳转确认条 | 底部安全区上方，自动消失，可撤销 |

### 5.2 叙事字段映射

M2 必须使用 `data/memories.json` 已存在的字段，不再读取不存在的 `narrative.primary` 和 `narrative.secondary`。

| UI 状态 | 数据字段 |
|---|---|
| 章节登场 | `meta.title` + `celestialType` 对应的物理概念标签 |
| Compact 引导 | `narrative.prologueText` |
| Deep 正文 | `narrative.bodyText` |
| 交互完成收尾 | `narrative.epilogueText` |
| 金句 | `narrative.quote` |
| HUD 初始参数 | 当前 `physicsParams[celestialType]` |
| 术语解释 | M6 后续新增的可选 `annotations[]`；缺失时标签不可点击 |

## 6. 状态模型

M2 使用单一 UI 状态对象，首阶段保持原生 JavaScript，不引入 React 或额外状态库。

```js
const uiState = {
  phase: 'loading',
  readingMode: 'compact',
  narrativeOpen: false,
  hudOpen: false,
  observationMode: false,
  transitionLocked: false,
  currentChapter: 0,
  currentMemory: 0,
  totalChapters: 5,
  totalMemories: 0,
  narrativeProgress: 0,
  explorationProgress: 0,
  chapterTheme: 'darkMatter',
  hudValues: {},
  completedChapters: new Set(),
  unlockedMemoryIds: new Set(),
  journeyStartedAt: 0
};
```

### 6.1 Phase 枚举

| Phase | 行为 |
|---|---|
| `loading` | 仅加载界面可交互 |
| `entering` | 叙事遮罩播放，导航锁定 |
| `exploring` | Canvas 接收主要输入，Compact 叙事可见 |
| `reading` | Deep 正文展开，按输入优先级处理滚轮 |
| `transitioning` | 所有导航和面板操作锁定 |
| `epilogue` | Canvas 可作为背景，显示旅程汇总 |
| `error` | 显示可恢复错误和重试入口 |

### 6.2 持久化范围

| 数据 | 存储位置 | 生命周期 |
|---|---|---|
| 阅读模式 | `localStorage` | 跨会话保留 |
| 已完成章节 | M3 内存状态；可选 `sessionStorage` | 当前登录会话 |
| 隐藏内容解锁 | M3 内存状态；可选 `sessionStorage` | 当前登录会话 |
| 总耗时起点 | M3 内存状态 | 当前旅程 |
| 面板展开状态 | 仅 M2 内存 | 当前页面 |

## 7. 主题系统

主题使用 `data-theme` 和 CSS 自定义属性，不为每章复制样式。

| `celestialType` | 强调色建议 | 用途 |
|---|---|---|
| `darkMatter` | `#9b8cff` | 节点、焦点、HUD 标记 |
| `redshift` | `#d98772` | 节点、焦点、HUD 标记 |
| `eventHorizon` | `#d6a15f` | 节点、焦点、HUD 标记 |
| `rocheLimit` | `#78a7c8` | 节点、焦点、HUD 标记 |
| `gravitationalWave` | `#8ec8d8` | 节点、焦点、HUD 标记 |

统一变量：

```css
[data-theme] {
  --ui-accent: #9b8cff;
  --ui-panel: rgba(7, 10, 24, 0.58);
  --ui-border: color-mix(in srgb, var(--ui-accent) 28%, transparent);
  --ui-muted: rgba(220, 226, 240, 0.56);
}
```

毛玻璃仅用于展开后的 HUD 和 Deep 正文。折叠态避免持续大面积 `backdrop-filter`，低性能模式直接使用不透明渐变背景。

## 8. 桌面端规格

| 元素 | 规格 |
|---|---|
| HUD | 右上；折叠 `48x48px`；展开宽 `280px`；最大高度 `min(70vh, 560px)` |
| 正文 | 居中偏下；最大宽 `720px`；底部留白 `10vh`；最大高度 `48vh` |
| 导航 | 左右居中；命中区至少 `60x60px`；默认透明度 0.3，hover 0.8，缩放 1.1 |
| 进度 | 左侧垂直 4px 轨道；章节节点显示名称；同时显示细叙事轨和探索轨 |
| 标题 | 左上；标题与 HUD 不重叠；长标题允许两行但不截断 |

键盘映射：

| 按键 | 行为 |
|---|---|
| `ArrowLeft` | 上一条记忆 |
| `ArrowRight` | 下一条记忆 |
| `Space` | 展开或收起正文 |
| `H` | 展开或收起 HUD |
| `Escape` | 关闭术语浮层、HUD 和正文；再次按下进入纯观赏模式 |
| `Enter` | 激活当前聚焦控件 |

## 9. 移动端规格

| 元素 | 规格 |
|---|---|
| HUD | 右下浮动按钮；点击后从底部展开；最高 `50dvh` |
| 正文 | 底部全宽；内部纵向滚动；打开和滚动期间暂停场景 |
| 导航 | 左右边缘点击区 + 水平手势；可见辅助按钮至少 `56x56px` |
| 进度 | 底部水平双轨；节点简化为圆点 |
| 安全区 | 使用全部 `env(safe-area-inset-*)` |
| 触摸目标 | 最小 `44x44px`，关键导航最小 `56x56px` |

手势仲裁：

| 起点/方向 | 行为 |
|---|---|
| 左侧 1/3 点击或右滑 | 上一条记忆 |
| 右侧 1/3 点击或左滑 | 下一条记忆 |
| 底部中央上滑 | 展开正文 |
| 正文内部上下滑 | 阅读正文，不转发场景 |
| HUD 内部上下滑 | 浏览 HUD，不转发场景 |
| 场景主区域手势 | 交由 M5 和当前 Renderer |

## 10. 跨模块事件契约

现有 Renderer 事件保留，但 M2 不直接长期订阅每一种私有事件。实施时增加统一 `sceneTelemetry` 事件，由 M3 或 M4 适配现有事件。

```js
window.dispatchEvent(new CustomEvent('sceneTelemetry', {
  detail: {
    sceneType: 'redshift',
    values: { redshift: 4.2 },
    explorationProgress: 0.48,
    milestone: null,
    timestamp: performance.now()
  }
}));
```

### 10.1 M2 消费的公共事件

| 事件 | 生产者 | M2 行为 |
|---|---|---|
| `sceneWillChange` | M4 | 进入 `transitioning`，锁定操作并播放退场 |
| `sceneMounted` | M4 | 更新标题、正文、主题、叙事进度和 HUD 初值 |
| `sceneTelemetry` | M3/M4 适配层 | 更新 HUD 和探索进度，最高 15Hz 写 DOM |
| `sceneMilestone` | M3/M4 适配层 | 展示 epilogueText，记录章节完成或隐藏解锁 |
| `sceneTransitionProgress` | M4 | 用同一时间源驱动遮罩，避免独立 `setTimeout` 漂移 |
| `memoirComplete` | M3 | 显示 Epilogue |
| `sceneError` | M4 | 进入可恢复错误状态 |

### 10.2 现有事件到统一遥测的映射

| 场景 | 现有事件 | HUD / 探索进度 |
|---|---|---|
| 暗物质 | `darkMatterReady`, `darkMatterDragEnd`, `hiddenMemoryUnlocked` | 捕获比例、汇聚状态、隐藏记忆状态 |
| 红移 | `redshiftChange`, `peculiarCaptured` | `z`、捕获数量、`z / maxRedshift` |
| 事件视界 | `scrollProgress`, `horizonCrossed` | 深潜进度、视界状态 |
| 洛希极限 | `rocheState`, `densityChange`, `rocheLocked`, `rocheDestroyed` | 距离、洛希极限、潮汐力、状态 |
| 引力波 | `orbitalParamsChange`, `mergerComplete` | 轨道速度、质量比、并合状态 |

## 11. 转场时序

M2 不使用独立硬编码定时器模拟 M4 状态。M4 必须提供统一转场进度 `0..1`。

| 进度区间 | M2 行为 |
|---|---|
| `0.00-0.15` | HUD、正文、导航淡出并下移 8px |
| `0.15-0.55` | 章节退场标签显示；旧内容设为 `aria-hidden=true` |
| `0.55-0.78` | 更新新章节 DOM 内容但保持不可见 |
| `0.78-0.92` | 新章节标签和标题登场 |
| `0.92-1.00` | Compact 正文、导航和 HUD 入口恢复；焦点移动到章节标题 |

采用同一进度事件后，UI 与场景时序误差由事件调度控制，目标小于 50ms。

## 12. Epilogue 数据契约

M3 在 `memoirComplete` 中提供汇总，而不是让 M2 扫描 DOM 推断。

```js
{
  completedChapters: 5,
  totalChapters: 5,
  completedMemories: 8,
  totalMemories: 8,
  unlockedHiddenMemories: 1,
  totalHiddenMemories: 1,
  elapsedMs: 742000
}
```

Epilogue 提供：旅程摘要、隐藏内容状态、耗时、`重新启程` 和 `返回最后章节`。重新启程需要 M3 提供 `restartJourney()`，清空本次旅程进度但保留用户阅读模式偏好。

## 13. 无障碍

| 项 | 规则 |
|---|---|
| 页面结构 | 使用 `header`、`main`、`aside`、`nav`、`section` 语义元素 |
| 章节变化 | 独立 `aria-live="polite"` 区域播报章节和记忆标题 |
| HUD 实时数据 | 不放入 live region，避免每帧打断屏幕阅读器 |
| 焦点 | 转场结束聚焦章节标题；面板关闭后焦点回到触发按钮 |
| 键盘 | 所有控件支持 Tab、Enter、Space；不可见控件移出 Tab 顺序 |
| 动效 | `prefers-reduced-motion` 下取消位移动画，仅保留短透明度切换 |
| 对比度 | 正文达到 WCAG AA；辅助参数至少 3:1 |

## 14. 性能预算

| 指标 | 目标 | 实施规则 |
|---|---|---|
| UI 动画 | 60fps 目标 | 仅 `transform`、`opacity`；低性能设备允许跟随显示器实际帧率 |
| 状态响应 | 小于 100ms | 输入处理不等待场景动画完成 |
| HUD DOM 写入 | 最高 15Hz | 最新值覆盖旧值，每帧批量提交 |
| DOM 节点 | 常态小于 200 | 术语和 Epilogue 按需挂载 |
| 字体 | FOUT 优先 | 系统字体先显示，自定义字体异步替换 |
| 毛玻璃 | 最多两个展开面板 | 低性能等级关闭 `backdrop-filter` |
| 移动端阅读 | 场景暂停 | 滚动结束 150ms 后恢复 |

120Hz 设备不要求人为生成 120fps 动画；动画应基于时间而非帧数。30fps 设备必须保持状态正确、输入及时，并自动减少玻璃和过渡效果。

## 15. 文件拆分

M2 实施时采用以下最小拆分：

| 文件 | 职责 |
|---|---|
| `universe.html` | 语义化 M2 DOM 骨架和可访问名称 |
| `css/universe-ui.css` | M2 布局、主题、动效、响应式和 reduced-motion |
| `js/app.js` | 应用启动和 M3/M4 事件桥接；移除具体 UI 渲染细节 |
| `js/ui/NarrativeUI.js` | M2 状态、渲染、键盘、面板、进度和 Epilogue |
| `js/ui/telemetry.js` | 现有场景事件到统一 `sceneTelemetry` 的临时适配 |

不在 M2 阶段引入组件框架，也不将主页面迁移到 React。

## 16. 分阶段实施

### Phase 1：契约修复和静态骨架

- 修正 `narrative` 字段读取。
- 建立语义 DOM、主题变量、响应式布局和安全区。
- 完成标题、Compact/Deep 正文、记忆导航和叙事进度。
- 保留现有 SceneRouter 行为，不改场景视觉。

### Phase 2：HUD 和探索进度

- 建立统一遥测适配层。
- 接入五章 HUD、探索轨和场景里程碑。
- HUD 更新限频至 15Hz。

### Phase 3：转场同步和输入仲裁

- M4 增加转场进度事件。
- M5 增加 UI 命中区、手势优先级和场景滚轮独占能力。
- 完成桌面快捷键和移动端手势。

### Phase 4：Epilogue、无障碍和性能验收

- M3 增加旅程统计和重新启程。
- 完成焦点管理、ARIA、reduced-motion 和低性能样式。
- 完成五章、横竖屏、30/60/120Hz 行为验收。

## 17. 验收映射

| 验收项 | 验证方式 |
|---|---|
| 五章文本无截断溢出 | 逐章加载最长正文；桌面 1280x720、1920x1080；移动 360x640、430x932 |
| 导航反馈明确 | 桌面 hover/focus、移动 pointer/touch 截图与交互测试 |
| HUD 数据同步 | 对每个统一遥测事件断言最后显示值；允许 15Hz 展示节流 |
| 转场误差小于 50ms | 使用同一 `sceneTransitionProgress` 时间戳记录 UI 与场景状态 |
| 横竖屏 300ms 内稳定 | 旋转后采集布局盒，检查安全区和溢出 |
| 完整键盘路径 | 仅键盘走完展开正文、HUD、前后导航、关闭面板和重播 |
| 首次加载 2 秒可用 | 缓存命中条件下记录 DOMContentLoaded 到首个可操作状态 |
| 多刷新率状态正确 | Chrome 性能限制 + 120Hz 实机；动画全部基于时间 |
| Epilogue 汇总正确 | 使用固定旅程状态断言完成数、隐藏数和耗时 |

## 18. 当前代码差距

| 差距 | 当前位置 | 实施阶段 |
|---|---|---|
| 正文读取了不存在的 `primary/secondary` | `js/app.js` | Phase 1 |
| 仅有单轨记忆圆点 | `universe.html`, `js/app.js` | Phase 1 |
| HUD 仅显示静态嵌套对象字符串 | `js/app.js` | Phase 2 |
| Renderer 私有事件没有统一契约 | `engine/renderers/*` | Phase 2 |
| 转场只是固定 600/800ms 等待 | `SceneRouter.js` | Phase 3 |
| 键盘空格当前直接下一条记忆 | `js/app.js` | Phase 3 |
| Canvas 输入无法识别 UI 命中区 | `InputAdapter.js` | Phase 3 |
| 没有旅程统计和 restart API | `engine/App.js` | Phase 4 |
| Pixel ratio 固定最高 2，质量设置未完整落地 | `CelestialRenderer.js` | M7 联动 |

## 19. 实施前置结论

M2 可以先独立完成 Phase 1。Phase 2 需要冻结 M6 的术语与 HUD 字段格式；Phase 3 必须与 M4、M5 一起实施；Phase 4 需要 M3 提供旅程统计。未经这些契约支持，不应在 M2 内通过重复监听或 DOM 推断绕过依赖。
