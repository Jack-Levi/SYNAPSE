// SYNAPSE — Smart Annotations
// Raycasting con el puntero de la mano para seleccionar partes del modelo 3D.

class AnnotationManager {
  constructor() {
    this.enabled = true;
    this.panel = document.getElementById('annotation-panel');
    this.panelName = document.getElementById('part-name');
    this.panelDesc = document.getElementById('part-description');
    this.panelData = document.getElementById('part-tech-data');

    this.partsDatabase = {
      celula: {
        'mitocondria': {
          name: 'Mitocondria',
          desc: 'Central energética de la célula. Produce ATP mediante respiración celular.',
          data: ['Función: Energía (ATP)', 'Membrana: Doble', 'ADN propio: Sí']
        },
        'nucleo': {
          name: 'Núcleo celular',
          desc: 'Almacena el material genético y controla las actividades celulares.',
          data: ['Contenido: ADN', 'Estructura: Envoltura nuclear', 'Tamaño: ~6 µm']
        },
        'reticulo': {
          name: 'Retículo endoplasmático',
          desc: 'Red de membranas implicada en la síntesis de proteínas y lípidos.',
          data: ['Tipos: Rugoso y liso', 'Función: Síntesis y transporte']
        },
        'membrana': {
          name: 'Membrana plasmática',
          desc: 'Bicapa lipídica que rodea la célula y regula el paso de sustancias.',
          data: ['Composición: Lípidos y proteínas', 'Función: Protección y transporte']
        },
        'citoplasma': {
          name: 'Citoplasma',
          desc: 'Medio acuoso que llena la célula y contiene los orgánulos.',
          data: ['Composición: Agua, sales y proteínas', 'Función: Soporte interno']
        }
      },
      motor: {
        'piston': {
          name: 'Pistón de combustión',
          desc: 'Comprime la mezcla aire-combustible y transmite la fuerza a la biela.',
          data: ['Material: Aleación de aluminio', 'Diámetro: 86 mm', 'Carrera: 86 mm']
        },
        'crankshaft': {
          name: 'Cigüeñal',
          desc: 'Convierte el movimiento alternativo del pistón en movimiento rotatorio.',
          data: ['Material: Acero forjado', 'Rodamientos: 5 apoyos', 'Peso: 12 kg']
        },
        'valve': {
          name: 'Válvula de admisión',
          desc: 'Permite la entrada de aire y combustible al cilindro.',
          data: ['Tipo: De admisión', 'Ángulo: 45°', 'Diámetro: 35 mm']
        }
      },
      planeta: {
        'atmosfera': {
          name: 'Capa atmosférica',
          desc: 'Envolvente de gases que rodea al planeta.',
          data: ['Composición: N₂ 78%, O₂ 21%', 'Capas: Troposfera, Estratosfera...']
        },
        'corteza': {
          name: 'Corteza geológica',
          desc: 'Capa externa sólida del planeta.',
          data: ['Espesor: 5-70 km', 'Composición: Silicatos', 'Estado: Sólido']
        },
        'núcleo': {
          name: 'Núcleo planetario',
          desc: 'Centro denso y caliente del planeta.',
          data: ['Temperatura: ~6000 °C', 'Composición: Hierro y níquel', 'Estado: Líquido/sólido']
        }
      }
    };

    this.currentEnv = 'celula';
    this.hoverTimer = null;
    this.hoverThreshold = 600;
    this.lastPartId = null;
    this.modelMeshNames = [];
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.hidePanel();
  }

  // Registra los nombres de las mallas del GLB al cargar
  registerModelMeshNames(model) {
    this.modelMeshNames = [];
    model.traverse((child) => {
      if (child.isMesh && child.name) {
        this.modelMeshNames.push(child.name);
      }
    });
    if (this.modelMeshNames.length > 0) {
      console.log('Smart Annotations — Mallas del modelo:', this.modelMeshNames);
    }
  }

  setEnvironment(env) {
    this.currentEnv = env;
    this.hidePanel();
  }

  update(point2D, sceneManager) {
    if (!this.enabled || !point2D || !sceneManager || !sceneManager.currentModel || !sceneManager.camera) return;

    const raycaster = new THREE.Raycaster();
    // Coordenadas normalizadas (-1 a +1)
    const mouse = new THREE.Vector2(
      (point2D.x / window.innerWidth) * 2 - 1,
      -(point2D.y / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, sceneManager.camera);
    const intersects = raycaster.intersectObject(sceneManager.currentModel, true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      const partId = object.userData.partId || this.detectPartByName(object.name) || this.detectPartByPosition(intersects[0].point);

      if (partId) {
        this.startHoverTimer(partId);
      } else {
        this.cancelHover();
      }
    } else {
      this.cancelHover();
    }
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
    // Asignación por zona si no hay nombre coincidente
    const parts = this.partsDatabase[this.currentEnv];
    const ids = Object.keys(parts);
    const zone = Math.floor(((point.y + 2) / 4) * ids.length);
    const idx = Math.max(0, Math.min(ids.length - 1, zone));
    return ids[idx];
  }

  startHoverTimer(partId) {
    if (this.lastPartId === partId) return;

    if (!this.hoverTimer) {
      this.hoverTimer = setTimeout(() => {
        this.showPanel(partId);
        this.lastPartId = partId;
        this.hoverTimer = null;
      }, this.hoverThreshold);
    }
  }

  cancelHover() {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
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
    this.lastPartId = null;
    this.cancelHover();
  }
}
