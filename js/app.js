import { CosmicMemoirApp } from '../engine/App.js';

const app = new CosmicMemoirApp('main-canvas');

const loadingScreen = document.getElementById('loading-screen');
const chapterLabel = document.getElementById('chapter-label');
const chapterName = document.getElementById('chapter-name');
const narrativePrimary = document.getElementById('narrative-primary');
const narrativeSecondary = document.getElementById('narrative-secondary');
const physicsHud = document.getElementById('physics-hud');
const progressDots = document.getElementById('progress-dots');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

const chapterNames = [
  '序章 · 暗物质',
  '第一章 · 红移',
  '第二章 · 事件视界',
  '第三章 · 洛希极限',
  '终章 · 引力波'
];

function hideLoadingScreen() {
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      if (loadingScreen.parentNode) {
        loadingScreen.parentNode.removeChild(loadingScreen);
      }
    }, 800);
  }
}

function showLoadingError(message) {
  if (loadingScreen) {
    loadingScreen.innerHTML = `
      <div class="text-center px-8">
        <p class="font-heading text-red-400 text-lg mb-3">星际旅行中断</p>
        <p class="font-mono text-gray-500 text-xs break-all">${message}</p>
      </div>
    `;
    loadingScreen.classList.remove('hidden');
  }
}

function updateUI(memoryData) {
  if (!memoryData) return;

  const meta = memoryData.meta || {};
  const chapterIndex = meta.chapterIndex ?? 0;

  if (chapterLabel) {
    chapterLabel.textContent = `CHAPTER ${String(chapterIndex + 1).padStart(2, '0')}`;
  }

  if (chapterName) {
    chapterName.textContent = meta.title || chapterNames[chapterIndex] || '';
  }

  if (narrativePrimary) {
    narrativePrimary.classList.remove('visible');
    setTimeout(() => {
      narrativePrimary.textContent = memoryData.narrative?.primary || '';
      requestAnimationFrame(() => {
        narrativePrimary.classList.add('visible');
      });
    }, 300);
  }

  if (narrativeSecondary) {
    narrativeSecondary.classList.remove('visible');
    setTimeout(() => {
      narrativeSecondary.textContent = memoryData.narrative?.secondary || '';
      if (memoryData.narrative?.secondary) {
        narrativeSecondary.classList.add('visible');
      }
    }, 600);
  }

  if (physicsHud && memoryData.physicsParams) {
    physicsHud.innerHTML = '';
    const typeLabel = document.createElement('div');
    typeLabel.className = 'hud-line visible font-heading text-purple-300 text-sm mb-2';
    typeLabel.textContent = memoryData.celestialType || '';
    physicsHud.appendChild(typeLabel);

    Object.entries(memoryData.physicsParams).forEach(([key, value], index) => {
      const line = document.createElement('div');
      line.className = 'hud-line';
      const displayValue = typeof value === 'number'
        ? (Math.abs(value) < 0.01 || Math.abs(value) > 1000
          ? value.toExponential(2)
          : value.toFixed(3))
        : String(value);
      line.textContent = `${key}: ${displayValue}`;
      physicsHud.appendChild(line);

      setTimeout(() => line.classList.add('visible'), 800 + index * 100);
    });
  }

  updateProgressDots();
}

function updateProgressDots() {
  if (!progressDots) return;

  const memories = app.currentMemories || [];
  const currentIndex = app.currentMemoryIndex || 0;

  progressDots.innerHTML = '';
  memories.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot' + (i === currentIndex ? ' active' : '');
    progressDots.appendChild(dot);
  });
}

window.addEventListener('sceneMounted', (e) => {
  hideLoadingScreen();
  updateUI(e.detail.memoryData);
});

window.addEventListener('sceneError', (e) => {
  const error = e.detail?.error;
  const message = error?.message || '未知错误';
  console.error('Scene error:', error);
  showLoadingError(message);
});

window.addEventListener('memoirComplete', () => {
  if (narrativePrimary) {
    narrativePrimary.textContent = '回忆录已抵达宇宙的尽头。';
    narrativePrimary.classList.add('visible');
  }
  if (narrativeSecondary) {
    narrativeSecondary.textContent = '感谢您穿越这段时空。';
    narrativeSecondary.classList.add('visible');
  }
  if (nextBtn) {
    nextBtn.disabled = true;
  }
});

if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    app.nextMemory();
  });
}

if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    app.prevMemory();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    app.nextMemory();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    app.prevMemory();
  }
});

app.init().catch((err) => {
  console.error('App initialization failed:', err);
  showLoadingError(err.message || '初始化失败');
});

window.addEventListener('beforeunload', () => {
  app.destroy();
});

window.__cosmicMemoirApp = app;
