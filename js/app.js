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
const m8Action = byId('m8-anchor-action');
const m8List = byId('m8-entity-list');
const m8Return = byId('m8-return-overview');

let activeMemory = null;
let focusedEntityId = null;
let visitedEntityIds = new Set();
let carrierStates = new Map();
let m8CaptionTimer = null;
let completedMemory = null;

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));

function setM8Status(text) {
  if (!m8Status || typeof text !== 'string' || !text.trim() || m8Status.textContent === text) return;
  m8Status.textContent = text;
}

function setCaptionFocus(focused) {
  m8?.classList.toggle('has-focus', Boolean(focused));
  clearTimeout(m8CaptionTimer);
  if (focused) m8CaptionTimer = setTimeout(() => m8?.classList.remove('has-focus'), 5000);
}

function mergeCarrierState(entityId, update = {}) {
  if (!entityId) return;
  const previous = carrierStates.get(entityId) || {};
  const state = String(update.state || previous.state || '').toUpperCase();
  const discoveryProgress = clamp01(update.discoveryProgress ?? update.progress ?? previous.discoveryProgress);
  const locked = update.locked ?? (update.state !== undefined ? state === 'LOCKED' : previous.locked);
  const revealed = Boolean(update.revealed ?? previous.revealed) || ['REVEALED', 'CAPTURED'].includes(state);
  const canCapture = state === 'CAPTURED' ? false : Boolean(update.canCapture ??
    (update.state !== undefined ? revealed : (previous.canCapture ?? revealed)));
  carrierStates.set(entityId, {
    ...previous, ...update, state, discoveryProgress, locked, canScan: false, canCapture
  });
}

function mergeCarrierSnapshots(carriers) {
  if (Array.isArray(carriers)) {
    carriers.forEach(item => mergeCarrierState(item?.entityId || item?.carrierId || item?.id, item));
  } else if (carriers && typeof carriers === 'object') {
    Object.entries(carriers).forEach(([id, item]) => {
      mergeCarrierState(id, typeof item === 'string' ? { state: item } : item);
    });
  }
}

function markCarriersAvailable(ids) {
  if (!Array.isArray(ids)) return;
  const knownIds = new Set(getM8Entities().map(entity => entity.id));
  ids.forEach(id => {
    if (!knownIds.has(id)) return;
    const carrier = carrierStates.get(id) || {};
    if (!visitedEntityIds.has(id) && !['REVEALED', 'CAPTURED'].includes(carrier.state)) {
      mergeCarrierState(id, { state: 'AVAILABLE', locked: false });
    }
  });
}

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
  const photos = activeMemory.media?.crystalNodes ?? activeMemory.media?.photos ?? [];
  const byEntityId = new Map(photos.map(entity => [entity.id, entity]));
  return activeMemory.experience.entityOrder.map(id => byEntityId.get(id)).filter(Boolean);
}

function renderM8Progress() {
  if (!m8Progress) return;
  m8Progress.replaceChildren(...getM8Entities().map(entity => {
    const dot = document.createElement('span');
    dot.className = 'm8-spatial__dot';
    const carrier = carrierStates.get(entity.id) || {};
    const state = String(carrier.state || (visitedEntityIds.has(entity.id) ? 'CAPTURED' : 'LOCKED')).toLowerCase();
    ['locked', 'available', 'targeted', 'discovering', 'revealed', 'captured'].forEach(name => dot.classList.toggle(`is-${name}`, state === name));
    dot.classList.toggle('is-visited', visitedEntityIds.has(entity.id));
    dot.classList.toggle('is-focused', focusedEntityId === entity.id);
    return dot;
  }));
}

function renderM8Focus() {
  const entities = getM8Entities();
  const entity = entities.find(item => item.id === focusedEntityId) || null;
  if (m8Index) m8Index.textContent = `晶体 ${visitedEntityIds.size} / ${entities.length}`;
  if (m8Title) m8Title.textContent = completedMemory?.title || entity?.title || '暗物质宇宙网';
  if (m8Body) m8Body.textContent = completedMemory?.body || entity?.unfoldText || entity?.body || '移动视角，在不可见的质量中寻找记忆。';
  const carrier = entity ? carrierStates.get(entity.id) || {} : {};
  const state = String(carrier.state || '').toUpperCase();
  const visited = Boolean(entity && visitedEntityIds.has(entity.id));
  const revealed = Boolean(carrier.revealed) || ['REVEALED', 'CAPTURED'].includes(state);
  const canCapture = Boolean(entity && !visited && carrier.locked !== true && (carrier.canCapture ?? revealed));
  if (m8Action) {
    m8Action.disabled = !canCapture;
    m8Action.dataset.action = canCapture ? 'activate' : '';
    m8Action.textContent = canCapture ? '锚定记忆' : '选择一枚晶体';
    m8Action.setAttribute('aria-label', canCapture ? `锚定记忆：${entity.title}` : '选择一枚可锚定的记忆晶体');
  }
  const progress = clamp01(carrier.discoveryProgress);
  const aimed = Boolean(carrier.aimed ?? (entity && !carrier.locked));
  m8?.style.setProperty('--m8-accent', carrier.energyColor || entity?.energyColor || carrier.accent || entity?.accent || '#86bfe5');
  m8?.style.setProperty('--m8-discovery', String(progress));
  m8?.classList.toggle('is-aimed', aimed && Boolean(entity));
  m8?.classList.toggle('is-revealed', revealed);
  m8?.classList.toggle('can-capture', canCapture);
  renderM8Progress();
}

