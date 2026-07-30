const CREDENTIALS = {
    username: 'mjsx',
    passwordHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
};

const CONFIG = {
    maxAttempts: 5,
    lockDuration: 60000,
    sessionTimeout: 3600000
};

const TOKEN_KEY = 'cm_token';
const LOGIN_TIME_KEY = 'cm_loginTime';
const FAILED_KEY = 'cm_failedAttempts';
const LOCK_KEY = 'cm_lockUntil';

const usernameEl = document.getElementById('username');
const passwordEl = document.getElementById('password');
const btnEl = document.getElementById('login-btn');
const hintEl = document.getElementById('login-hint');
const portalEl = document.getElementById('loginPortal');
const starfieldCanvas = document.getElementById('starfield');
const wormholeCanvas = document.getElementById('wormhole-overlay');

let failedAttempts = parseInt(localStorage.getItem(FAILED_KEY) || '0', 10);
let lockUntil = parseInt(localStorage.getItem(LOCK_KEY) || '0', 10);
let isLocked = Date.now() < lockUntil;
let lockTimer = null;

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateToken() {
    const payload = Date.now().toString() + Math.random().toString() + navigator.userAgent;
    return await sha256(payload);
}

function checkInputs() {
    if (isLocked) return;
    const hasUser = usernameEl.value.trim().length > 0;
    const hasPass = passwordEl.value.trim().length > 0;
    if (hasUser && hasPass) {
        btnEl.disabled = false;
        btnEl.classList.add('active');
        btnEl.textContent = '穿越事件视界';
        hintEl.textContent = '准备就绪。按下以进入虫洞。';
        hintEl.className = '';
    } else {
        btnEl.disabled = true;
        btnEl.classList.remove('active');
        btnEl.textContent = '事件视界尚未形成';
        hintEl.textContent = '输入凭证以坍缩波函数';
        hintEl.className = '';
    }
}

function updateLockState() {
    if (Date.now() < lockUntil) {
        isLocked = true;
        btnEl.disabled = true;
        btnEl.classList.remove('active');
        btnEl.textContent = '时空已锁定';
        hintEl.classList.add('error');
        hintEl.classList.remove('success');
        const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
        hintEl.textContent = `时空折叠紊乱。请等待 ${remaining}s 后重试。`;
        if (lockTimer) clearTimeout(lockTimer);
        lockTimer = setTimeout(updateLockState, 1000);
    } else {
        isLocked = false;
        if (lockTimer) {
            clearTimeout(lockTimer);
            lockTimer = null;
        }
        localStorage.removeItem(LOCK_KEY);
        failedAttempts = 0;
        localStorage.setItem(FAILED_KEY, '0');
        checkInputs();
    }
}

class Starfield {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.numStars = 400;
        this.animationId = null;
        this.resize();
        this.init();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        this.stars = [];
        for (let i = 0; i < this.numStars; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 1.5 + 0.3,
                opacity: Math.random() * 0.8 + 0.2,
                twinkleSpeed: Math.random() * 0.02 + 0.005,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    animate() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const time = Date.now() * 0.001;
        for (const star of this.stars) {
            const twinkle = Math.sin(time * star.twinkleSpeed * 50 + star.phase) * 0.5 + 0.5;
            const alpha = star.opacity * twinkle;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
            ctx.fill();
        }
        this.animationId = requestAnimationFrame(() => this.animate());
    }
}

