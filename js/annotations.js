// SYNAPSE — Smart Annotations & 3D Interactive Callouts
// Sistema de Pines 3D proyectados en el DOM con efecto imán/snap, ficha científica y emisión 3D.

class AnnotationManager {
  constructor() {
    this.enabled = true;
    this.panel = document.getElementById('annotation-panel');
    this.panelName = document.getElementById('part-name');
    this.panelDesc = document.getElementById('part-description');
    this.panelData = document.getElementById('part-tech-data');
    this.calloutsContainer = document.getElementById('callouts-container');

    // Base de datos científica completa y verificada
    this.partsDatabase = {
      celula: {
        'nucleo': {
          num: '01',
          name: 'Núcleo Celular',
          desc: 'Centro de control genético de la célula eucariota. Almacena la cromatina, ADN y dirige la síntesis de ARN.',
          data: ['Contenido: Genoma celular (ADN)', 'Envoltura: Doble membrana porosa', 'Diámetro: ~5–7 µm'],
          pos: new THREE.Vector3(0.0, 0.05, 0.15)
        },
        'nucleolo': {
          num: '02',
          name: 'Nucléolo',
          desc: 'Estructura interna densa en el núcleo celular. Sitio primordial para la transcripción y ensamblaje de ribosomas.',
          data: ['Composición: ARN ribosomal + proteínas', 'Función: Biogénesis de ribosomas', 'Membrana: Sin membrana propia'],
          pos: new THREE.Vector3(0.18, 0.22, 0.32)
        },
        'reticulo': {
          num: '03',
          name: 'Retículo Endoplasmático',
          desc: 'Red laberíntica de membranas interconectadas que sintetiza lípidos (liso) y sintetiza/pliega proteínas (rugoso).',
          data: ['Regiones: RER (ribosomas) y REL', 'Función: Plegamiento y síntesis lipídica', 'Destino: Transporte hacia Golgi'],
          pos: new THREE.Vector3(-0.45, 0.35, -0.2)
        },
        'golgi': {
          num: '04',
          name: 'Aparato de Golgi',
          desc: 'Sistema de sacos membranosos que clasifica, procesa químicamente, glicosila y empaqueta macromoléculas para secreción.',
          data: ['Caras: Cis (entrada) y Trans (salida)', 'Vesículas: Transporte vesicular', 'Acción: Glucosilación'],
          pos: new THREE.Vector3(0.55, -0.25, 0.25)
        },
        'mitocondria': {
          num: '05',
          name: 'Mitocondria',
          desc: 'Central energética de la célula. Genera ATP mediante fosforilación oxidativa a través de su cadena de transporte de electrones.',
          data: ['Membrana: Doble con crestas internas', 'Genética: ADN mitocondrial circular', 'Rendimiento: 30-32 ATP/glucosa'],
          pos: new THREE.Vector3(-0.6, -0.35, 0.3)
        },
        'membrana': {
          num: '06',
          name: 'Membrana Plasmática / Citoplasma',
          desc: 'Bicapa lipídica anfipática que delimita la célula y regula el transporte selectivo; el citoplasma alberga el citosol y orgánulos.',
          data: ['Modelo: Mosaico fluido', 'Fluidez: Colesterol y fosfolípidos', 'Espesor: 7.5 - 10 nm'],
          pos: new THREE.Vector3(0.85, 0.45, -0.3)
        }
      },
      motor: {
        'bloque': {
          num: '01',
          name: 'Bloque de Cilindros',
          desc: 'Estructura principal del motor que aloja los cilindros donde se desplazan los pistones bajo alta compresión térmica.',
          data: ['Material: Fundición de hierro / aluminio', 'Cilindrada: 2.0L Turbo', 'Resistencia: Alta rigidez torsional'],
          pos: new THREE.Vector3(0.0, 0.0, 0.0)
        },
        'piston': {
          num: '02',
          name: 'Pistón de Combustión',
          desc: 'Comprime la mezcla de aire/combustible y transmite la fuerza de expansión detonante hacia la biela.',
          data: ['Material: Aleación forjada Al-Si', 'Presión: Hasta 140 bar', 'Segmentos: Compresión y rascador de aceite'],
          pos: new THREE.Vector3(-0.55, 0.4, 0.2)
        },
        'crankshaft': {
          num: '03',
          name: 'Cigüeñal Forjado',
          desc: 'Transforma el movimiento lineal alternativo de las bielas en par motor y rotación continua utilizable.',
          data: ['Rodamientos: 5 apoyos principales', 'Balance: Contrapesos dinámicos', 'Material: Acero 42CrMo4'],
          pos: new THREE.Vector3(0.0, -0.45, -0.1)
        },
        'arbol': {
          num: '04',
          name: 'Árbol de Levas (DOHC)',
          desc: 'Regula con sincronización milimétrica los tiempos de apertura y cierre de las válvulas de admisión y escape.',
          data: ['Configuración: Doble árbol en culata', 'Accionamiento: Cadena dentada', 'Sincronización: Variable VVT'],
          pos: new THREE.Vector3(0.45, 0.55, -0.15)
        }
      },
      planeta: {
        'corteza': {
          num: '01',
          name: 'Corteza Geológica',
          desc: 'Capa litosférica externa compuesta por silicatos sólidos, placas tectónicas activas y relieve continental y oceánico.',
          data: ['Espesor: 5 km (océano) a 70 km (continente)', 'Elementos: Oxígeno, Silicio, Aluminio', 'Estado: Sólido quebradizo'],
          pos: new THREE.Vector3(0.9, 0.3, 0.2)
        },
        'manto': {
          num: '02',
          name: 'Manto Superior / Astenosfera',
          desc: 'Capa rocosa semifluida sometida a corrientes de convección térmica que impulsan el desplazamiento de las placas tectónicas.',
          data: ['Profundidad: Hasta 2,890 km', 'Temperatura: 1000°C - 3700°C', 'Composición: Peridotitas y silicatos de Mg/Fe'],
          pos: new THREE.Vector3(0.5, -0.1, 0.4)
        },
        'nucleo_ext': {
          num: '03',
          name: 'Núcleo Externo Líquido',
          desc: 'Capa metálica líquida cuya convección y efecto geodinamo genera el campo magnético protector del planeta.',
          data: ['Composición: 85% Hierro, 10% Níquel, 5% azufre', 'Estado: Líquido ultra-caliente', 'Efecto: Geodinamo / Magnetosfera'],
          pos: new THREE.Vector3(-0.25, -0.2, 0.15)
        },
        'nucleo_int': {
          num: '04',
          name: 'Núcleo Interno Sólido',
          desc: 'Esfera densa en el centro del planeta mantenida en estado sólido por la gigantesca presión hidrostática central.',
          data: ['Temperatura: ~5,500°C (como la superficie solar)', 'Presión: 3.3 a 3.6 millones de atmósferas', 'Radio: ~1,220 km'],
          pos: new THREE.Vector3(0.0, 0.0, 0.0)
        }
      }
    };

    this.currentEnv = 'celula';
    this.activePartId = null;
    this.calloutElements = new Map();
    this.hoverTimer = null;
    this.hoverThreshold = 400;

    this.initCalloutsDOM();
  }

