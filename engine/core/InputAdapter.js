export class InputAdapter {
  constructor(element) {
    this.element = element;
    this.isTouch = 'ontouchstart' in window;

    this.state = {
      isDragging: false,
      hasDragged: false,
      lastX: 0,
      lastY: 0,
      startX: 0,
      startY: 0,
      pinchStartDist: 0
    };

    this.callbacks = {
      scroll: [],
      dragStart: [],
      drag: [],
      dragEnd: [],
      tap: [],
      pinch: []
    };

    this.dragThreshold = 5;

    this._boundHandlers = {
      touchstart: (e) => this.handleTouch(e, 'start'),
      touchmove: (e) => this.handleTouch(e, 'move'),
      touchend: (e) => this.handleTouch(e, 'end'),
      mousedown: (e) => this.handleMouse(e, 'start'),
      mousemove: (e) => this.handleMouse(e, 'move'),
      mouseup: (e) => this.handleMouse(e, 'end'),
      mouseleave: (e) => {
        if (this.state.isDragging) {
          this.handleMouse(e, 'end');
        }
      },
      wheel: (e) => this.handleWheel(e),
      click: (e) => this.handleClick(e)
    };

    this.bindEvents();
  }

  bindEvents() {
    const h = this._boundHandlers;

    if (this.isTouch) {
      this.element.addEventListener('touchstart', h.touchstart, { passive: false });
      this.element.addEventListener('touchmove', h.touchmove, { passive: false });
      this.element.addEventListener('touchend', h.touchend, { passive: false });
    }

    this.element.addEventListener('mousedown', h.mousedown);
    this.element.addEventListener('mouseleave', h.mouseleave);
    this.element.addEventListener('wheel', h.wheel, { passive: false });
    this.element.addEventListener('click', h.click);
  }

  handleWheel(e) {
    e.preventDefault();
    this.emit('scroll', {
      deltaY: e.deltaY,
      deltaX: e.deltaX,
      ctrlKey: e.ctrlKey
    });
  }

  handleMouse(e, phase) {
    switch (phase) {
      case 'start': {
        this.state.isDragging = true;
        this.state.hasDragged = false;
        this.state.startX = e.clientX;
        this.state.startY = e.clientY;
        this.state.lastX = e.clientX;
        this.state.lastY = e.clientY;

        this.emit('dragStart', { x: e.clientX, y: e.clientY });

        document.addEventListener('mousemove', this._boundHandlers.mousemove);
        document.addEventListener('mouseup', this._boundHandlers.mouseup);
        break;
      }
      case 'move': {
        if (!this.state.isDragging) return;

        const deltaX = e.clientX - this.state.lastX;
        const deltaY = e.clientY - this.state.lastY;

        this.state.lastX = e.clientX;
        this.state.lastY = e.clientY;

        const totalX = e.clientX - this.state.startX;
        const totalY = e.clientY - this.state.startY;

        if (Math.abs(totalX) > this.dragThreshold || Math.abs(totalY) > this.dragThreshold) {
          this.state.hasDragged = true;
        }

        this.emit('drag', {
          deltaX,
          deltaY,
          startX: this.state.startX,
          startY: this.state.startY,
          currentX: e.clientX,
          currentY: e.clientY
        });
        break;
      }
      case 'end': {
        if (!this.state.isDragging) return;

        const totalDeltaX = e.clientX - this.state.startX;
        const totalDeltaY = e.clientY - this.state.startY;

        this.state.isDragging = false;

        this.emit('dragEnd', { totalDeltaX, totalDeltaY });

        document.removeEventListener('mousemove', this._boundHandlers.mousemove);
        document.removeEventListener('mouseup', this._boundHandlers.mouseup);
        break;
      }
    }
  }

  handleTouch(e, phase) {
    switch (phase) {
      case 'start': {
        e.preventDefault();

        if (e.touches.length === 1) {
          const touch = e.touches[0];
          this.state.isDragging = true;
          this.state.hasDragged = false;
          this.state.startX = touch.clientX;
          this.state.startY = touch.clientY;
          this.state.lastX = touch.clientX;
          this.state.lastY = touch.clientY;

          this.emit('dragStart', { x: touch.clientX, y: touch.clientY });
        } else if (e.touches.length === 2) {
          this.state.isDragging = false;
          this.state.pinchStartDist = this.getPinchDistance(e.touches);
        }
        break;
      }
      case 'move': {
        e.preventDefault();

        if (e.touches.length === 1 && this.state.isDragging) {
          const touch = e.touches[0];
          const deltaX = touch.clientX - this.state.lastX;
          const deltaY = touch.clientY - this.state.lastY;

          this.state.lastX = touch.clientX;
          this.state.lastY = touch.clientY;

          const totalX = touch.clientX - this.state.startX;
          const totalY = touch.clientY - this.state.startY;

          if (Math.abs(totalX) > this.dragThreshold || Math.abs(totalY) > this.dragThreshold) {
            this.state.hasDragged = true;
          }

          this.emit('drag', {
            deltaX,
            deltaY,
            startX: this.state.startX,
            startY: this.state.startY,
            currentX: touch.clientX,
            currentY: touch.clientY
          });
        } else if (e.touches.length === 2) {
          const currentDist = this.getPinchDistance(e.touches);
          const scale = this.state.pinchStartDist > 0
            ? currentDist / this.state.pinchStartDist
            : 1;
          const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

          this.emit('pinch', { scale, centerX, centerY });
        }
        break;
      }
      case 'end': {
        if (this.state.isDragging) {
          const touch = e.changedTouches[0];
          const totalDeltaX = touch.clientX - this.state.startX;
          const totalDeltaY = touch.clientY - this.state.startY;

          this.state.isDragging = false;

          this.emit('dragEnd', { totalDeltaX, totalDeltaY });

          if (!this.state.hasDragged) {
            this.emit('tap', { x: touch.clientX, y: touch.clientY });
          }
        }

        if (e.touches.length < 2) {
          this.state.pinchStartDist = 0;
        }
        break;
      }
    }
  }

  handleClick(e) {
    if (this.state.hasDragged) return;
    this.handleTap(e);
  }

  handleTap(e) {
    this.emit('tap', { x: e.clientX, y: e.clientY });
  }

  getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);

    return () => this.off(event, callback);
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
        console.error(`Error in InputAdapter "${event}" callback:`, error);
      }
    });
  }

  destroy() {
    const h = this._boundHandlers;

    document.removeEventListener('mousemove', h.mousemove);
    document.removeEventListener('mouseup', h.mouseup);

    if (this.isTouch) {
      this.element.removeEventListener('touchstart', h.touchstart);
      this.element.removeEventListener('touchmove', h.touchmove);
      this.element.removeEventListener('touchend', h.touchend);
    }

    this.element.removeEventListener('mousedown', h.mousedown);
    this.element.removeEventListener('mouseleave', h.mouseleave);
    this.element.removeEventListener('wheel', h.wheel);
    this.element.removeEventListener('click', h.click);

    Object.keys(this.callbacks).forEach(key => {
      this.callbacks[key] = [];
    });
  }
}
