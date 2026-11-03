// SYNAPSE — Cross Section (Corte Transversal / Escáner RX)
// Mueve un plano de corte sobre el modelo 3D según la posición de la mano.

class CrossSection {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.enabled = false;
    this.handY = 0; // posición normalizada de la mano (-1 a 1)
    this.speed = 0.02;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.sceneManager.setClippingPlane(false, new THREE.Vector3(0, 1, 0), -1000);
    }
  }

  // Se llama desde el bucle con la posición de la mano (índice)
  update() {
    if (!this.enabled || !this.sceneManager) return;

    // Si hay posición de mano, usarla para mover el plano
    // (En la implementación completa se conecta con gestureTracker.indexTip.normalized.y)
    // Aquí dejamos un movimiento automático de demostración si no hay input de mano:
    const time = Date.now() * 0.001;
    const offset = Math.sin(time * 0.5) * 1.5;

    this.sceneManager.setClippingPlane(
      true,
      new THREE.Vector3(0, 1, 0),
      offset
    );
  }

  // Método para controlar el plano con la mano (llamado desde main.js al integrar)
  setHandPosition(normalizedY) {
    this.handY = normalizedY;
    const constant = THREE.MathUtils.lerp(-1.5, 1.5, (this.handY + 1) / 2);
    this.sceneManager.setClippingPlane(true, new THREE.Vector3(0, 1, 0), constant);
  }
}
