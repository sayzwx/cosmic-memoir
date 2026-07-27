# CosmicMemoir 前端代码审查报告

> **审查日期**: 2026-07-27  
> **审查范围**: 全部前端代码（HTML / JS / GLSL / CSS / JSON）  
> **审查人**: 资深代码审查工程师

---

## 一、审查摘要

### 总体评价

CosmicMemoir 是一个基于天体物理隐喻的交互式回忆录网站，技术栈为原生 HTML/CSS/JS + Three.js r160 + GSAP（未实际使用）+ Tailwind CSS + ES Module。项目采用无构建工具、无后端的纯前端架构。

代码整体架构设计合理，模块化程度较高，渲染器继承体系清晰，输入适配器和场景路由器的抽象到位。着色器代码质量良好，物理模拟具有创意。

但存在 **4 个严重问题** 导致核心功能不可用：

1. **密码哈希拼写错误** — 登录功能完全失效，任何密码都无法通过验证
2. **路由守卫完全失效** — auth-guard.js 使用了与 login.js 不同的 session key，且自动为允许路径创建 guest token，可被直接绕过
3. **物理参数结构不匹配** — 渲染器期望嵌套的参数对象（如 `physicsParams.eventHorizon`），但数据文件使用扁平结构（如 `physicsParams.schwarzschildRadius`），导致所有渲染器获取到空参数对象
4. **参数命名不一致** — 数据文件中的参数名与渲染器代码中使用的参数名大量不匹配

### 风险等级

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 严重 (Critical) | 7 | 必须修复，否则核心功能不可用 |
| 🟡 警告 (Warning) | 14 | 建议修复，影响质量、安全或性能 |
| 🟢 建议 (Suggestion) | 8 | 可选改进，提升可维护性 |

### 总体评分

**3.5 / 10**

架构设计优秀（8/10），但实现存在致命缺陷，核心功能（登录、物理参数驱动渲染）完全不可用。修复严重问题后预计可达 7/10。

---

## 二、问题清单

### 🔴 严重 (Critical) — 必须修复

---

#### C-01: 密码哈希拼写错误，登录功能完全失效

**文件**: `js/login.js:3`  
**影响范围**: 登录功能完全不可用，任何密码都无法通过验证

**问题描述**:

代码中硬编码的密码哈希值为：
```
2c26d46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae
```

经核实，SHA-256("foo") 的正确哈希值为：
```
2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae
```

两者在第 5 个字符处存在差异（`d` vs `b`），这是一个拼写错误。由于哈希比较是精确匹配，该错误导致任何密码都无法通过验证，登录功能完全失效。

**修复建议**:
```javascript
// 修正拼写错误：第5个字符 d -> b
const CREDENTIALS = {
    username: 'mjsx',
    passwordHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
};
```

---

#### C-02: 路由守卫使用错误的 session key，且自动创建 guest token 绕过登录

**文件**: `js/auth-guard.js:2-22`  
**影响范围**: 身份验证系统完全失效，任何人可直接访问 universe.html

**问题描述**:

存在两个独立问题：

**问题 1 — Session key 不匹配**:
- `login.js` 使用 `cm_token` 作为 token 的 sessionStorage key
- `index.html` 检查 `cm_token`
- `auth-guard.js` 检查 `cosmic_memoir_auth`

```javascript
// login.js:12
const TOKEN_KEY = 'cm_token';

// auth-guard.js:2
var AUTH_KEY = 'cosmic_memoir_auth';
var token = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
```

登录成功后写入的 token 在 auth-guard.js 中永远找不到。

**问题 2 — 自动创建 guest token**:
```javascript
// auth-guard.js:10-22
if (!token && window.location.pathname.indexOf('login') === -1) {
    var allowedPaths = ['/', '/index.html', '/universe.html'];
    // ...
    if (isAllowed) {
        var tempToken = 'guest_' + Date.now();
        sessionStorage.setItem(AUTH_KEY, tempToken);
        window.__cosmicMemoirAuth.authenticated = true;
    }
}
```

当未找到 token 且当前路径在 `allowedPaths` 中时，auth-guard 自动创建 guest token 并标记为已认证。由于 `universe.html` 在允许列表中，任何人直接访问该页面都会被自动放行。

**修复建议**:
```javascript
(function () {
    // 统一使用与 login.js 相同的 key
    var TOKEN_KEY = 'cm_token';
    var LOGIN_TIME_KEY = 'cm_loginTime';
    var SESSION_TIMEOUT = 3600000;

    var token = sessionStorage.getItem(TOKEN_KEY);
    var loginTime = sessionStorage.getItem(LOGIN_TIME_KEY);

    var authenticated = false;

    if (token && loginTime) {
        var elapsed = Date.now() - parseInt(loginTime, 10);
        if (elapsed < SESSION_TIMEOUT) {
            authenticated = true;
        } else {
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(LOGIN_TIME_KEY);
        }
    }

    window.__cosmicMemoirAuth = {
        authenticated: authenticated,
        token: token || null
    };

    if (!authenticated) {
        window.location.replace('./login.html');
    }
})();
```

