// SYNAPSE — Orquestador principal

let sceneManager, gestureTracker, annotationManager, crossSection, snapshotMgr;
let lastTime = 0;
let initError = null;

// Control de pinza sostenida
let pinchHoldStartTime = null;
const PINCH_HOLD_DURATION = 1000;
let pinchCaptured = false;

// Coordenadas para fallback con ratón si no hay mano
let mouseCoord = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let isUsingMouse = true;

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

    // 6. Conectar eventos e interacción
    setupGestureBindings();
    setupMouseFallback();

    // 7. Bucle principal
    requestAnimationFrame(animate);
  } catch (err) {
    initError = err;
    console.error('Error inicializando SYNAPSE:', err);
  }
}

function setupMouseFallback() {
  window.addEventListener('mousemove', (e) => {
    mouseCoord.x = e.clientX;
    mouseCoord.y = e.clientY;

    // Si no hay tracking de mano activo, el cursor sigue al ratón
    if (!gestureTracker || !gestureTracker.indexTip) {
      isUsingMouse = true;
      const cursor = document.getElementById('hand-cursor');
      if (cursor) {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      }
      if (crossSection && crossSection.enabled) {
        crossSection.setHandPosition(e.clientY / window.innerHeight);
      }
    }
  });
}

function setupGestureBindings() {
  try {
    const envBtns = document.querySelectorAll('.env-btn');
    const toggleCS = document.getElementById('toggle-crosssection');
    const toggleAnn = document.getElementById('toggle-annotations');

    envBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        envBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const env = btn.dataset.env;
        if (sceneManager) sceneManager.loadEnvironment(env);
        if (annotationManager) annotationManager.setEnvironment(env);
      });
    });

    if (toggleCS) toggleCS.addEventListener('change', (e) => {
      if (crossSection) crossSection.setEnabled(e.target.checked);
    });

    if (toggleAnn) toggleAnn.addEventListener('change', (e) => {
      if (annotationManager) annotationManager.setEnabled(e.target.checked);
    });

    const closeBtn = document.getElementById('close-annotation');
    if (closeBtn) closeBtn.addEventListener('click', () => {
      if (annotationManager) annotationManager.hidePanel();
    });

    gestureTracker.onGesture = (gesture) => {
      if (!sceneManager || !gestureTracker) return;

      if (gesture.indexTip) {
        isUsingMouse = false;
      }

      // === GESTO 2: Puño cerrado → rotar ===
      if (gesture.isFist && gesture.indexTip) {
        if (!sceneManager.isDragging) {
          sceneManager.isDragging = true;
          sceneManager.lastDragPos = { x: gesture.indexTip.x, y: gesture.indexTip.y };
        } else if (sceneManager.lastDragPos) {
          const dx = gesture.indexTip.x - sceneManager.lastDragPos.x;
          const dy = gesture.indexTip.y - sceneManager.lastDragPos.y;
          sceneManager.rotateModel(dx, dy);
          sceneManager.lastDragPos = { x: gesture.indexTip.x, y: gesture.indexTip.y };
        }
      } else {
        sceneManager.isDragging = false;
        sceneManager.lastDragPos = null;
      }

      // === GESTO 3: Pinza → zoom según movimiento vertical de la mano ===
      // Si sube en Y (índice Y menor) -> zoom in; si baja en Y (índice Y mayor) -> zoom out
      if (gesture.isPinching && gesture.indexTip && !gesture.isGestureL) {
        const normY = gesture.indexTip.normalized.y; // 0 (arriba) a 1 (abajo)
        const zoomDelta = (0.5 - normY) * 0.08;
        if (sceneManager.camera) {
          sceneManager.camera.position.z = THREE.MathUtils.clamp(
            sceneManager.camera.position.z - zoomDelta,
            2.5,
            12
          );
        }
      } else if (gesture.twoHandsDistance !== null) {
        sceneManager.zoomModel(gesture.twoHandsDistance);
      }

      // === GESTO 4: Gesto "L" → reset / zoom out rápido ===
      if (gesture.isGestureL) {
        sceneManager.zoomOut();
      }

      // === GESTO 5: Pinza sostenida 1 segundo → snapshot ===
      if (gesture.isPinching) {
        if (!pinchHoldStartTime) {
          pinchHoldStartTime = Date.now();
          pinchCaptured = false;
        } else {
          const elapsed = Date.now() - pinchHoldStartTime;
          if (elapsed >= PINCH_HOLD_DURATION && !pinchCaptured) {
            if (snapshotMgr) snapshotMgr.capture();
            pinchCaptured = true;
          }
        }
      } else {
        pinchHoldStartTime = null;
        pinchCaptured = false;
      }

      // Corte transversal con la mano si está habilitado
      if (crossSection && crossSection.enabled && gesture.indexTip) {
        crossSection.setHandPosition(gesture.indexTip.normalized.y);
      }
    };
  } catch (err) {
    console.error('Error en setupGestureBindings:', err);
  }
}

function animate(now) {
  requestAnimationFrame(animate);

  const delta = now - lastTime;
  lastTime = now;

  try {
    // Actualizar escena 3D
    if (sceneManager) sceneManager.update(delta);

    // Actualizar tracking de manos
    if (gestureTracker) gestureTracker.update(delta);

    // Actualizar posición del cursor 2D en el DOM
    const cursor = document.getElementById('hand-cursor');
    if (cursor) {
      if (gestureTracker && gestureTracker.indexTip) {
        cursor.style.left = `${gestureTracker.indexTip.x}px`;
        cursor.style.top = `${gestureTracker.indexTip.y}px`;
        
        // Efecto visual según el estado de la pinza
        if (gestureTracker.isPinching) {
          cursor.style.borderColor = '#f59e0b';
          cursor.style.transform = 'translate(-50%, -50%) scale(0.85)';
        } else if (gestureTracker.isFist) {
          cursor.style.borderColor = '#ef4444';
          cursor.style.transform = 'translate(-50%, -50%) scale(1.15)';
        } else {
          cursor.style.borderColor = '#38bdf8';
          cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        }
      } else if (!isUsingMouse) {
        cursor.style.left = '50%';
        cursor.style.top = '50%';
      }
    }

    // Smart Annotations Raycasting
    if (annotationManager && annotationManager.enabled && sceneManager) {
      if (gestureTracker && gestureTracker.indexTip) {
        annotationManager.update(gestureTracker.indexTip, sceneManager);
      } else if (mouseCoord) {
        annotationManager.update({ x: mouseCoord.x, y: mouseCoord.y }, sceneManager);
      }
    }

    // Corte transversal
    if (crossSection && crossSection.enabled) {
      crossSection.update();
    }
  } catch (err) {
    console.error('Error en bucle animate:', err);
  }
}

// Iniciar al cargar el DOM
window.addEventListener('DOMContentLoaded', init);
