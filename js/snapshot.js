// SYNAPSE — Snapshot Manager
// Captura la vista 3D actual y la guarda en una galería flotante.

class SnapshotManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.gallery = document.getElementById('snapshot-gallery');
    this.list = document.getElementById('snapshot-list');
    this.maxSnapshots = 5;
    this.snapshots = [];
    this.isCapturing = false;
    this.captureGestureStartTime = null;
    this.CAPTURE_HOLD_TIME = 1000; // ms que debe mantenerse la pinza para capturar
  }

  capture() {
    if (!this.sceneManager || !this.sceneManager.renderer) return;

    // Renderizar frame actual
    const domElement = this.sceneManager.renderer.domElement;
    const width = domElement.width;
    const height = domElement.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Copiar el frame del WebGL renderer
    tempCtx.drawImage(domElement, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');
    this.addSnapshot(dataUrl);

    // Feedback visual en pantalla (flash)
    this.triggerFlashFeedback();
  }

  triggerFlashFeedback() {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(255, 255, 255, 0.4);
      z-index: 999999;
      pointer-events: none;
      transition: opacity 0.4s ease-out;
    `;
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 400);
    });
  }

  startCaptureGesture() {
    this.isCapturing = true;
    this.captureGestureStartTime = Date.now();
  }

  endCaptureGesture() {
    this.isCapturing = false;
    this.captureGestureStartTime = null;
  }

  updateCaptureGesture(isPinching) {
    if (!this.isCapturing) return;

    if (isPinching) {
      const elapsed = Date.now() - this.captureGestureStartTime;
      if (elapsed >= this.CAPTURE_HOLD_TIME) {
        this.capture();
        this.endCaptureGesture();
      }
    } else {
      // Se soltó la pinza antes de tiempo, cancelar
      this.endCaptureGesture();
    }
  }

  addSnapshot(dataUrl) {
    const snapshot = {
      id: Date.now(),
      url: dataUrl,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.snapshots.unshift(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.pop();
    }

    this.renderGallery();
    this.gallery.classList.remove('hidden');
  }

  renderGallery() {
    this.list.innerHTML = '';
    this.snapshots.forEach(snap => {
      const card = document.createElement('div');
      card.className = 'snapshot-card';
      card.innerHTML = `<img src="${snap.url}" alt="Snapshot ${snap.time}">`;
      this.list.appendChild(card);
    });
  }
}
