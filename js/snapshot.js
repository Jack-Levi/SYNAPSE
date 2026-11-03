// SYNAPSE — Snapshot Manager
// Captura la vista 3D actual y la guarda en una galería flotante.

class SnapshotManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.gallery = document.getElementById('snapshot-gallery');
    this.list = document.getElementById('snapshot-list');
    this.maxSnapshots = 5;
    this.snapshots = [];
  }

  capture() {
    if (!this.sceneManager || !this.sceneManager.renderer) return;

    // Renderizar frame actual a un canvas temporal
    const width = this.sceneManager.renderer.domElement.width;
    const height = this.sceneManager.renderer.domElement.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Copiar el frame del WebGL renderer
    tempCtx.drawImage(this.sceneManager.renderer.domElement, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');
    this.addSnapshot(dataUrl);
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
