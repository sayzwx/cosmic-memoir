import { CosmicMemoirApp } from '../engine/App.js';

const app = new CosmicMemoirApp('main-canvas');
const byId = id => document.getElementById(id);
const loadingScreen = byId('loading-screen');
const chapterLabel = byId('chapter-label');
const chapterName = byId('chapter-name');
const narrativePrimary = byId('narrative-primary');
const narrativeSecondary = byId('narrative-secondary');
const physicsHud = byId('physics-hud');
const progressDots = byId('progress-dots');
const prevBtn = byId('prev-btn');
const nextBtn = byId('next-btn');
const canvas = byId('main-canvas');
const m8 = byId('m8-experience');
const m8Index = byId('m8-entity-index');
const m8Title = byId('m8-entity-title');
const m8Body = byId('m8-entity-body');
const m8Status = byId('m8-status');
const m8Progress = byId('m8-progress');
const m8Hint = byId('m8-scan-hint');
const m8List = byId('m8-entity-list');
const m8Return = byId('m8-return-overview');

let activeMemory = null;
let focusedEntityId = null;
let visitedEntityIds = new Set();

const chapterNames = [
  '序章 · 暗物质',
  '第一章 · 红移',
  '第二章 · 事件视界',
  '第三章 · 洛希极限',
  '终章 · 引力波'
];

function hideLoadingScreen() {
  if (!loadingScreen) return;
  loadingScreen.classList.add('hidden');
  setTimeout(() => loadingScreen.parentNode?.removeChild(loadingScreen), 800);
}

function showLoadingError(message) {
  if (!loadingScreen) return;
  loadingScreen.replaceChildren();
  const container = document.createElement('div');
  container.className = 'text-center px-8';
  const title = document.createElement('p');
  title.className = 'font-heading text-red-400 text-lg mb-3';
  title.textContent = '星际旅行中断';
  const detail = document.createElement('p');
  detail.className = 'font-mono text-gray-500 text-xs break-all';
  detail.textContent = String(message);
  container.append(title, detail);
  loadingScreen.appendChild(container);
  loadingScreen.classList.remove('hidden');
}

function getM8Entities() {
  if (!activeMemory) return [];
  const photos = activeMemory.media?.photos || [];
  const byEntityId = new Map(photos.map(entity => [entity.id, entity]));
  return activeMemory.experience.entityOrder.map(id => byEntityId.get(id)).filter(Boolean);
}

function renderM8Progress() {
  if (!m8Progress) return;
  m8Progress.replaceChildren(...getM8Entities().map(entity => {
    const dot = document.createElement('span');
    dot.className = 'm8-spatial__dot';
    dot.classList.toggle('is-visited', visitedEntityIds.has(entity.id));
    dot.classList.toggle('is-focused', focusedEntityId === entity.id);
    return dot;
  }));
}

function renderM8Focus() {
  const entities = getM8Entities();
  const entity = entities.find(item => item.id === focusedEntityId) || null;
  const current = entity ? entities.indexOf(entity) + 1 : 0;
  if (m8Index) m8Index.textContent = `M8 · ${current} / ${entities.length}`;
  if (m8Title) m8Title.textContent = entity?.title || '深空记忆';
  if (m8Body) m8Body.textContent = entity?.body || '移动视角，在不可见的质量中寻找记忆。';
  if (m8Hint) m8Hint.textContent = entity && !visitedEntityIds.has(entity.id)
    ? 'SPACE · 扫描记忆'
    : '移动视角 · 寻找下一段记忆';
  if (m8Hint) m8Hint.disabled = !entity || visitedEntityIds.has(entity.id);
  m8?.style.setProperty('--m8-accent', entity?.accent || '#b9a7df');
  renderM8Progress();
}

function resetM8(memory) {
  activeMemory = memory;
  focusedEntityId = null;
  visitedEntityIds = new Set();
  const entities = getM8Entities();
  if (m8List) {
    m8List.replaceChildren(...entities.map(entity => {
      const item = document.createElement('li');
      item.dataset.entityId = entity.id;
      item.textContent = `${entity.title}：${entity.body}。${entity.alt}`;
      return item;
    }));
  }
  if (m8Status) m8Status.textContent = '移动视角，将记忆置于准星中央。';
  renderM8Focus();
}

