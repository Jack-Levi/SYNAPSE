// SYNAPSE — Cross Section (Corte Transversal / Escáner RX)

class CrossSection {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.enabled = false;
    this.handY = 0;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.sceneManager.setClippingPlane(false, new THREE.Vector3(0, 1, 0), -1000);
    } else if (this.sceneManager && this.sceneManager.currentModel) {
      // Aplicar clipping planes y DoubleSide a todas las mallas al activar
      this.sceneManager.currentModel.traverse((child) => {
        if (child.isMesh) {
          child.material.clippingPlanes = [this.sceneManager.clippingPlane];
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });
    }
  }

  setHandPosition(normalizedY) {
    if (!this.enabled || !this.sceneManager) return;
    this.handY = normalizedY;
    // Mapeo suave entre el rango de altura del modelo
    const constant = THREE.MathUtils.lerp(1.6, -1.6, this.handY);
    this.sceneManager.setClippingPlane(true, new THREE.Vector3(0, 1, 0), constant);
  }

  update() {
    // Se llama desde main.js con setHandPosition directamente
  }
}
