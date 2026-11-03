// SYNAPSE — Three.js Scene Manager
// Escena 3D, carga de modelos .glb, rotación por gestos, zoom y clipping plane.

class SceneManager {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.currentModel = null;
    this.clippingPlane = null;
    this.enabled = true;

    // Entornos disponibles (solo celula por ahora)
    this.environments = {
      celula: 'assets/models/sel.glb'
    };

    // Cargar modelos reales, no placeholders
    this.useFallback = false;
  }

  async init() {
    const container = document.getElementById('canvas-container');

    // Escena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070a);
    this.scene.fog = new THREE.FogExp2(0x05070a, 0.02);

    // Cámara
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Luz puntual cian (estética futurista)
    const pointLight = new THREE.PointLight(0x00f3ff, 1, 100);
    pointLight.position.set(5, 5, 5);
    this.scene.add(pointLight);

    // Luz puntual magenta
    const pointLight2 = new THREE.PointLight(0xff00ff, 0.7, 100);
    pointLight2.position.set(-5, -5, 5);
    this.scene.add(pointLight2);

    // OrbitControls (fallback si no hay gestos, solo para prueba en desktop)
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Clipping plane (corte transversal)
    this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.scene.clippingPlanes = [this.clippingPlane];

    // Manejo de resize
    window.addEventListener('resize', () => this.onResize());

    // Cargar entorno por defecto (celula)
    await this.loadEnvironment('celula');
  }

  async loadEnvironment(envKey) {
    // Remover modelo anterior
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }

    const url = this.environments[envKey];

    if (this.useFallback || !url) {
      this.createFallbackModel(envKey);
      return;
    }

    const loader = new THREE.GLTFLoader();
    try {
      const gltf = await loader.loadAsync(url);
      this.currentModel = gltf.scene;
      this.currentModel.scale.setScalar(2.0);
      this.currentModel.position.set(0, 0, 0);
      this.scene.add(this.currentModel);

      // Aplicar clipping plane a todos los materiales del modelo
      this.currentModel.traverse((child) => {
        if (child.isMesh) {
          child.material.clippingPlanes = [this.clippingPlane];
          child.material.needsUpdate = true;
        }
      });

      // Enfocar cámara al modelo
      const box = new THREE.Box3().setFromObject(this.currentModel);
      const center = box.getCenter(new THREE.Vector3());
      this.controls.target.copy(center);
      this.camera.position.copy(center).add(new THREE.Vector3(0, 0, 6));
      this.controls.update();
    } catch (err) {
      console.warn(`No se pudo cargar ${url}, usando modelo de respaldo.`, err);
      this.createFallbackModel(envKey);
    }
  }

  createFallbackModel(type) {
    // Geometría simple para probar sin archivos .glb reales
    let geometry, material;

    if (type === 'motor') {
      geometry = new THREE.CylinderGeometry(1, 1, 2, 32);
      material = new THREE.MeshPhongMaterial({ color: 0x333333, emissive: 0x111111 });
    } else if (type === 'celula') {
      geometry = new THREE.IcosahedronGeometry(1.2, 2);
      material = new THREE.MeshPhongMaterial({ color: 0x00ff88, emissive: 0x003344 });
    } else {
      // planeta
      geometry = new THREE.SphereGeometry(1.2, 32, 32);
      material = new THREE.MeshPhongMaterial({ color: 0x2266aa, emissive: 0x001122 });
    }

    this.currentModel = new THREE.Mesh(geometry, material);
    this.currentModel.material.clippingPlanes = [this.clippingPlane];
    this.currentModel.material.needsUpdate = true;
    this.scene.add(this.currentModel);

    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 0, 5);
    this.controls.update();
  }

  // Rotar modelo por gesto de pinza / pujo (arrastrar)
  rotateModel(dx, dy) {
    if (!this.currentModel || !this.enabled) return;
    this.currentModel.rotation.y += dx * 0.005;
    this.currentModel.rotation.x += dy * 0.005;
  }

  // Zoom por distancia entre dos manos
  zoomModel(distance) {
    if (!this.currentModel || !this.enabled) return;
    // distance es un valor entre 0 y 1 aprox; mapeamos a zoom de cámara
    const targetZoom = THREE.MathUtils.lerp(3, 10, distance);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetZoom, 0.1);
    this.camera.lookAt(this.scene.position);
    this.camera.updateProjectionMatrix();
  }

  update(delta) {
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setClippingPlane(enabled, normal, constant) {
    if (enabled) {
      this.clippingPlane.normal.copy(normal);
      this.clippingPlane.constant = constant;
    } else {
      // Desactivar corte: poner el plano lejos del modelo
      this.clippingPlane.constant = -1000;
    }
  }
}
