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
    this.planeHelper = null;
    this.enabled = true;
    this.modelRadius = 1.5;
    this.currentEnv = 'celula';

    // Vista explotada
    this.explosionFactor = 0; // 0.0 a 1.0
    this.explodedMeshes = [];
    this.originalPositions = new Map();

    // Entornos disponibles
    this.environments = {
      celula: 'assets/models/sel.glb',
      motor: 'assets/models/motor.glb',
      planeta: 'assets/models/planeta.glb'
    };
  }

  async init() {
    const container = document.getElementById('canvas-container');

    // Escena — fondo nulo para que se vea el CSS
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(0x090d14, 0.012);

    // Cámara
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    // Renderer — alpha true para fondo CSS
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    // Iluminación de estudio
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.5);
    this.scene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.2);
    mainLight.position.set(5, 8, 6);
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.0);
    fillLight.position.set(-6, -2, 4);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(0, 5, -8);
    this.scene.add(rimLight);

    // OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Clipping plane (inicia desactivado con constante lejana para ver el modelo 100% completo)
    this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1000);
    this.scene.clippingPlanes = [this.clippingPlane];
    this.modelRadius = 1.5;

    // Helper visual sutil para el plano de corte
    this.planeHelper = new THREE.PlaneHelper(this.clippingPlane, 3.2, 0x38bdf8);
    this.planeHelper.material.transparent = true;
    this.planeHelper.material.opacity = 0.45;
    this.planeHelper.visible = false;
    this.scene.add(this.planeHelper);

    // Resize
    window.addEventListener('resize', () => this.onResize());

    // Cargar modelo por defecto
    await this.loadEnvironment('celula');
  }

  async loadEnvironment(envKey) {
    // Remover modelo anterior
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }

    const url = this.environments[envKey];
    const modelName = envKey.charAt(0).toUpperCase() + envKey.slice(1);

    const loader = new THREE.GLTFLoader();
    try {
      const gltf = await loader.loadAsync(url);
      this.currentModel = gltf.scene;

      // Centrar y normalizar escala
      this.centerAndNormalize(this.currentModel);
      this.scene.add(this.currentModel);
      this.currentEnv = envKey;

      // Imprimir nombres de mallas una sola vez al cargar
      const meshNames = [];
      this.currentModel.traverse((child) => {
        if (child.isMesh && child.name) {
          meshNames.push(child.name);
        }
      });
      console.log(`[SYNAPSE] Mallas cargadas en el modelo ${modelName}:`, meshNames);

      // Preparar mallas para la Vista Explotada
      this.setupExplodedView(this.currentModel);

      // Aplicar clipping plane y DoubleSide a todos los materiales
      this.currentModel.traverse((child) => {
        if (child.isMesh) {
          child.material.clippingPlanes = [this.clippingPlane];
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });

      // Enfocar cámara
      const box = new THREE.Box3().setFromObject(this.currentModel);
      const center = box.getCenter(new THREE.Vector3());
      this.controls.target.copy(center);
      this.camera.position.copy(center).add(new THREE.Vector3(0, 0, 6));
      this.controls.update();

      document.getElementById('status-modelo').textContent = `Modelo: ${modelName} OK`;
      return;
    } catch (err) {
      console.warn(`No se pudo cargar ${url}:`, err.message);
      document.getElementById('status-modelo').textContent = `Modelo: ${modelName} fallback`;
    }

    // Notificación visual en HUD si es fallback
    const hudNotification = document.createElement('div');
    hudNotification.style.cssText = `
      position: fixed;
      bottom: 1.5rem;
      left: 1.5rem;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #94a3b8;
      font-size: 0.8rem;
      padding: 8px 14px;
      border-radius: 6px;
      z-index: 999;
      backdrop-filter: blur(8px);
      pointer-events: none;
      transition: opacity 0.5s ease;
    `;
    hudNotification.textContent = `Aviso: Archivo 3D no encontrado. Visualizando ${modelName} procedural.`;
    document.body.appendChild(hudNotification);
    setTimeout(() => {
      hudNotification.style.opacity = '0';
      setTimeout(() => hudNotification.remove(), 500);
    }, 3500);

    // Fallback procedural
    this.createFallbackModel(envKey);
    const statusElem = document.getElementById('status-modelo');
    if (statusElem) statusElem.textContent = `Modelo: ${modelName} (procedural)`;
  }

  centerAndNormalize(model) {
    // Resetear transformaciones previas
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Desplazar pivote para centrar exactamente en (0,0,0)
    model.position.x = -center.x;
    model.position.y = -center.y;
    model.position.z = -center.z;

    // Normalizar a una dimensión visual estándar uniforme (aprox. diámetro visual de 2.5 unidades)
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 2.5 / maxDim;
      model.scale.setScalar(scale);
      // Re-centrar teniendo en cuenta la nueva escala
      model.position.multiplyScalar(scale);
    }

    // Calcular radio visual acotado
    const updatedBox = new THREE.Box3().setFromObject(model);
    const sphere = updatedBox.getBoundingSphere(new THREE.Sphere());
    this.modelRadius = sphere.radius || 1.3;
  }

  // Prepara los vectores de explosión y almacena posiciones originales
  setupExplodedView(model) {
    this.explodedMeshes = [];
    this.originalPositions.clear();
    let meshIndex = 0;

    model.traverse((child) => {
      if (child.isMesh) {
        // Almacenar posición y escala originales
        child.userData.originalPosition = child.position.clone();
        child.userData.originalScale = child.scale.clone();
        
        // Guardar color emisivo original para el efecto de resaltado de pines
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.userData.originalMaterials = child.material.map(m => m.clone());
          } else {
            child.userData.originalEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0,0,0);
            child.userData.originalEmissiveIntensity = child.material.emissiveIntensity || 0;
          }
        }

        // Calcular dirección de explosión
        const box = new THREE.Box3().setFromObject(child);
        const center = box.getCenter(new THREE.Vector3());
        
        let dir = center.clone();
        if (dir.lengthSq() < 0.001) {
          // Si está en el centro, asignar dirección radial dispersa
          const theta = (meshIndex * 2.3999632); // ángulo áureo
          const phi = Math.acos(1 - 2 * ((meshIndex + 0.5) / 6));
          dir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
          );
        } else {
          dir.normalize();
        }

        child.userData.explodeDir = dir;
        this.explodedMeshes.push(child);
        meshIndex++;
      }
    });

    this.setExplosionFactor(this.explosionFactor);
  }

  // Ajusta el nivel de desensamblaje holográfico (0.0 = unido, 1.0 = desensamblado)
  setExplosionFactor(factor) {
    this.explosionFactor = THREE.MathUtils.clamp(factor, 0, 1);
    const maxDisplacement = this.modelRadius * 1.3;

    this.explodedMeshes.forEach((mesh) => {
      if (!mesh.userData.originalPosition || !mesh.userData.explodeDir) return;

      const offset = mesh.userData.explodeDir.clone().multiplyScalar(this.explosionFactor * maxDisplacement);
      mesh.position.copy(mesh.userData.originalPosition).add(offset);

      // Si el modelo tiene muy pocas mallas (como sel.glb que tiene 2 partes),
      // escalamos suavemente para hacer la explosión de orgánulos interna más dramática
      if (this.explodedMeshes.length <= 3 && mesh.userData.originalScale) {
        const scaleMul = 1.0 + (this.explosionFactor * 0.22);
        mesh.scale.copy(mesh.userData.originalScale).multiplyScalar(scaleMul);
      }
    });
  }

  // Resalta una parte del modelo con emisión cian holográfica
  highlightPart(partId) {
    if (!this.currentModel) return;

    this.currentModel.traverse((child) => {
      if (child.isMesh && child.material && child.material.emissive) {
        child.material.emissive = new THREE.Color(0x0ea5e9);
        child.material.emissiveIntensity = 0.45;
      }
    });
  }

  clearHighlight() {
    if (!this.currentModel) return;

    this.currentModel.traverse((child) => {
      if (child.isMesh && child.material && child.material.emissive) {
        if (child.userData.originalEmissive) {
          child.material.emissive.copy(child.userData.originalEmissive);
          child.material.emissiveIntensity = child.userData.originalEmissiveIntensity || 0;
        } else {
          child.material.emissive.setHex(0x000000);
          child.material.emissiveIntensity = 0;
        }
      }
    });
  }

  createFallbackModel(type) {
    let geometry, material;

    if (type === 'motor') {
      // Motor procedural: bloque + cilindros
      const group = new THREE.Group();
      const blockMat = new THREE.MeshPhongMaterial({ color: 0x2a2a2a, emissive: 0x111111 });
      const metalMat = new THREE.MeshPhongMaterial({ color: 0x555555, emissive: 0x111111 });

      const block = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), blockMat);
      group.add(block);

      for (let i = 0; i < 4; i++) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16), metalMat);
        cyl.position.set(-0.7 + i * 0.5, 0, 0.4);
        cyl.rotation.x = Math.PI / 2;
        group.add(cyl);
      }

      this.currentModel = group;
    } else if (type === 'celula') {
      const group = new THREE.Group();
      const membraneMat = new THREE.MeshPhongMaterial({ color: 0x4da6ff, emissive: 0x003344, transparent: true, opacity: 0.8 });
      const nucleusMat = new THREE.MeshPhongMaterial({ color: 0x7b2cbf, emissive: 0x2d1b69 });

      const membrane = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 32), membraneMat);
      group.add(membrane);

      const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 24), nucleusMat);
      nucleus.position.set(0, 0.1, 0);
      group.add(nucleus);

      this.currentModel = group;
    } else {
      // Planeta procedural: esferas concéntricas
      const group = new THREE.Group();
      const crustMat = new THREE.MeshPhongMaterial({ color: 0x4a6fa5, emissive: 0x0d1b2a });
      const mantleMat = new THREE.MeshPhongMaterial({ color: 0xd4822b, emissive: 0x3a200b });
      const coreMat = new THREE.MeshPhongMaterial({ color: 0xffb700, emissive: 0x4a3200 });

      const crust = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 32), crustMat);
      group.add(crust);

      const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 32), mantleMat);
      group.add(mantle);

      const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 24), coreMat);
      group.add(core);

      this.currentModel = group;
    }

    this.currentModel.traverse((child) => {
      if (child.isMesh) {
        child.material.clippingPlanes = [this.clippingPlane];
        child.material.side = THREE.DoubleSide;
        child.material.needsUpdate = true;
      }
    });

    this.scene.add(this.currentModel);
    this.currentEnv = envKey;
    this.setupExplodedView(this.currentModel);

    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 0, 5);
    this.controls.update();
  }

  rotateModel(dx, dy) {
    if (!this.currentModel || !this.enabled) return;
    this.currentModel.rotation.y += dx * 0.005;
    this.currentModel.rotation.x += dy * 0.005;
  }

  // Acercar suavemente (límite mínimo seguro 2.2)
  zoomInStep(speed = 0.05) {
    if (!this.currentModel || !this.camera) return;
    this.camera.position.z = Math.max(2.2, this.camera.position.z - speed);
    this.camera.updateProjectionMatrix();
  }

  // Alejar suavemente (límite máximo 9.0)
  zoomOutStep(speed = 0.05) {
    if (!this.currentModel || !this.camera) return;
    this.camera.position.z = Math.min(9.0, this.camera.position.z + speed);
    this.camera.updateProjectionMatrix();
  }

  zoomModel(factor) {
    if (!this.currentModel || !this.enabled) return;
    let targetZoom;
    if (factor <= 1) {
      targetZoom = THREE.MathUtils.lerp(3, 10, factor);
    } else {
      targetZoom = THREE.MathUtils.lerp(3, 10, factor / 2);
    }
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetZoom, 0.1);
    this.camera.lookAt(this.scene.position);
    this.camera.updateProjectionMatrix();
  }

  zoomOut() {
    if (!this.currentModel || !this.enabled) return;
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 12, 0.15);
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
      if (normal) this.clippingPlane.normal.copy(normal);
      // Rango acotado: nunca más allá de +/- 75% del radio para no rebanar el 100%
      const maxLimit = this.modelRadius * 0.75;
      const boundedConstant = THREE.MathUtils.clamp(constant, -maxLimit, maxLimit);
      this.clippingPlane.constant = boundedConstant;
      if (this.planeHelper) this.planeHelper.visible = true;
    } else {
      // Fuera del modelo: el objeto se ve 100% íntegro
      this.clippingPlane.constant = 1000;
      if (this.planeHelper) this.planeHelper.visible = false;
    }
  }
}