---

#### C-03: 物理参数结构不匹配 — 渲染器获取到空参数对象

**文件**: 
- `engine/renderers/EventHorizonRenderer.js:34`
- `engine/renderers/DarkMatterRenderer.js:24`
- `engine/renderers/RedshiftRenderer.js:30`
- `engine/renderers/RocheLimitRenderer.js:29`
- `engine/renderers/GravitationalWaveRenderer.js:29`
- `data/memories.json` (全部 memory 条目)

**影响范围**: 所有渲染器使用硬编码默认值而非数据文件中的物理参数，违反"禁止硬编码物理参数"架构要求

**问题描述**:

所有渲染器在 `init()` 中通过嵌套属性读取参数：
```javascript
// EventHorizonRenderer.js:34
const p = this.params.eventHorizon || {};

// DarkMatterRenderer.js:24
const p = this.params.darkMatter || {};

// RedshiftRenderer.js:30
const p = this.params.redshift || {};

// RocheLimitRenderer.js:29
const p = this.params.rocheLimit || {};

// GravitationalWaveRenderer.js:29
const p = this.params.gravitationalWave || {};
```

但 `memories.json` 中的 `physicsParams` 是扁平结构：
```json
"physicsParams": {
    "schwarzschildRadius": 30,
    "accretionDiskTemp": 0.8,
    "timeDilation": 0.3,
    "photonSphereRadius": 45
}
```

不存在 `eventHorizon`、`darkMatter`、`redshift` 等嵌套子对象，因此 `p` 始终为 `{}`，所有参数回退到硬编码默认值。

**修复建议**:

方案 A — 修改数据文件为嵌套结构（推荐）：
```json
"physicsParams": {
    "eventHorizon": {
        "schwarzschildRadius": 30,
        "accretionRate": 0.8,
        "timeDilationFactor": 0.3,
        "photonSphereRadius": 45,
        "spin": 0.5,
        "lensingStrength": 1.0
    }
}
```

方案 B — 修改渲染器直接读取扁平参数：
```javascript
const p = this.params || {};
// 直接使用 p.schwarzschildRadius 等
```

---

#### C-04: 参数命名不一致 — 数据文件参数名与渲染器期望不匹配

**文件**: `data/memories.json` + 各渲染器文件  
**影响范围**: 即使修复了 C-03 的结构问题，大量参数仍因命名不匹配而无法正确读取

**问题描述**:

以下表格列出了所有不匹配的参数：

| 渲染器 | 渲染器期望的参数名 | 数据文件中的参数名 | 状态 |
|--------|-------------------|-------------------|------|
| EventHorizonRenderer | `accretionRate` | `accretionDiskTemp` | ❌ 不匹配 |
| EventHorizonRenderer | `spin` | (无) | ❌ 缺失 |
| EventHorizonRenderer | `lensingStrength` | (无) | ❌ 缺失 |
| EventHorizonRenderer | `timeDilationFactor` | `timeDilation` | ❌ 不匹配 |
| DarkMatterRenderer | `einsteinRadius` | (无) | ❌ 缺失 |
| DarkMatterRenderer | `hiddenMemoryCount` | (无) | ❌ 缺失 |
| DarkMatterRenderer | `shearFieldOpacity` | (无) | ❌ 缺失 |
| DarkMatterRenderer | `convergenceThreshold` | (无) | ❌ 缺失 |
| DarkMatterRenderer | — | `darkMatterDensity` | ❌ 未使用 |
| DarkMatterRenderer | — | `haloRadius` | ❌ 未使用 |
| DarkMatterRenderer | — | `rotationSpeed` | ❌ 未使用 |
| DarkMatterRenderer | — | `particleCount` | ❌ 未使用 |
| RedshiftRenderer | `maxRedshift` | (无) | ❌ 缺失 |
| RedshiftRenderer | `colorTempNow` | (无) | ❌ 缺失 |
| RedshiftRenderer | `colorTempPast` | (无) | ❌ 缺失 |
| RedshiftRenderer | `expansionRate` | (无) | ❌ 缺失 |
| RedshiftRenderer | `peculiarVelocity` | (无) | ❌ 缺失 |
| RedshiftRenderer | — | `redshiftFactor` | ❌ 未使用 |
| RedshiftRenderer | — | `wavelengthShift` | ❌ 未使用 |
| RedshiftRenderer | — | `recessionVelocity` | ❌ 未使用 |
| RocheLimitRenderer | `primaryMass` | (无) | ❌ 缺失 |
| RocheLimitRenderer | `secondaryMass` | (无) | ❌ 缺失 |
| RocheLimitRenderer | `secondaryDensity` | (无) | ❌ 缺失 |
| RocheLimitRenderer | `tidalLockingDistance` | (无) | ❌ 缺失 |
| RocheLimitRenderer | `debrisCount` | (无) | ❌ 缺失 |
| RocheLimitRenderer | `accretionTemperature` | (无) | ❌ 缺失 |
| RocheLimitRenderer | — | `rocheDistance` | ❌ 未使用 |
| RocheLimitRenderer | — | `tidalForce` | ❌ 未使用 |
| RocheLimitRenderer | — | `fragmentationThreshold` | ❌ 未使用 |
| RocheLimitRenderer | — | `bodyRadius` | ❌ 未使用 |
| GravitationalWaveRenderer | `primaryMass` | (无) | ❌ 缺失 |
| GravitationalWaveRenderer | `secondaryMass` | (无) | ❌ 缺失 |
| GravitationalWaveRenderer | `orbitalDecayRate` | (无) | ❌ 缺失 |
| GravitationalWaveRenderer | `ringdownFrequency` | (无) | ❌ 缺失 |
| GravitationalWaveRenderer | `massEnergyRatio` | (无) | ❌ 缺失 |
| GravitationalWaveRenderer | `tidalLockingDistance` | (无) | ❌ 缺失/错误引用 |
| GravitationalWaveRenderer | `waveAmplitude` | `waveAmplitude` | ✅ 匹配 |
| GravitationalWaveRenderer | — | `waveFrequency` | ❌ 未使用 |
| GravitationalWaveRenderer | — | `strain` | ❌ 未使用 |
| GravitationalWaveRenderer | — | `propagationSpeed` | ❌ 未使用 |

