const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ACTIVE_TYPES = new Set(['gaze', 'align', 'scan', 'proximity', 'epilogue']);
const carrierId = carrier => carrier?.memoryId || carrier?.data?.id || carrier?.id || null;

export class M8DiscoveryController {
  constructor(options = {}) {
    this.gracePeriod = options.gracePeriod ?? 0.18;
    this.durations = { gaze: 1.2, align: 1, scan: 1.5, proximity: 0.35, epilogue: 0.35, ...options.durations };
    this.carriers = [];
    this.carrierById = new Map();
    this.focusedCarrier = null;
    this.gazeProgress = 0;
    this.scanProgress = 0;
    this.scan = null;
    this._inactiveTime = 0;
    this.disposed = false;
  }

  setCarriers(carriers = []) {
    this.carriers = [...carriers].filter(carrier => carrierId(carrier));
    this.carrierById = new Map(this.carriers.map(carrier => [carrierId(carrier), carrier]));
    if (this.focusedCarrier && !this.carrierById.has(carrierId(this.focusedCarrier))) this.setFocusedCarrier(null);
    return this;
  }

  setFocusedCarrier(carrierOrId = null) {
    const next = typeof carrierOrId === 'string' ? this.carrierById.get(carrierOrId) || null : carrierOrId;
    if (next === this.focusedCarrier) return this;
    this.focusedCarrier?.setFocused?.(false);
    this.focusedCarrier = next || null;
    this.focusedCarrier?.setFocused?.(true);
    this.gazeProgress = this.focusedCarrier?.discoveryProgress || 0;
    this._inactiveTime = 0;
    return this;
  }

  beginScan(carrierId, source = 'pointer') {
    const carrier = this.carrierById.get(carrierId);
    if (!carrier || carrier.unlocked === false || carrier.visited) return { started: false, carrierId, source };
    this.setFocusedCarrier(carrier);
    this.scan = { carrierId, source };
    this.scanProgress = carrier.discoveryProgress || 0;
    return { started: true, carrierId, source };
  }

  cancelScan(reason = 'cancelled') {
    const result = this.scan ? { cancelled: true, ...this.scan, reason, progress: this.scanProgress } : { cancelled: false, reason };
    this.scan = null;
    this.scanProgress = 0;
    return result;
  }

  handleLongPress(carrierId, source = 'longPress') { return this.beginScan(carrierId, source); }

  update(delta = 0, context = {}) {
    const carrier = this.focusedCarrier;
    if (!carrier || carrier.visited || carrier.unlocked === false) return this._result(carrier, null, false);
    const dt = Math.min(Math.max(Number(delta) || 0, 0), 0.1);
    const sample = carrier.getDiscoverySample?.(context) || {};
    const requestedType = sample.type || sample.interaction;
    const type = ACTIVE_TYPES.has(requestedType) ? requestedType : 'gaze';
    const active = this._isActive(type, sample, carrier);
    this._inactiveTime = active ? 0 : this._inactiveTime + dt;
    let progress = type === 'scan' ? this.scanProgress : this.gazeProgress;

    if (Number.isFinite(sample.progress)) progress = Math.max(progress, clamp01(sample.progress));
    if (active) progress += dt * (sample.rate ?? 1) / Math.max(0.01, sample.duration || this.durations[type]);
    else if (this._inactiveTime > this.gracePeriod) {
      progress = Math.max(0, progress - dt / Math.max(0.01, this.durations[type] * 0.5));
    }
    progress = clamp01(progress);
    if (type === 'scan') this.scanProgress = progress;
    else this.gazeProgress = progress;
    carrier.setDiscoveryProgress?.(progress);

    const discovered = progress >= 1;
    if (discovered) {
      if (type === 'scan') this.scan = null;
    }
    return this._result(carrier, type, discovered, sample);
  }

  _isActive(type, sample, carrier) {
    if (type === 'scan') return this.scan?.carrierId === carrierId(carrier) && sample.active !== false;
    if (type === 'align') return Boolean(sample.active ?? sample.aligned);
    if (type === 'proximity') return Boolean(sample.active ?? sample.inProximity ?? sample.near);
    if (type === 'epilogue') return Boolean(sample.active ?? sample.ready ?? sample.epilogueReady);
    return Boolean(sample.active ?? sample.gazing ?? sample.focused ?? this.focusedCarrier === carrier);
  }

  _result(carrier, interaction, discovered, sample = null) {
    return {
      carrierId: carrierId(carrier),
      interaction,
      progress: interaction === 'scan' ? this.scanProgress : this.gazeProgress,
      gazeProgress: this.gazeProgress,
      scanProgress: this.scanProgress,
      discovered,
      state: carrier?.state || null,
      sample
    };
  }

  resetCarrier(carrierId) {
    const carrier = this.carrierById.get(carrierId);
    if (!carrier) return { reset: false, carrierId };
    carrier.setVisited?.(false);
    carrier.setDiscoveryProgress?.(0);
    if (carrier === this.focusedCarrier) this.gazeProgress = 0;
    if (this.scan?.carrierId === carrierId) this.cancelScan('reset');
    return { reset: true, carrierId };
  }

  dispose() {
    this.focusedCarrier?.setFocused?.(false);
    this.carriers = [];
    this.carrierById.clear();
    this.focusedCarrier = null;
    this.scan = null;
    this.gazeProgress = 0;
    this.scanProgress = 0;
    this.disposed = true;
  }
}
