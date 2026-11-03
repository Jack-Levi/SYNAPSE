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

    document.getElementById('status-camera').textContent = 'Cámara: Activa';
    document.getElementById('status-gesture').textContent = 'Gesto: Listo';
  } catch (err) {
    console.error('Error inicializando SYNAPSE:', err);
    document.getElementById('status-camera').textContent = 'Cámara: Error';
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

    // Actualizar texto de gesto en HUD
    const gestureText = document.getElementById('gesture-text');
    if (gestureText) gestureText.textContent = `Gesto: ${gesture.currentGesture}`;

    // Rotar con pinza o puño (arrastrar)
    if (gesture.isPinching || gesture.isFist) {
      // Usamos la punta del índice como referencia de movimiento
      // (dx, dy) se calculan en el bucle principal comparando frames
      sceneManager.isDragging = true;
      sceneManager.lastDragPos = gesture.indexTip;
    } else {
      sceneManager.isDragging = false;
      sceneManager.lastDragPos = null;
    }

    // Zoom con distancia entre dos manos
    if (gesture.twoHandsDistance !== null) {
      sceneManager.zoomModel(gesture.twoHandsDistance);
    }

    // Corte transversal controlado por posición Y de la mano (si está activo)
    if (crossSection.enabled && gesture.indexTip) {
      const normalizedY = gesture.indexTip.normalized.y;
      crossSection.setHandPosition(normalizedY);
    }

    // Snapshot por gesto de captura (pinza sostenida - se detecta en el bucle)
    if (gesture.isPinching && !snapshotMgr.isCapturing) {
      snapshotMgr.startCaptureGesture();
    } else if (!gesture.isPinching && snapshotMgr.isCapturing) {
      snapshotMgr.endCaptureGesture();
    }
  };
}

function animate(now) {
  requestAnimationFrame(animate);

  const delta = now - lastTime;
  lastTime = now;

  // Actualizar FPS en HUD
  const fps = Math.round(1000 / Math.max(delta, 1));
  document.getElementById('status-fps').textContent = `FPS: ${fps}`;

  // Actualizar escena 3D
  if (sceneManager) sceneManager.update(delta);

  // Actualizar tracking de manos
  if (gestureTracker) gestureTracker.update(delta);

  // --- ROTACIÓN POR ARRASTRE (pinza / puño) ---
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

  // --- SNAPSHOT POR GESTO (pinza sostenida) ---
  if (snapshotMgr && gestureTracker) {
    snapshotMgr.updateCaptureGesture(gestureTracker.isPinching);
  }

  // Actualizar posición del puntero visual (estela de partículas)
  // Invertir X para corregir modo espejo de la cámara frontal
  if (gestureTracker && gestureTracker.indexTip) {
    const { x, y } = gestureTracker.indexTip;
    const pointer = document.getElementById('pointer');
    pointer.style.left = `${window.innerWidth - x}px`;
    pointer.style.top = `${y}px`;
    pointer.classList.add('trail');
    setTimeout(() => pointer.classList.remove('trail'), 100);
  }
}

// Iniciar cuando cargue el DOM
window.addEventListener('DOMContentLoaded', init);