**修复建议**: 统一数据文件和渲染器中的参数命名。建议以渲染器代码为准，修改 `memories.json` 中每个 memory 条目的 `physicsParams`，确保包含渲染器所需的所有参数且名称一致。

---

#### C-05: GravitationalWaveRenderer 错误引用 RocheLimit 的参数

**文件**: `engine/renderers/GravitationalWaveRenderer.js:46`  
**影响范围**: 引力波场景的初始轨道半径始终为默认值 200

**问题描述**:
```javascript
this.orbitRadius = p.tidalLockingDistance || 200;
```

`tidalLockingDistance` 是 RocheLimitRenderer 的参数，不属于引力波场景。引力波数据中不存在此字段，因此始终回退到 200。

**修复建议**:
```javascript
this.orbitRadius = p.initialOrbitRadius || 200;
```

并在 `memories.json` 的引力波条目中添加 `initialOrbitRadius` 字段。

---

#### C-06: 着色器加载无错误处理

**文件**: 
- `engine/renderers/EventHorizonRenderer.js:27-31`
- `engine/renderers/RedshiftRenderer.js:23-27`

**影响范围**: 着色器文件加载失败时，`response.text()` 返回 404 页面 HTML，导致着色器编译错误，错误信息不明确

**问题描述**:
```javascript
async _loadShader(name) {
    const url = new URL(`../shaders/${name}`, import.meta.url);
    const response = await fetch(url);
    return response.text();  // 未检查 response.ok
}
```