class WormholeAnimation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 800;
        this.progress = 0;
        this.phase = 'forming';
        this.animationId = null;
        this.resize();
        this.init();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        this.particles = [];
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        for (let i = 0; i < this.numParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * Math.max(cx, cy) * 1.5;
            this.particles.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius,
                vx: 0,
                vy: 0,
                z: Math.random() * 1000 + 200,
                size: Math.random() * 2 + 0.5,
                hue: Math.random() * 60 + 200,
                angle: angle,
                radius: radius,
                speed: Math.random() * 0.5 + 0.5,
                prevX: 0,
                prevY: 0
            });
        }
    }

    start() {
        this.canvas.classList.add('active');
        this.progress = 0;
        this.phase = 'forming';
        this.animate();
    }

    animate() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.fillStyle = 'rgba(0, 0, 17, 0.15)';
        ctx.fillRect(0, 0, w, h);

        if (this.phase === 'forming') {
            this.progress += 0.008;
            if (this.progress >= 1) {
                this.progress = 0;
                this.phase = 'traveling';
            }
        } else if (this.phase === 'traveling') {
            this.progress += 0.012;
            if (this.progress >= 1) {
                this.progress = 1;
                this.phase = 'exit';
                setTimeout(() => {
                    window.location.replace('./universe.html');
                }, 500);
            }
        }

        const pullStrength = this.phase === 'traveling' ? 0.05 + this.progress * 0.15 : 0.03 + this.progress * 0.08;
        const rotSpeed = this.phase === 'traveling' ? 0.02 + this.progress * 0.08 : 0.005 + this.progress * 0.03;
        const zSpeed = this.phase === 'traveling' ? 15 + this.progress * 40 : 5 + this.progress * 20;

        for (const p of this.particles) {
            p.prevX = p.x;
            p.prevY = p.y;

            p.angle += rotSpeed;
            p.radius *= (1 - pullStrength);

            const targetX = cx + Math.cos(p.angle) * p.radius;
            const targetY = cy + Math.sin(p.angle) * p.radius;
            p.x += (targetX - p.x) * 0.3;
            p.y += (targetY - p.y) * 0.3;

            p.z -= zSpeed * p.speed;

            if (p.z <= 0 || p.radius < 5) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * Math.max(cx, cy) * 1.5;
                p.x = cx + Math.cos(angle) * radius;
                p.y = cy + Math.sin(angle) * radius;
                p.prevX = p.x;
                p.prevY = p.y;
                p.z = Math.random() * 1000 + 800;
                p.angle = angle;
                p.radius = radius;
            }

            const perspective = 400 / (400 + p.z);
            const px = cx + (p.x - cx) * perspective;
            const py = cy + (p.y - cy) * perspective;
            const pSize = p.size * perspective;
            const pPrevX = cx + (p.prevX - cx) * perspective;
            const pPrevY = cy + (p.prevY - cy) * perspective;

            const distance = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
            const maxDist = Math.sqrt(cx ** 2 + cy ** 2);
            const distRatio = distance / maxDist;

            let hue;
            if (this.phase === 'traveling') {
                if (p.z < 300) {
                    hue = 200 + (1 - p.z / 300) * 40;
                } else {
                    hue = 350 + distRatio * 30;
                }
            } else {
                hue = p.hue + this.progress * 40;
            }

            const lightness = 50 + perspective * 30;
            const alpha = Math.min(1, perspective * 1.2);

            ctx.strokeStyle = `hsla(${hue}, 80%, ${lightness}%, ${alpha})`;
            ctx.lineWidth = pSize;
            ctx.beginPath();
            ctx.moveTo(pPrevX, pPrevY);
            ctx.lineTo(px, py);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(px, py, pSize, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 80%, ${lightness + 20}%, ${alpha})`;
            ctx.fill();
        }

        if (this.phase === 'traveling' || this.phase === 'exit') {
            const ringRadius = Math.min(w, h) * (0.15 + this.progress * 0.3);
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringRadius);
            gradient.addColorStop(0, `rgba(200, 230, 255, ${0.3 + this.progress * 0.4})`);
            gradient.addColorStop(0.5, `rgba(100, 180, 255, ${0.15 + this.progress * 0.2})`);
            gradient.addColorStop(1, 'rgba(0, 0, 17, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }
}

const starfield = new Starfield(starfieldCanvas);
const wormhole = new WormholeAnimation(wormholeCanvas);

usernameEl.addEventListener('input', checkInputs);
passwordEl.addEventListener('input', checkInputs);

btnEl.addEventListener('click', async function () {
    if (btnEl.disabled || isLocked) return;

    btnEl.disabled = true;
    btnEl.classList.remove('active');
    hintEl.textContent = '正在校验时空坐标...';
    hintEl.className = '';

    await new Promise(r => setTimeout(r, 600));

    const inputUser = usernameEl.value.trim();
    const inputPass = passwordEl.value.trim();

    if (inputUser !== CREDENTIALS.username) {
        handleFailure();
        return;
    }

    const inputHash = await sha256(inputPass);

    if (inputHash === CREDENTIALS.passwordHash) {
        handleSuccess();
    } else {
        handleFailure();
    }
});

function handleFailure() {
    failedAttempts++;
    localStorage.setItem(FAILED_KEY, failedAttempts.toString());

    if (failedAttempts >= CONFIG.maxAttempts) {
        lockUntil = Date.now() + CONFIG.lockDuration;
        localStorage.setItem(LOCK_KEY, lockUntil.toString());
        updateLockState();
        return;
    }

    const remaining = CONFIG.maxAttempts - failedAttempts;

    portalEl.style.animation = 'none';
    void portalEl.offsetWidth;
    portalEl.style.animation = 'shake 0.4s ease';

    btnEl.disabled = true;
    btnEl.classList.remove('active');
    btnEl.textContent = '事件视界尚未形成';

    passwordEl.value = '';

    hintEl.textContent = `引力参数不匹配。还剩 ${remaining} 次尝试。`;
    hintEl.classList.add('error');
    hintEl.classList.remove('success');
}

async function handleSuccess() {
    const token = await generateToken();
    const loginTime = Date.now();

    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(LOGIN_TIME_KEY, loginTime.toString());

    localStorage.removeItem(FAILED_KEY);
    localStorage.removeItem(LOCK_KEY);

    hintEl.textContent = '验证通过。正在生成爱因斯坦-罗森桥...';
    hintEl.classList.add('success');
    hintEl.classList.remove('error');

    btnEl.disabled = true;
    btnEl.classList.remove('active');

    portalEl.classList.add('warping');

    setTimeout(() => {
        portalEl.classList.add('exiting');
    }, 400);

    setTimeout(() => {
        wormhole.start();
    }, 800);
}

if (isLocked) {
    updateLockState();
} else {
    checkInputs();
}