  initCalloutsDOM() {
    if (!this.calloutsContainer) {
      this.calloutsContainer = document.createElement('div');
      this.calloutsContainer.id = 'callouts-container';
      this.calloutsContainer.style.cssText = `
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 50;
      `;
      document.body.appendChild(this.calloutsContainer);
    }
    this.buildCalloutNodes();
  }

  buildCalloutNodes() {
    if (!this.calloutsContainer) return;
    this.calloutsContainer.innerHTML = '';
    this.calloutElements.clear();

    const parts = this.partsDatabase[this.currentEnv] || {};
    Object.entries(parts).forEach(([id, info]) => {
      const pinWrapper = document.createElement('div');
      pinWrapper.className = 'callout-pin-wrapper';
      pinWrapper.dataset.partId = id;
      pinWrapper.innerHTML = `
        <div class="callout-pin-dot">
          <span class="callout-num">${info.num}</span>
          <div class="callout-pulse"></div>
        </div>
        <div class="callout-line"></div>
        <div class="callout-label">
          <span class="callout-tag">[${info.num}]</span>
          <span class="callout-title">${info.name}</span>
        </div>
      `;
      this.calloutsContainer.appendChild(pinWrapper);
      this.calloutElements.set(id, {
        wrapper: pinWrapper,
        pos3D: info.pos.clone(),
        screenX: 0,
        screenY: 0
      });
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.calloutsContainer) {
      this.calloutsContainer.style.display = enabled ? 'block' : 'none';
    }
    if (!enabled) {
      this.hidePanel();
      if (window.sceneManager) window.sceneManager.clearHighlight();
    }
  }

  setEnvironment(env) {
    this.currentEnv = env;
    this.activePartId = null;
    this.hidePanel();
    this.buildCalloutNodes();
  }

  // Actualización en cada frame: proyecta posiciones 3D a coordenadas 2D de pantalla
  updateCallouts(sceneManager) {
    if (!this.enabled || !sceneManager || !sceneManager.camera || !sceneManager.currentModel) {
      if (this.calloutsContainer) this.calloutsContainer.style.display = 'none';
      return;
    }
    this.calloutsContainer.style.display = 'block';

    const camera = sceneManager.camera;
    const model = sceneManager.currentModel;
    const expFactor = sceneManager.explosionFactor || 0;
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;

    this.calloutElements.forEach((data, id) => {
      const { wrapper, pos3D } = data;
      // Posición mundial del anclaje teniendo en cuenta la rotación del modelo y la explosión
      const worldPos = pos3D.clone();
      
      // Aplicar expansión a los pines si la vista explotada está activa
      if (expFactor > 0) {
        const expDir = worldPos.clone().normalize();
        worldPos.add(expDir.multiplyScalar(expFactor * (sceneManager.modelRadius || 1.3) * 0.9));
      }

      // Transformar por la matriz del modelo 3D
      worldPos.applyMatrix4(model.matrixWorld);

      // Comprobar si está frente a la cámara (dot product)
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      const toPos = worldPos.clone().sub(camera.position).normalize();
      const isVisible = camDir.dot(toPos) > 0.1;

      // Proyectar a pantalla
      const projected = worldPos.clone().project(camera);
      const screenX = (projected.x * widthHalf) + widthHalf;
      const screenY = -(projected.y * heightHalf) + heightHalf;

      data.screenX = screenX;
      data.screenY = screenY;

      if (!isVisible || projected.z > 1.0) {
        wrapper.style.display = 'none';
      } else {
        wrapper.style.display = 'flex';
        wrapper.style.left = `${screenX}px`;
        wrapper.style.top = `${screenY}px`;
      }
    });
  }

  // Interacción con Efecto Imán / Snap (< 45px) o Raycaster
  checkPointerProximity(point2D, sceneManager) {
    if (!this.enabled || !point2D) return;

    let closestPartId = null;
    let minDistance = 45; // Radio imán de 45px

    this.calloutElements.forEach((data, id) => {
      const dist = Math.hypot(point2D.x - data.screenX, point2D.y - data.screenY);
      if (dist < minDistance) {
        minDistance = dist;
        closestPartId = id;
      }
    });

    if (closestPartId) {
      this.selectPart(closestPartId, sceneManager);
      return;
    }

    // Si no está cerca de un pin 2D, usar raycaster como fallback
    if (sceneManager && sceneManager.currentModel && sceneManager.camera) {
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(
        (point2D.x / window.innerWidth) * 2 - 1,
        -(point2D.y / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(mouse, sceneManager.camera);
      const intersects = raycaster.intersectObject(sceneManager.currentModel, true);

      if (intersects.length > 0) {
        const obj = intersects[0].object;
        const partId = this.detectPartByName(obj.name) || this.detectPartByPosition(intersects[0].point);
        if (partId) {
          this.selectPart(partId, sceneManager);
          return;
        }
      }
    }

    // Deseleccionar si está lejos
    if (this.activePartId && minDistance > 65) {
      this.deselectCurrentPart(sceneManager);
    }
  }

  selectPart(partId, sceneManager) {
    if (this.activePartId === partId) return;
    this.activePartId = partId;

    // Resaltar pin visual
    this.calloutElements.forEach((data, id) => {
      if (id === partId) {
        data.wrapper.classList.add('active-pin');
      } else {
        data.wrapper.classList.remove('active-pin');
      }
    });

    // Iluminar sub-malla 3D correspondiente con cian
    if (sceneManager) sceneManager.highlightPart(partId);

    // Mostrar panel informativo
    this.showPanel(partId);
  }

  deselectCurrentPart(sceneManager) {
    this.activePartId = null;
    this.calloutElements.forEach(data => data.wrapper.classList.remove('active-pin'));
    if (sceneManager) sceneManager.clearHighlight();
  }

  detectPartByName(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    const parts = this.partsDatabase[this.currentEnv];
    for (const id in parts) {
      if (lower.includes(id)) return id;
    }
    return null;
  }

  detectPartByPosition(point) {
    const parts = this.partsDatabase[this.currentEnv];
    const ids = Object.keys(parts);
    if (ids.length === 0) return null;
    const zone = Math.floor(((point.y + 1.5) / 3) * ids.length);
    const idx = Math.max(0, Math.min(ids.length - 1, zone));
    return ids[idx];
  }

  showPanel(partId) {
    const parts = this.partsDatabase[this.currentEnv];
    const info = parts[partId];
    if (!info) return;

    this.panelName.textContent = info.name;
    this.panelDesc.textContent = info.desc;

    this.panelData.innerHTML = '';
    info.data.forEach(d => {
      const li = document.createElement('li');
      li.textContent = d;
      this.panelData.appendChild(li);
    });

    this.panel.classList.remove('hidden');
  }

  hidePanel() {
    this.panel.classList.add('hidden');
    this.activePartId = null;
    if (this.calloutElements) {
      this.calloutElements.forEach(data => data.wrapper.classList.remove('active-pin'));
    }
  }

  update(point2D, sceneManager) {
    this.checkPointerProximity(point2D, sceneManager);
  }
}