function setM8Active(memory) {
  const isM8 = memory?.experience?.id === 'M8' &&
    memory.experience.variant === 'deepSpaceSpatialMemory' && memory.experience.version === 2;
  document.body.classList.toggle('m8-active', isM8);
  m8?.classList.toggle('is-active', isM8);
  m8?.setAttribute('aria-hidden', String(!isM8));
  if (m8) m8.inert = !isM8;
  if (isM8) resetM8(memory);
  else activeMemory = null;
}

function updateProgressDots() {
  if (!progressDots) return;
  progressDots.replaceChildren(...(app.currentMemories || []).map((_, index) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot' + (index === (app.currentMemoryIndex || 0) ? ' active' : '');
    return dot;
  }));
}

function updateUI(memoryData) {
  if (!memoryData) return;
  const meta = memoryData.meta || {};
  const chapterIndex = meta.chapterIndex ?? 0;
  if (chapterLabel) chapterLabel.textContent = `CHAPTER ${String(chapterIndex + 1).padStart(2, '0')}`;
  if (chapterName) chapterName.textContent = meta.title || chapterNames[chapterIndex] || '';

  if (narrativePrimary) {
    narrativePrimary.classList.remove('visible');
    setTimeout(() => {
      narrativePrimary.textContent = [memoryData.narrative?.prologueText, memoryData.narrative?.bodyText]
        .filter(Boolean).join('\n\n');
      requestAnimationFrame(() => narrativePrimary.classList.add('visible'));
    }, 300);
  }
  if (narrativeSecondary) {
    narrativeSecondary.classList.remove('visible');
    setTimeout(() => {
      narrativeSecondary.textContent = [memoryData.narrative?.epilogueText, memoryData.narrative?.quote]
        .filter(Boolean).join(' · ');
      if (narrativeSecondary.textContent) narrativeSecondary.classList.add('visible');
    }, 600);
  }
  if (physicsHud && memoryData.physicsParams) {
    physicsHud.replaceChildren();
    const typeLabel = document.createElement('div');
    typeLabel.className = 'hud-line visible font-heading text-purple-300 text-sm mb-2';
    typeLabel.textContent = memoryData.celestialType || '';
    physicsHud.appendChild(typeLabel);
    Object.entries(memoryData.physicsParams).forEach(([key, value], index) => {
      const line = document.createElement('div');
      line.className = 'hud-line';
      const displayValue = typeof value === 'number'
        ? (Math.abs(value) < .01 || Math.abs(value) > 1000 ? value.toExponential(2) : value.toFixed(3))
        : String(value);
      line.textContent = `${key}: ${displayValue}`;
      physicsHud.appendChild(line);
      setTimeout(() => line.classList.add('visible'), 800 + index * 100);
    });
  }
  updateProgressDots();
  setM8Active(memoryData);
  if (memoryData.celestialType === 'darkMatter') app.router.currentScene?.announceState?.();
}

function matchesActiveMemory(detail) {
  return activeMemory && (!detail?.memoryId || detail.memoryId === activeMemory.id);
}

window.addEventListener('sceneMounted', event => {
  hideLoadingScreen();
  updateUI(event.detail?.memoryData);
});

window.addEventListener('sceneError', event => {
  const error = event.detail?.error;
  console.error('Scene error:', error);
  showLoadingError(error?.message || '未知错误');
});

