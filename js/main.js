// SYNAPSE — Orquestador principal
// Inicializa Three.js, tracking de manos, anotaciones, corte transversal y snapshots.

let sceneManager, gestureTracker, annotationManager, crossSection, snapshotMgr;
let lastTime = 0;

async function init() {
  try {
    // 1. Escena 3D
    sceneManager = new SceneManager();
    await sceneManager.init();

    // 2. Tracking de gestos (MediaPipe Hands)
    gestureTracker = new GestureTracker();
    await gestureTracker.init();

    // 3. Anotaciones (Smart Annotations)
    annotationManager = new AnnotationManager();

    // 4. Corte transversal
    crossSection = new CrossSection(sceneManager);

    // 5. Snapshots
    snapshotMgr = new SnapshotManager(sceneManager);

    // 6. Conectar eventos de gestos
    setupGestureBindings();

    // 7. Bucle principal
    requestAnimationFrame(animate);
  } catch (err) {
    console.error('Error inicializando SYNAPSE:', err);
  }
}

function setupGestureBindings() {
  // Elementos DOM
  const envBtns = document.querySelectorAll('.env-btn');
  const toggleCS = document.getElementById('toggle-crosssection');
  const toggleAnn = document.getElementById('toggle-annotations');

  // Cambiar entorno (modelo 3D)
  envBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      envBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const env = btn.dataset.env;
      sceneManager.loadEnvironment(env);
    });
  });

  // Corte transversal
  toggleCS.addEventListener('change', (e) => {
    crossSection.setEnabled(e.target.checked);
  });

  // Anotaciones
  toggleAnn.addEventListener('change', (e) => {
    annotationManager.setEnabled(e.target.checked);
  });

  // Cerrar panel de anotación
  document.getElementById('close-annotation').addEventListener('click', () => {
    annotationManager.hidePanel();
  });

  // Conectar gestos de MediaPipe con acciones 3D
  gestureTracker.onGesture = (gesture) => {
    if (!sceneManager) return;

    // === GESTO 1: Captura (snapshot) ===
    // Se detecta con pinza sostenida 1 segundo en el bucle animate()

    // === GESTO 2: Mover libremente (como mouse) ===
    // Cuando está activa palma abierta, el puntero visual sigue la mano
    // (se maneja en el bucle animate)

    // === GESTO 3: Puño → rotar ===
    if (gesture.isFist) {
      sceneManager.isDragging = true;
      sceneManager.lastDragPos = gesture.indexTip;
    } else {
      sceneManager.isDragging = false;
      sceneManager.lastDragPos = null;
    }

    // === GESTO 4: Pinza → zoom (acercar/alejar) ===
    if (gesture.isPinching) {
      // Usamos la posición Y del índice para zoom vertical
      // Arriba = acercar, Abajo = alejar
      const normalizedY = gesture.indexTip.normalized.y;
      const zoomFactor = THREE.MathUtils.lerp(0.5, 2.0, 1 - normalizedY);
      sceneManager.zoomModel(zoomFactor);
    } else if (gesture.twoHandsDistance !== null) {
      // Zoom alternativo con dos manos
      sceneManager.zoomModel(gesture.twoHandsDistance);
    }

    // === GESTO 5: Gesto "L" → alejar ===
    if (gesture.isGestureL) {
      sceneManager.zoomOut();
    }

    // Corte transversal controlado por posición Y de la mano (si está activo)
    if (crossSection.enabled && gesture.indexTip) {
      const normalizedY = gesture.indexTip.normalized.y;
      crossSection.setHandPosition(normalizedY);
    }
  };
}

function animate(now) {
  requestAnimationFrame(animate);

  const delta = now - lastTime;
  lastTime = now;

  // Actualizar escena 3D
  if (sceneManager) sceneManager.update(delta);

  // Actualizar tracking de manos
  if (gestureTracker) gestureTracker.update(delta);

  // --- ROTACIÓN POR ARRASTRE (puño) ---
  if (sceneManager && sceneManager.isDragging && sceneManager.lastDragPos && gestureTracker && gestureTracker.indexTip) {
    const current = gestureTracker.indexTip;
    const prev = sceneManager.lastDragPos;
    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    sceneManager.rotateModel(dx, dy);
    sceneManager.lastDragPos = current;
  }

  // --- SMART ANNOTATIONS (raycasting con el índice) ---
  if (annotationManager && annotationManager.enabled && gestureTracker && gestureTracker.indexTip && sceneManager) {
    annotationManager.update(gestureTracker.indexTip, sceneManager);
  }

  // Actualizar corte transversal si está activo
  if (crossSection && crossSection.enabled) crossSection.update();

  // --- SNAPSHOT POR GESTO (pinza sostenida 1 segundo) ---
  if (snapshotMgr && gestureTracker) {
    if (gesture.isPinching && !gestureTracker.isCaptureGestureActive()) {
      gestureTracker.startCaptureGesture();
    } else if (!gesture.isPinching && gestureTracker.isCaptureGestureActive()) {
      // Se soltó antes de tiempo, cancelar
      gestureTracker.endCaptureGesture();
    } else if (gesture.isPinching && gestureTracker.getCaptureElapsedTime() >= gestureTracker.CAPTURE_HOLD_TIME) {
      snapshotMgr.capture();
      gestureTracker.endCaptureGesture();
    }
  }

  // Actualizar posición del puntero visual (estela de partículas)
  // Invertir X para corregir modo espejo de la cámara frontal
  const pointer = document.getElementById('pointer');
  if (gestureTracker && gestureTracker.indexTip) {
    const { x, y } = gestureTracker.indexTip;
    pointer.style.left = `${window.innerWidth - x}px`;
    pointer.style.top = `${y}px`;
    pointer.classList.add('trail');
    setTimeout(() => pointer.classList.remove('trail'), 100);
  } else {
    // Posición por defecto en el centro cuando no hay mano detectada
    pointer.style.left = `50%`;
    pointer.style.top = `50%`;
    pointer.classList.remove('trail');
  }
}

// Iniciar cuando cargue el DOM
window.addEventListener('DOMContentLoaded', init);
