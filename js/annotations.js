// SYNAPSE — Smart Annotations
// Raycasting simple con el dedo índice para seleccionar partes del modelo 3D
// y mostrar un panel informativo con datos técnicos.

class AnnotationManager {
  constructor() {
    this.enabled = true;
    this.panel = document.getElementById('annotation-panel');
    this.panelName = document.getElementById('part-name');
    this.panelDesc = document.getElementById('part-description');
    this.panelData = document.getElementById('part-tech-data');

    // Diccionario de partes por entorno (ejemplo)
    this.partsDatabase = {
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
        }
      },
      planeta: {
        'atmosfera': {
          name: 'Capa atmosférica',
          desc: 'Envolvente de gases que rodea al planeta y protege la superficie.',
          data: ['Composición: N₂ 78%, O₂ 21%', 'Capas: Troposfera, Estratosfera...']
        },
        'corteza': {
          name: 'Corteza geológica',
          desc: 'Capa externa sólida del planeta, donde se forman los continentes.',
          data: ['Espesor: 5-70 km', 'Composición: Silicatos', 'Estado: Sólido']
        },
        'núcleo': {
          name: 'Núcleo planetario',
          desc: 'Centro denso y caliente del planeta, generador del campo magnético.',
          data: ['Temperatura: ~6000 °C', 'Composición: Hierro y níquel', 'Estado: Líquido/sólido']
        }
      }
    };

    this.currentEnv = 'celula';
    this.hoverTimer = null;
    this.hoverThreshold = 600; // ms manteniendo el dedo quieto para activar selección
    this.lastPartId = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.hidePanel();
  }

  // Se llama desde el bucle principal con la posición del índice y el modelo actual
  update(indexTip, sceneManager) {
    if (!this.enabled || !indexTip || !sceneManager || !sceneManager.currentModel) return;

    // Raycasting simple: proyectar el dedo índice desde la cámara hacia el modelo
    // Como no tenemos coordenadas 3D exactas del dedo, usamos una aproximación:
    // Disparamos un rayo desde la cámara hacia el centro del modelo (simplificación)
    // En una implementación completa, se haría un raycast real desde la cámara
    // a través de la posición normalizada del dedo en pantalla.

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (indexTip.x / window.innerWidth) * 2 - 1,
      -(indexTip.y / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, sceneManager.camera);

    const intersects = raycaster.intersectObject(sceneManager.currentModel, true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      const partId = object.userData.partId || this.detectPartByName(object.name);

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
    const lower = (name || '').toLowerCase();
    const parts = this.partsDatabase[this.currentEnv];
    for (const id in parts) {
      if (lower.includes(id)) return id;
    }
    return null;
  }

  startHoverTimer(partId) {
    if (this.lastPartId === partId) return; // ya está seleccionado

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

  setEnvironment(env) {
    this.currentEnv = env;
    this.hidePanel();
  }
}
