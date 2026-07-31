export class PerformanceProfiler {
  constructor() {
    this.fps = 60;
    this.frames = [];
    this.quality = 'high';
    this.callbacks = {};
    this.lastSampleTime = performance.now();
    this.maxFrames = 30;
    this.isMeasuring = false;
    this._rafId = null;
    this._framesSincePerformanceSample = 0;

    this._sampleBound = this._sample.bind(this);
  }

  measure() {
    if (this.isMeasuring) return;
    this.isMeasuring = true;
    this.lastSampleTime = performance.now();
    this.frames = [];
    this._framesSincePerformanceSample = 0;
    this._rafId = requestAnimationFrame(this._sampleBound);
  }

  _sample() {
    if (!this.isMeasuring) return;

    const now = performance.now();
    const delta = now - this.lastSampleTime;
    this.lastSampleTime = now;

    if (delta > 0) {
      const currentFps = 1000 / delta;
      this.frames.push(currentFps);
      this._framesSincePerformanceSample++;

      if (this.frames.length > this.maxFrames) {
        this.frames.shift();
      }

      if (this.frames.length >= this.maxFrames) {
        const avgFps = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
        this.fps = avgFps;

        let newQuality;
        if (avgFps < 20) {
          newQuality = 'low';
        } else if (avgFps < 40) {
          newQuality = 'medium';
        } else {
          newQuality = 'high';
        }

        if (newQuality !== this.quality) {
          this.quality = newQuality;
          this.emit('qualityChange', { quality: newQuality, fps: avgFps });
        }

        if (this._framesSincePerformanceSample >= this.maxFrames) {
          this._framesSincePerformanceSample = 0;
          this.emit('performanceSample', {
            fps: avgFps,
            quality: this.quality,
            timestamp: now
          });
        }
      }
    }

    this._rafId = requestAnimationFrame(this._sampleBound);
  }

  stop() {
    this.isMeasuring = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event, callback) {
    if (!this.callbacks[event]) return;
    const index = this.callbacks[event].indexOf(callback);
    if (index > -1) {
      this.callbacks[event].splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.callbacks[event]) return;
    const callbacks = [...this.callbacks[event]];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in PerformanceProfiler "${event}" callback:`, error);
      }
    });
  }

  getSettings() {
    const settingsMap = {
      high: {
        particleCount: 1.0,
        shadowQuality: 1.0,
        bloom: true,
        antialias: true
      },
      medium: {
        particleCount: 0.5,
        shadowQuality: 0.5,
        bloom: true,
        antialias: false
      },
      low: {
        particleCount: 0.2,
        shadowQuality: 0.2,
        bloom: false,
        antialias: false
      }
    };

    return settingsMap[this.quality] || settingsMap.high;
  }
}