window.addEventListener('sceneTelemetry', event => {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  const status = detail.status ?? detail.values?.status;
  if (typeof status === 'string' && m8Status && m8Status.textContent !== status) m8Status.textContent = status;
  const progress = Number(detail.explorationProgress ?? detail.progress);
  if (Number.isFinite(progress) && m8Status && !status) {
    const nextStatus = `空间扫描 ${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
    if (m8Status.textContent !== nextStatus) m8Status.textContent = nextStatus;
  }
});

window.addEventListener('spatialMemoryFocus', event => {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  const entityId = detail.entityId ?? null;
  focusedEntityId = getM8Entities().some(entity => entity.id === entityId) ? entityId : null;
  if (m8Status) {
    m8Status.textContent = detail.locked
      ? (detail.status || '这段记忆尚未显形。')
      : (detail.status || (focusedEntityId ? '已对准。按 Space 扫描。' : '继续移动视角寻找记忆。'));
  }
  renderM8Focus();
});

window.addEventListener('spatialMemoryVisited', event => {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  const ids = Array.isArray(detail.visitedIds) ? detail.visitedIds : [detail.entityId].filter(Boolean);
  const knownIds = new Set(getM8Entities().map(entity => entity.id));
  ids.forEach(id => { if (knownIds.has(id)) visitedEntityIds.add(id); });
  if (m8Status) m8Status.textContent = detail.status || `已发现 ${visitedEntityIds.size} / ${knownIds.size} 段记忆。`;
  renderM8Focus();
});

window.addEventListener('darkMatterMilestone', event => {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  const name = detail.name || detail.milestone;
  const messages = {
    'first-focus': '第一段记忆进入引力焦点。',
    'lens-reflection': '引力透镜显出一束重合的光。',
    convergence: '散落的光路正在汇聚。',
    complete: '五段记忆已在同一片时空中显形。'
  };
  if (m8Status) m8Status.textContent = detail.status || messages[name] || '暗物质读数发生变化。';
});

window.addEventListener('hiddenMemoryUnlocked', async event => {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  const hidden = await app.data.getHiddenMemory(activeMemory);
  if (!hidden || !activeMemory) return;
  if (m8Title) m8Title.textContent = hidden.meta?.title || '隐藏记忆';
  if (m8Body) m8Body.textContent = hidden.narrative?.bodyText || hidden.narrative?.epilogueText || '';
  if (m8Status) m8Status.textContent = '不可见的质量已经留下了可以阅读的证据。';
});

m8Hint?.addEventListener('click', () => {
  if (!activeMemory || !focusedEntityId || visitedEntityIds.has(focusedEntityId)) return;
  window.dispatchEvent(new CustomEvent('spatialMemoryScanRequested', {
    detail: { memoryId: activeMemory.id, entityId: focusedEntityId }
  }));
  if (m8Status) m8Status.textContent = '正在扫描焦点中的记忆…';
});

m8Return?.addEventListener('click', () => {
  const request = new CustomEvent('spatialMemoryReturnOverview', {
    cancelable: true,
    detail: { memoryId: activeMemory?.id || null }
  });
  if (window.dispatchEvent(request)) window.location.assign('./index.html');
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
  if (nextBtn) nextBtn.disabled = true;
});

nextBtn?.addEventListener('click', () => app.nextMemory());
prevBtn?.addEventListener('click', () => app.prevMemory());

document.addEventListener('keydown', event => {
  const target = event.target;
  const isInteractive = target instanceof HTMLElement &&
    (target.matches('button, a, input, textarea, select') || target.isContentEditable);
  if (activeMemory && target === canvas && app.router.currentScene?.onKeyDown?.(event.key)) {
    event.preventDefault();
    return;
  }
  if (isInteractive) return;
  if (event.key === ' ' && activeMemory) {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('spatialMemoryScanRequested', {
      detail: { memoryId: activeMemory.id, entityId: focusedEntityId }
    }));
    if (m8Status) m8Status.textContent = focusedEntityId ? '正在扫描焦点中的记忆…' : '准星内没有可扫描的记忆。';
  } else if (event.key === ' ') {
    event.preventDefault();
    app.nextMemory();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    app.nextMemory();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    app.prevMemory();
  } else if (event.key === 'Escape' && activeMemory) {
    canvas?.focus({ preventScroll: true });
  }
});

app.init().catch(error => {
  console.error('App initialization failed:', error);
  showLoadingError(error.message || '初始化失败');
});

window.addEventListener('beforeunload', () => app.destroy());
window.__cosmicMemoirApp = app;
