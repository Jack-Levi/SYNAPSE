// SYNAPSE — Snapshot Manager
// Captura la vista 3D actual y la guarda en una galería flotante (máximo 4 elementos).

class SnapshotManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.gallery = document.getElementById('snapshot-gallery');
    this.list = document.getElementById('snapshot-list');
    this.maxSnapshots = 4;
    this.snapshots = [];

    this.cooldownUntil = 0;
    this.COOLDOWN_MS = 5000; // 5 segundos de cooldown estricto

    this.initGalleryUI();
  }

  initGalleryUI() {
    if (!this.gallery) return;

    // Asegurar botón para limpiar historial
    let clearBtn = document.getElementById('clear-snapshots-btn');
    if (!clearBtn) {
      const header = this.gallery.querySelector('.gallery-header') || this.gallery.querySelector('h4');
      if (header) {
        clearBtn = document.createElement('button');
        clearBtn.id = 'clear-snapshots-btn';
        clearBtn.textContent = 'Limpiar';
        clearBtn.style.cssText = `
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #94a3b8;
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
          float: right;
          margin-top: -2px;
          transition: all 0.2s;
        `;
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.clearSnapshots();
        });
        header.appendChild(clearBtn);
      }
    }
  }

  canCapture() {
    return Date.now() >= this.cooldownUntil;
  }

  capture() {
    if (!this.canCapture()) return false;
    if (!this.sceneManager || !this.sceneManager.renderer) return false;

    // Activar cooldown de 5 segundos
    this.cooldownUntil = Date.now() + this.COOLDOWN_MS;

    // Renderizar frame actual
    const domElement = this.sceneManager.renderer.domElement;
    const width = domElement.width;
    const height = domElement.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(domElement, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');
    this.addSnapshot(dataUrl);

    // Feedback visual en pantalla (flash suave 250 ms)
    this.triggerFlashFeedback();
    return true;
  }

  triggerFlashFeedback() {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(255, 255, 255, 0.6);
      z-index: 999999;
      pointer-events: none;
      transition: opacity 0.25s ease-out;
      opacity: 1;
    `;
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 250);
    });
  }

  addSnapshot(dataUrl) {
    const snapshot = {
      id: Date.now(),
      url: dataUrl,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    this.snapshots.unshift(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(0, this.maxSnapshots);
    }

    this.renderGallery();
    if (this.gallery) this.gallery.classList.remove('hidden');
  }

  clearSnapshots() {
    this.snapshots = [];
    if (this.list) this.list.innerHTML = '';
    if (this.gallery) this.gallery.classList.add('hidden');
  }

  renderGallery() {
    if (!this.list) return;
    this.list.innerHTML = '';
    this.snapshots.forEach(snap => {
      const card = document.createElement('div');
      card.className = 'snapshot-card';
      card.innerHTML = `<img src="${snap.url}" alt="Snapshot ${snap.time}">`;
      this.list.appendChild(card);
    });
  }
}