**修复建议**:
```javascript
async _loadShader(name) {
    const url = new URL(`../shaders/${name}`, import.meta.url);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load shader ${name}: ${response.status} ${response.statusText}`);
    }
    return response.text();
}
```

---

#### C-07: 无 WebGL 支持检测

**文件**: `engine/core/CelestialRenderer.js:17-22`  
**影响范围**: 不支持 WebGL 的浏览器上，`new THREE.WebGLRenderer()` 抛出异常，用户看到的是不友好的错误信息

**问题描述**:

`CelestialRenderer` 构造函数直接创建 WebGLRenderer，未检测 WebGL 支持。在 `SceneRouter.mount()` 的 catch 中虽然会派发 `sceneError` 事件，但错误信息是 Three.js 内部抛出的技术性错误，对用户不友好。

**修复建议**:
```javascript
constructor(canvas, data, options = {}) {
    // ... 其他初始化 ...

    // 检测 WebGL 支持
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!gl) {
        throw new Error('您的浏览器不支持 WebGL，无法运行此应用。请使用现代浏览器。');
    }

    this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: options.antialias !== false,
        alpha: true,
        powerPreference: 'high-performance'
    });
    // ...
}
```

---

### 🟡 警告 (Warning) — 建议修复

---

#### W-01: 密码哈希未加盐

**文件**: `js/login.js:30-34`  
**影响范围**: 安全性降低，哈希值可被彩虹表攻击

**问题描述**:
```javascript
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    // ...
}
```

SHA-256 直接对明文进行哈希，未使用 salt。虽然这是纯前端项目（已知限制），但添加 salt 可以显著提高安全性。

**修复建议**:
```javascript
const SALT = 'cosmic-memoir-2024-salt';

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(SALT + message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
// 需要重新计算 CREDENTIALS.passwordHash = sha256(SALT + 'foo')
```

---

#### W-02: innerHTML 存在潜在 XSS 风险

**文件**: `js/app.js:36-43`  
**影响范围**: 如果错误信息包含用户可控内容，可能导致 XSS

**问题描述**:
```javascript
function showLoadingError(message) {
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="text-center px-8">
                <p class="font-heading text-red-400 text-lg mb-3">星际旅行中断</p>
                <p class="font-mono text-gray-500 text-xs break-all">${message}</p>
            </div>
        `;
    }
}
```

`message` 来自错误对象的 `message` 属性，虽然当前错误源主要是 fetch 失败和内部错误，但如果未来有用户可控的输入进入错误链路，则存在 XSS 风险。

**修复建议**:
```javascript
function showLoadingError(message) {
    if (loadingScreen) {
        // 使用 textContent 避免 XSS
        loadingScreen.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'text-center px-8';

        const title = document.createElement('p');
        title.className = 'font-heading text-red-400 text-lg mb-3';
        title.textContent = '星际旅行中断';

        const detail = document.createElement('p');
        detail.className = 'font-mono text-gray-500 text-xs break-all';
        detail.textContent = message;

        container.appendChild(title);
        container.appendChild(detail);
        loadingScreen.appendChild(container);
        loadingScreen.classList.remove('hidden');
    }
}
```

---

#### W-03: login.js 中 Starfield 和 WormholeAnimation 的事件监听器与 RAF 未清理

**文件**: `js/login.js:95, 145, 130, 291`  
**影响范围**: 内存泄漏；虫洞动画启动后 Starfield 仍在运行，导致性能下降

**问题描述**:

1. Starfield 和 WormholeAnimation 各注册了 `resize` 事件监听器，从未移除
2. Starfield 的 `requestAnimationFrame` 循环从未取消
3. WormholeAnimation 的 `requestAnimationFrame` 在导航前持续运行

```javascript
// Starfield 构造函数
window.addEventListener('resize', () => this.resize());  // 未保存引用，无法移除
// ...
this.animationId = requestAnimationFrame(() => this.animate());  // 持续运行
```

**修复建议**:
```javascript
class Starfield {
    constructor(canvas) {
        // ...
        this._resizeHandler = () => this.resize();
        window.addEventListener('resize', this._resizeHandler);
        this.animate();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this._resizeHandler);
    }
}

// 在 handleSuccess 中启动虫洞时停止 Starfield
async function handleSuccess() {
    // ...
    starfield.stop();  // 停止星空动画
    // ...
    wormhole.start();
}
```

---

#### W-04: app.js 事件监听器未在 destroy 中清理

**文件**: `js/app.js:119-165`  
**影响范围**: 内存泄漏（虽然 beforeunload 时页面即将卸载，影响较小）

**问题描述**:

以下事件监听器注册后从未移除：
- `window.addEventListener('sceneMounted', ...)` (line 119)
- `window.addEventListener('sceneError', ...)` (line 124)
- `window.addEventListener('memoirComplete', ...)` (line 131)
- `nextBtn.addEventListener('click', ...)` (line 146)
- `prevBtn.addEventListener('click', ...)` (line 152)
- `document.addEventListener('keydown', ...)` (line 157)

**修复建议**:

将监听器保存为命名函数，在 `destroy()` 中移除。或在 `app.destroy()` 中统一清理：

```javascript
// 保存引用
const _onSceneMounted = (e) => { hideLoadingScreen(); updateUI(e.detail.memoryData); };
const _onSceneError = (e) => { /* ... */ };
const _onKeyDown = (e) => { /* ... */ };

window.addEventListener('sceneMounted', _onSceneMounted);
document.addEventListener('keydown', _onKeyDown);
// ...

// 在 App 类中添加清理方法，或在 beforeunload 中移除
window.addEventListener('beforeunload', () => {
    window.removeEventListener('sceneMounted', _onSceneMounted);
    document.removeEventListener('keydown', _onKeyDown);
    app.destroy();
});
```

---

#### W-05: DarkMatterRenderer 中 Einstein 弧线透明度衰减 Bug

**文件**: `engine/renderers/DarkMatterRenderer.js:326-329`  
**影响范围**: Einstein 弧线透明度逐帧指数衰减，视觉效果不正确

**问题描述**:
```javascript
for (const arc of this.einsteinArcs) {
    const base = arc.material.opacity;           // 读取当前值（已被上一帧修改）
    arc.material.opacity = base * (0.9 + Math.sin(elapsedTime * 2 + arc.position.x) * 0.1);
}
```

每帧读取的 `base` 是上一帧修改后的值，导致透明度按 `(0.9 + sin*0.1)` 的系数逐帧衰减，几秒后弧线将完全消失。

**修复建议**:
```javascript
// 在创建弧线时存储基础透明度
arc.userData.baseOpacity = 0.3 + proximity * 0.5;

// 在 update 中使用存储的基础值
for (const arc of this.einsteinArcs) {
    const base = arc.userData.baseOpacity || 0.5;
    arc.material.opacity = base * (0.9 + Math.sin(elapsedTime * 2 + arc.position.x) * 0.1);
}
```

---

#### W-06: 全局 CSS transition 应用于所有元素

**文件**: `css/custom.css:38-40`  
**影响范围**: 性能下降，可能导致意外的动画效果，影响 canvas 渲染

**问题描述**:
```css
* {
    transition: background-color 0.3s ease, border-color 0.3s ease, 
                color 0.3s ease, opacity 0.3s ease;
}
```

通配符选择器会对所有元素应用 transition，包括 canvas、动态创建的 HUD 元素等。这可能导致：
1. 频繁更新的元素出现不必要的过渡动画
2. 浏览器需要为每个元素维护 transition 状态，增加内存和 CPU 开销

**修复建议**:
```css
/* 只对需要的元素应用 transition */
.login-portal,
.input-field,
.nav-btn,
.progress-dot,
.hud-line,
.narrative-text {
    transition: background-color 0.3s ease, border-color 0.3s ease,
                color 0.3s ease, opacity 0.3s ease;
}
```

---

#### W-07: RocheLimitRenderer 锁定状态下不更新 currentDistance

**文件**: `engine/renderers/RocheLimitRenderer.js:412-418`  
**影响范围**: 锁定后 `rocheState` 事件报告的距离值过时，HUD 显示不正确

**问题描述**:
```javascript
if (this.lightBridge && this.locked) {
    // ...
    if (this.secondary && this.state !== 'destroyed') {
        const angle = elapsedTime * 0.3;
        this.secondary.position.x = this.primary.position.x + this.currentDistance * Math.cos(angle * 0.1);
        this.secondary.position.y = Math.sin(angle * 0.1) * 30;
    }
}
```

锁定后，secondary 的位置由轨道动画驱动，但 `currentDistance` 未重新计算。`_updatePhysics()` 也不会被调用（因为不在 drag 回调中），导致 `rocheState` 事件中的 `d` 值是锁定时的旧值。

**修复建议**:
```javascript
if (this.lightBridge && this.locked) {
    this._updateLightBridge();
    if (this.secondary && this.state !== 'destroyed') {
        const angle = elapsedTime * 0.3;
        this.secondary.position.x = this.primary.position.x + this.currentDistance * Math.cos(angle * 0.1);
        this.secondary.position.y = Math.sin(angle * 0.1) * 30;
        // 重新计算实际距离
        const actualDist = this.secondary.position.distanceTo(this.primary.position);
        window.dispatchEvent(new CustomEvent('rocheState', {
            detail: { d: actualDist, d_R: this.rocheLimit, F_tidal: this.tidalForce, state: this.state }
        }));
    }
}
```

---

#### W-08: GravitationalWaveRenderer 的 massRatio 属性未被使用

**文件**: `engine/renderers/GravitationalWaveRenderer.js:329`  
**影响范围**: 用户拖动调整质量比的交互无效，无视觉反馈

**问题描述**:
```javascript
onDrag(deltaX, deltaY, startX, startY, currentX, currentY) {
    if (this.merged) return;
    this.orbitalSpeedMult = Math.max(0.2, this.orbitalSpeedMult + deltaX * 0.002);
    this.massRatio = Math.max(0.3, Math.min(3, this.massRatio + deltaY * 0.002));
    // massRatio 更新后从未在物理计算中使用
}
```

`massRatio` 在 `_updateOrbit` 中未被引用，轨道计算始终使用 `gwParams.primaryMass` 和 `gwParams.secondaryMass` 的固定值。

**修复建议**:
```javascript
_updateOrbit(deltaTime, elapsedTime) {
    if (this.merged) return;
    const p = this.gwParams;
    const pm = (p.primaryMass || 35) * this.massRatio;
    const sm = (p.secondaryMass || 30) / this.massRatio;
    const totalMass = pm + sm;
    // ... 使用调整后的 pm, sm 进行计算
}
```

---

#### W-09: 登录表单不支持 Enter 键提交

**文件**: `js/login.js:298-299`  
**影响范围**: 用户体验不佳，必须用鼠标点击按钮

**问题描述**:

只监听了 `input` 事件用于启用/禁用按钮，未监听 `keydown` 事件处理 Enter 键提交。

**修复建议**:
```javascript
function handleKeyDown(e) {
    if (e.key === 'Enter' && !btnEl.disabled && !isLocked) {
        btnEl.click();
    }
}
usernameEl.addEventListener('keydown', handleKeyDown);
passwordEl.addEventListener('keydown', handleKeyDown);
```

---

#### W-10: EventHorizonRenderer.renderFrame 未检查 renderTarget 是否存在

**文件**: `engine/renderers/EventHorizonRenderer.js:347-360`  
**影响范围**: 如果 `init()` 在 `_setupPostProcessing` 之前失败，`renderTarget` 为 null，renderFrame 会崩溃

**问题描述**:
```javascript
renderFrame() {
    if (!this.isActive) return;
    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();
    this.update(dt, t);

    this.renderer.setRenderTarget(this.renderTarget);  // renderTarget 可能为 null
    // ...
}
```

**修复建议**:
```javascript
renderFrame() {
    if (!this.isActive || !this.renderTarget) return;
    // ...
}
```

---

#### W-11: SceneRouter 场景切换时复用同一 canvas 的 WebGL 上下文

**文件**: `engine/core/SceneRouter.js:41-57`  
**影响范围**: 多次场景切换后可能出现 WebGL 上下文问题

**问题描述**:

`SceneRouter.mount()` 在切换场景时调用 `this.currentScene.destroy()`，这会调用 `this.renderer.dispose()`。然后创建新的 `RendererClass`，在 `CelestialRenderer` 构造函数中用同一个 canvas 创建新的 `WebGLRenderer`。

虽然 Three.js 的 `dispose()` 不会强制丢失上下文，但反复创建和销毁 WebGLRenderer 可能导致上下文状态不一致。

**修复建议**:

考虑在 `CelestialRenderer` 中支持复用已有的 renderer 实例，或使用 `forceContextLoss()` 后重新获取上下文。更优方案是共享一个 WebGLRenderer 实例，只切换 Scene 和 Camera。

---

#### W-12: RedshiftRenderer 和 RocheLimitRenderer 缺少 destroy() 覆写

**文件**: 
- `engine/renderers/RedshiftRenderer.js` (无 destroy)
- `engine/renderers/RocheLimitRenderer.js` (无 destroy)

**影响范围**: 代码一致性差；RocheLimitRenderer 的 debris userData 中的数组不会被显式清理

**问题描述**:

DarkMatterRenderer 和 EventHorizonRenderer 都覆写了 `destroy()` 进行额外清理，但 RedshiftRenderer 和 RocheLimitRenderer 没有。虽然基类的 `destroy()` 会清理 scene children 和 disposables，但缺少一致性。

**修复建议**:
```javascript
// RedshiftRenderer
destroy() {
    this.commonShaderSrc = null;
    super.destroy();
}

// RocheLimitRenderer
destroy() {
    if (this.debris) {
        this.debris.userData = null;
    }
    super.destroy();
}
```

---

#### W-13: 隐藏记忆无法被揭示

**文件**: `data/memories.json:59-94`, `engine/renderers/DarkMatterRenderer.js`  
**影响范围**: `mem_1995_shadow`（isHidden: true）永远不会出现在应用中

**问题描述**:

`DataLoader.getMemoriesByChapter()` 过滤掉 `isHidden: true` 的记忆。`getAllMemoriesByChapter()` 虽然不过滤，但从未在应用流程中被调用。

DarkMatterRenderer 的 interactionConfig 中有 `tapRevealsHidden: true`，但 DarkMatterRenderer 未覆写 `onTap()` 方法（继承基类的空实现），因此点击不会触发任何揭示逻辑。

**修复建议**:

如果隐藏记忆是设计意图，需要在 DarkMatterRenderer 中实现 `onTap` 方法：
```javascript
onTap(x, y) {
    // 检测点击是否在暗物质区域
    const mouse = this._screenToNDC(x, y);
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
        this.darkMatterZones.map(z => z.mesh).filter(Boolean)
    );
    if (intersects.length > 0) {
        window.dispatchEvent(new CustomEvent('hiddenMemoryReveal', {
            detail: { zoneIndex: intersects[0].object.userData.zoneIndex }
        }));
    }
}
```

---

#### W-14: DataLoader 未处理 JSON 解析错误

**文件**: `engine/core/DataLoader.js:20`  
**影响范围**: 如果 memories.json 格式错误，`response.json()` 抛出的错误信息不明确

**问题描述**:
```javascript
const data = await response.json();
```

如果 JSON 格式有误，`response.json()` 会抛出 `SyntaxError`，错误信息为技术性的 JSON 解析错误，对调试不友好。

**修复建议**:
```javascript
let data;
try {
    data = await response.json();
} catch (e) {
    throw new Error(`Failed to parse memories.json: ${e.message}`);
}
```

---

### 🟢 建议 (Suggestion) — 可选改进

---

#### S-01: PerformanceProfiler 运行独立的 RAF 循环

**文件**: `engine/core/PerformanceProfiler.js:15-59`  
**影响范围**: 与渲染器的 RAF 并行运行，产生额外的帧调度开销

**建议**: 将性能采样集成到 `CelestialRenderer.renderFrame()` 中，通过回调或事件上报帧时间，避免独立的 RAF 循环。

---

#### S-02: DarkMatterRenderer 在每次拖动时创建新几何体

**文件**: `engine/renderers/DarkMatterRenderer.js:185-225`  
**影响范围**: 拖动时频繁创建/销毁几何体和材质，产生 GC 压力

**建议**: 预创建固定数量的弧线 Line 对象，在 `_updateEinsteinArcs` 中只更新顶点位置和材质属性，避免反复创建/销毁。

---

#### S-03: 重复定义的 warpPulse 动画

**文件**: `login.html:171-178` 和 `css/custom.css:42-49`  
**影响范围**: 两处定义的 50% 关键帧值不同（80px vs 100px），可能造成混淆

**建议**: 只在 `custom.css` 中保留一处定义，从 `login.html` 的 `<style>` 中移除。

---

#### S-04: EventHorizonRenderer 的 scrollProgress 只能递增

**文件**: `engine/renderers/EventHorizonRenderer.js:296-302`  
**影响范围**: 用户无法回退滚动进度

**说明**: 如果这是设计意图（"一旦越过事件视界就无法回头"），建议添加注释说明。如果非意图，则应允许负方向滚动。

---

#### S-05: app.js 中 chapterNames 仅作为 fallback 使用

**文件**: `js/app.js:15-21, 57`  
**影响范围**: 章节名显示逻辑可能令人困惑

**说明**: `chapterName.textContent = meta.title || chapterNames[chapterIndex]` 优先使用记忆条目的标题（如"潮湿的夏夜"），`chapterNames` 数组（如"序章 · 暗物质"）几乎不会被使用。建议明确是显示记忆标题还是章节名，或同时显示两者。

---

#### S-06: CelestialRenderer 中 _createStarfield 方法在多个渲染器中重复

**文件**: EventHorizonRenderer、DarkMatterRenderer、RedshiftRenderer、RocheLimitRenderer、GravitationalWaveRenderer  
**影响范围**: 代码重复，维护成本高

**建议**: 在 `CelestialRenderer` 基类中提取通用的 `_createStarfield(count, options)` 方法，各子类调用即可。

---

#### S-07: InputAdapter 的触摸事件在桌面端也注册

**文件**: `engine/core/InputAdapter.js:49-53`  
**影响范围**: 虽然有 `isTouch` 检查，但部分混合设备可能同时支持触摸和鼠标，导致双重事件触发

**建议**: 考虑使用 `Pointer Events` API 统一处理触摸和鼠标输入，减少代码复杂度。

---

#### S-08: memories.json 中所有 media 字段为空

**文件**: `data/memories.json` (所有条目)  
**影响范围**: `preloadImages` 始终返回空数组，图片预加载逻辑未被实际使用

**建议**: 如果暂无图片资源，可在 `interactionConfig` 中标注 `"hasMedia": false`，并在 `DataLoader.preloadImages` 中提前返回，避免空循环。

---

## 三、架构合规性检查表

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 渲染器继承 CelestialRenderer | ✅ 通过 | 5 个渲染器均正确继承 |
| 物理参数从 data.physicsParams 读取 | ❌ 失败 | 参数结构不匹配（C-03），参数命名不一致（C-04），实际使用硬编码默认值 |
| 输入通过 InputAdapter 转发 | ⚠️ 部分 | 场景级输入（scroll/drag/tap/pinch）正确通过 InputAdapter；但 app.js 中键盘导航和按钮点击直接监听 DOM（架构上可接受，但需注意一致性） |
| SceneRouter 路由正确 | ✅ 通过 | celestialType 到渲染器的映射正确，使用动态 import 懒加载 |
| WebGL 资源正确释放 | ⚠️ 部分 | disposables 机制完善，但 canvas 复用可能有问题（W-11），部分渲染器缺少 destroy 覆写（W-12） |
| ES Module 导入导出正确 | ✅ 通过 | 所有模块使用正确的 import/export 语法 |
| 着色器与渲染器 uniform 匹配 | ✅ 通过 | 着色器中声明的 uniform 与渲染器代码中设置的 uniform 名称一致 |
| LoadingManager 使用 | ⚠️ 部分 | CelestialRenderer 创建了 LoadingManager 和 TextureLoader，但实际渲染器中未使用纹理加载功能 |
| 错误处理覆盖 | ⚠️ 部分 | App 层有 init().catch()，SceneRouter 有 try/catch，但着色器加载（C-06）和 JSON 解析（W-14）缺少错误处理 |

---

## 四、状态覆盖检查表

### 登录页状态覆盖

| 状态 | 覆盖 | 说明 |
|------|------|------|
| 初始态 | ✅ | 页面加载时 checkInputs() 设置初始 UI |
| 输入态 | ✅ | input 事件实时更新按钮状态 |
| 校验中 | ✅ | 600ms 延迟模拟异步校验，按钮禁用 |
| 成功 | ✅ | 生成 token、虫洞动画、跳转 |
| 失败 | ✅ | 抖动动画、剩余次数提示 |
| 锁定 | ✅ | 倒计时显示，自动解锁 |
| Enter 键提交 | ❌ | 未实现（W-09） |
| 最大输入长度限制 | ❌ | 未设置 maxlength |
| 网络错误处理 | N/A | 纯前端无网络请求 |
| crypto.subtle 不可用 | ❌ | 未处理（HTTPS 环境下才可用） |

### 渲染器状态覆盖

| 状态 | EventHorizon | DarkMatter | Redshift | RocheLimit | GravWave |
|------|:---:|:---:|:---:|:---:|:---:|
| Loading | ✅ | ✅ | ✅ | ✅ | ✅ |
| Empty data | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Error | ❌ | ❌ | ❌ | ❌ | ❌ |
| 正常交互 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 边界值 | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ |

**说明**:
- **Empty data**: 所有渲染器在参数为空时回退到默认值，不会崩溃，但行为不符合预期
- **Error**: 着色器加载失败、WebGL 不支持等情况未在渲染器层处理
- **边界值**:
  - EventHorizonRenderer: scrollProgress 限制在 [0, 1] ✅，但只能递增 ⚠️
  - DarkMatterRenderer: galaxy 拖动无边界限制 ⚠️
  - RocheLimitRenderer: secondary 位置有下限限制 ✅，但无上限 ⚠️

### 错误处理覆盖

| 错误场景 | 覆盖 | 说明 |
|----------|------|------|
| fetch memories.json 失败 | ✅ | DataLoader 抛出错误，App 显示错误信息 |
| JSON 解析失败 | ❌ | 未捕获 SyntaxError（W-14） |
| 着色器加载失败 | ❌ | 未检查 response.ok（C-06） |
| 着色器编译失败 | ⚠️ | Three.js 控制台输出错误，但不会抛出异常 |
| WebGL 不支持 | ❌ | 未检测（C-07） |
| 纹理加载失败 | ⚠️ | loadTexture 有 reject，但实际未使用纹理 |
| canvas 元素不存在 | ✅ | App 构造函数抛出错误 |
| 未知 celestialType | ✅ | SceneRouter 抛出错误 |

---

## 五、改进优先级建议

### P0 — 立即修复（阻断核心功能）

1. **C-01**: 修正密码哈希拼写错误（1 行修改）
2. **C-02**: 修复 auth-guard.js 的 session key 和 guest token 逻辑
3. **C-03 + C-04**: 统一物理参数结构和命名（需要同时修改数据文件和渲染器代码）

### P1 — 尽快修复（安全与质量）

4. **C-06**: 添加着色器加载错误处理
5. **C-07**: 添加 WebGL 支持检测
6. **W-01**: 密码哈希加盐
7. **W-02**: 修复 innerHTML XSS 风险
8. **W-05**: 修复 DarkMatterRenderer 透明度衰减 Bug
9. **C-05**: 修复 GravitationalWaveRenderer 参数引用错误

### P2 — 计划修复（性能与一致性）

10. **W-03 + W-04**: 清理事件监听器和 RAF
11. **W-06**: 限制 CSS transition 作用范围
12. **W-07**: 修复 RocheLimitRenderer 锁定状态距离更新
13. **W-08**: 实现 massRatio 的实际效果或移除
14. **W-09**: 添加 Enter 键提交
15. **W-12**: 补充 destroy() 覆写
16. **W-13**: 实现隐藏记忆揭示机制或移除隐藏记忆

### P3 — 优化改进

17. **S-01 ~ S-08**: 各项建议性改进

---

## 六、亮点

1. **架构设计优秀**: SceneRouter + InputAdapter + CelestialRenderer 的三层抽象清晰，职责分离到位，渲染器注册表使用动态 import 实现懒加载
2. **资源管理机制完善**: `disposables` 数组 + `eventBindings` 数组 + 基类 `destroy()` 的完整清理流程，体现了对 WebGL 资源管理的重视
3. **性能自适应**: PerformanceProfiler 根据帧率自动调整画质（high/medium/low），渲染器通过 `onQualityChange` 响应
4. **着色器代码质量高**: common.glsl 中的噪声函数、色温转换、多普勒位移等工具函数实现正确，引力透镜着色器的爱因斯坦环效果具有物理依据
5. **输入处理周到**: InputAdapter 同时支持鼠标和触摸，pinch 手势、drag 阈值判断、tap 与 drag 区分等细节处理到位
6. **登录安全机制**: 虽然实现有 bug，但设计了失败次数限制、锁定机制、会话超时等安全功能框架
7. **叙事与物理融合**: 每个天体物理概念（暗物质、红移、事件视界、洛希极限、引力波）都与回忆录叙事紧密结合，概念选择和隐喻运用出色

---

*审查结束*
