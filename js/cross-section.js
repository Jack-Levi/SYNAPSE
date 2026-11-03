// SYNAPSE — Cross Section (Corte Transversal / Escáner RX)

class CrossSection {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.enabled = false;
    this.handY = 0.5;
    this.currentConstant = 0;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.sceneManager.setClippingPlane(false, null, 1000);
    } else {
      if (this.sceneManager && this.sceneManager.currentModel) {
        // Asegurar materiales con DoubleSide y planes
        this.sceneManager.currentModel.traverse((child) => {
          if (child.isMesh) {
            child.material.clippingPlanes = [this.sceneManager.clippingPlane];
            child.material.side = THREE.DoubleSide;
            child.material.needsUpdate = true;
          }
        });
      }
      // Fijar el plano en la posición actual conservada
      this.sceneManager.setClippingPlane(true, new THREE.Vector3(0, 1, 0), this.currentConstant);
    }
  }

  setHandPosition(normalizedY) {
    if (!this.enabled || !this.sceneManager) return;
    this.handY = normalizedY;
    const radius = this.sceneManager.modelRadius || 1.3;
    const maxLimit = radius * 0.75;
    // normalizedY: 0 (arriba) a 1 (abajo)
    // Invertimos para que subir la mano corte más alto y bajar corte más bajo
    this.currentConstant = THREE.MathUtils.lerp(maxLimit, -maxLimit, this.handY);
    this.sceneManager.setClippingPlane(true, new THREE.Vector3(0, 1, 0), this.currentConstant);
  }

  update() {
    // La posición solo se altera al detectar el gesto 'Dos dedos'
  }
}