function resetM8(memory) {
  activeMemory = memory;
  completedMemory = null;
  focusedEntityId = null;
  visitedEntityIds = new Set();
  carrierStates = new Map();
  const entities = getM8Entities();
  if (m8List) {
    m8List.replaceChildren(...entities.map(entity => {
      const item = document.createElement('li');
      item.dataset.entityId = entity.id;
      item.textContent = `${entity.title}：${entity.body}。${entity.alt}`;
      return item;
    }));
  }
  entities.forEach(entity => mergeCarrierState(entity.id, {
    state: 'AVAILABLE',
    locked: false,
    crystalType: entity.crystalType,
    accent: entity.energyColor || entity.accent
  }));
  setM8Status('移动视角，将记忆置于准星中央。');
  renderM8Focus();
}

function setM8Active(memory) {
  const isM8 = memory?.experience?.id === 'M8' &&
    memory.experience.variant === 'darkMatterCosmicWeb' && memory.experience.version === 3;
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
    const physicsEntries = Object.entries(memoryData.physicsParams).flatMap(([group, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [[group, value]];
      return Object.entries(value).map(([key, nestedValue]) => [key, nestedValue]);
    });
    physicsEntries.forEach(([key, value], index) => {
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

function consumeM8Telemetry(event) {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  const status = detail.status ?? detail.values?.status;
  const suppliedCarriers = detail.carriers ?? detail.carrierStates ?? detail.values?.carriers ?? detail.values?.carrierStates;
  mergeCarrierSnapshots(suppliedCarriers);
  markCarriersAvailable(detail.unlockedIds ?? detail.values?.unlockedIds);
  const telemetryEntityId = detail.entityId || detail.carrierId || detail.focusedEntityId;
  if (telemetryEntityId) mergeCarrierState(telemetryEntityId, { ...detail.values, ...detail });
  else if (focusedEntityId && ['state', 'interaction', 'discoveryProgress', 'canScan', 'canCapture', 'prompt', 'accent', 'aimed', 'revealed']
    .some(key => detail[key] !== undefined)) mergeCarrierState(focusedEntityId, detail);
  if (typeof status === 'string') setM8Status(status);
  const progress = Number(detail.explorationProgress ?? detail.progress);
  if (Number.isFinite(progress) && m8Status && !status) {
    const nextStatus = `空间扫描 ${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
    setM8Status(nextStatus);
  }
  renderM8Focus();
}

window.addEventListener('sceneTelemetry', consumeM8Telemetry);
window.addEventListener('darkMatterTelemetry', consumeM8Telemetry);

window.addEventListener('darkMatterReady', event => {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  mergeCarrierSnapshots(detail.carriers ?? detail.carrierStates ?? detail.values?.carriers);
  markCarriersAvailable(detail.unlockedIds);
  renderM8Focus();
});

window.addEventListener('spatialMemoryFocus', event => {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  const carrierDetail = detail.carrier && typeof detail.carrier === 'object' ? detail.carrier : {};
  const entityId = detail.entityId ?? detail.carrierId ?? carrierDetail.id ?? null;
  focusedEntityId = getM8Entities().some(entity => entity.id === entityId) ? entityId : null;
  if (focusedEntityId) {
    const inferredState = detail.state || carrierDetail.state || (detail.visited
      ? 'CAPTURED'
      : (detail.locked ? 'LOCKED' : 'TARGETED'));
    mergeCarrierState(focusedEntityId, { ...carrierDetail, ...detail, state: inferredState });
  }
  setM8Status(detail.locked
    ? (detail.status || '这段记忆尚未显形。')
    : (detail.status || detail.prompt || (focusedEntityId ? '已对准。按 Space 扫描。' : '继续移动视角寻找记忆。')));
  setCaptionFocus(focusedEntityId);
  renderM8Focus();
});

window.addEventListener('spatialMemoryVisited', event => {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  const ids = Array.isArray(detail.visitedIds) ? detail.visitedIds : [detail.entityId].filter(Boolean);
  const knownIds = new Set(getM8Entities().map(entity => entity.id));
  ids.forEach(id => { if (knownIds.has(id)) visitedEntityIds.add(id); });
  ids.forEach(id => mergeCarrierState(id, { state: 'CAPTURED', discoveryProgress: 1, canCapture: false }));
  markCarriersAvailable(detail.unlockedIds);
  setM8Status(detail.status || `已发现 ${visitedEntityIds.size} / ${knownIds.size} 段记忆。`);
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
  setM8Status(detail.status || messages[name] || '暗物质读数发生变化。');
});

window.addEventListener('hiddenMemoryUnlocked', async event => {
  const detail = event.detail || {};
  if (!matchesActiveMemory(detail)) return;
  const hidden = await app.data.getHiddenMemory(activeMemory);
  if (!hidden || !activeMemory) return;
  completedMemory = {
    title: hidden.meta?.title || '隐藏记忆',
    body: hidden.narrative?.bodyText || hidden.narrative?.epilogueText || ''
  };
  setM8Status('不可见的质量已经留下了可以阅读的证据。');
  setCaptionFocus(true);
  renderM8Focus();
});

function requestM8ButtonAction() {
  if (!activeMemory || !focusedEntityId || visitedEntityIds.has(focusedEntityId) || m8Action?.disabled) return false;
  const action = 'activate';
  const memoryId = activeMemory.id;
  const entityId = focusedEntityId;
  window.dispatchEvent(new CustomEvent('spatialMemoryScanRequested', {
    detail: { action, trigger: 'button', memoryId, entityId }
  }));
  setM8Status('正在锚定焦点中的记忆…');
  return true;
}

m8Action?.addEventListener('click', requestM8ButtonAction);

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
      detail: { action: 'scan', trigger: 'keyboard', memoryId: activeMemory.id }
    }));
    setM8Status('正在扫描整个暗物质宇宙网…');
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
