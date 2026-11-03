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

  // Actualizar corte transversal si está activo
  if (crossSection && crossSection.enabled) crossSection.update();

  // Actualizar posición del puntero visual (estela de partículas)
  if (gestureTracker && gestureTracker.indexTip) {
    const { x, y } = gestureTracker.indexTip;
    const pointer = document.getElementById('pointer');
    pointer.style.left = `${x}px`;
    pointer.style.top = `${y}px`;
    pointer.classList.add('trail');
    setTimeout(() => pointer.classList.remove('trail'), 100);
  }
}

// Iniciar cuando cargue el DOM
window.addEventListener('DOMContentLoaded', init);
