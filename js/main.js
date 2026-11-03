// SYNAPSE — Orquestador principal

let sceneManager, gestureTracker, annotationManager, crossSection, snapshotMgr;
let lastTime = 0;
let initError = null;

// Control de captura de foto sostenida
let photoGestureStartTime = null;
const PHOTO_HOLD_DURATION = 1000;
let photoCaptured = false;

// Coordenadas para fallback con ratón si no hay mano
let mouseCoord = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let isUsingMouse = true;

// Sistema de Dwell Click (clic por permanencia de 800 ms)
let dwellTargetElement = null;
let dwellStartTime = null;
const DWELL_DURATION = 800;

// Paleta de colores para cada modo de gesto
const GESTURE_COLORS = {
  'MODO: LIBRE': { border: '#38bdf8', shadow: 'rgba(56, 189, 248, 0.8)' },
  'MODO: ROTAR': { border: '#ef4444', shadow: 'rgba(239, 68, 68, 0.8)' },
  'MODO: ACERCAR / ZOOM IN': { border: '#10b981', shadow: 'rgba(16, 185, 129, 0.8)' },
  'MODO: ALEJAR / ZOOM OUT': { border: '#a855f7', shadow: 'rgba(168, 85, 247, 0.8)' },
  'MODO: CORTE RX': { border: '#06b6d4', shadow: 'rgba(6, 182, 212, 0.8)' },
  'MODO: CAPTURA': { border: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.9)' },
  'Sin mano detectada': { border: '#64748b', shadow: 'rgba(100, 116, 139, 0.5)' }
};

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
      handleDwellClick(e.clientX, e.clientY);
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

    if (toggleCS) {
      toggleCS.checked = false; // Desmarcado estrictamente al inicio
      toggleCS.addEventListener('change', (e) => {
        if (crossSection) crossSection.setEnabled(e.target.checked);
      });
    }

    if (toggleAnn) {
      toggleAnn.addEventListener('change', (e) => {
        if (annotationManager) annotationManager.setEnabled(e.target.checked);
      });
    }

    const closeBtn = document.getElementById('close-annotation');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (annotationManager) annotationManager.hidePanel();
      });
    }

    gestureTracker.onGesture = (gesture) => {
      if (!sceneManager || !gestureTracker) return;

      if (gesture.indexTip) {
        isUsingMouse = false;
      }

      // === 2. MODO: ROTAR (Puño cerrado) ===
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

      // === 5. MODO: CORTE RX (Dos dedos) ===
      if (gesture.isTwoFingers && crossSection && crossSection.enabled && gesture.indexTip) {
        crossSection.setHandPosition(gesture.indexTip.normalized.y);
      }

      // === 6. MODO: CAPTURA (Encuadre foto de 2 manos o gesto foto sostenido) ===
      if (gesture.isPhotoFrame) {
        if (!photoGestureStartTime) {
          photoGestureStartTime = Date.now();
          photoCaptured = false;
        } else {
          const elapsed = Date.now() - photoGestureStartTime;
          if (elapsed >= PHOTO_HOLD_DURATION && !photoCaptured) {
            if (snapshotMgr) {
              const success = snapshotMgr.capture();
              if (success) photoCaptured = true;
            }
          }
        }
      } else {
        photoGestureStartTime = null;
        photoCaptured = false;
      }
    };
  } catch (err) {
    console.error('Error en setupGestureBindings:', err);
  }
}

// Lógica de Dwell Click para el HUD
function handleDwellClick(x, y) {
  const dwellPath = document.querySelector('.dwell-path');
  const target = document.elementFromPoint(x, y);

  // Buscar elemento interactivo en el DOM bajo el cursor
  const clickable = target ? target.closest('button, input[type="checkbox"], label') : null;

  if (clickable) {
    if (dwellTargetElement !== clickable) {
      dwellTargetElement = clickable;
      dwellStartTime = Date.now();
      clickable.classList.add('dwell-hover');
    } else {
      const elapsed = Date.now() - dwellStartTime;
      const progress = Math.min(1, elapsed / DWELL_DURATION);
      if (dwellPath) {
        dwellPath.style.strokeDashoffset = `${100 - (progress * 100)}`;
      }

      if (elapsed >= DWELL_DURATION) {
        clickable.click();
        dwellStartTime = Date.now() + 600; // Evita clics repetitivos inmediatos
        if (dwellPath) dwellPath.style.strokeDashoffset = '100';
      }
    }
  } else {
    if (dwellTargetElement) {
      dwellTargetElement.classList.remove('dwell-hover');
      dwellTargetElement = null;
    }
    dwellStartTime = null;
    if (dwellPath) dwellPath.style.strokeDashoffset = '100';
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

    // === 3. MODO: ACERCAR / ZOOM IN (Pinza continua) ===
    if (gestureTracker && gestureTracker.isPinching && sceneManager) {
      sceneManager.zoomInStep(0.04);
    }

    // === 4. MODO: ALEJAR / ZOOM OUT (Gesto "L" continuo) ===
    if (gestureTracker && gestureTracker.isGestureL && sceneManager) {
      sceneManager.zoomOutStep(0.04);
    }

    // Actualizar cursor 2D, etiquetas de modo e indicadores
    const cursor = document.getElementById('hand-cursor');
    const badge = document.getElementById('cursor-badge');
    const banner = document.getElementById('gesture-mode-banner');
    const mode = gestureTracker ? gestureTracker.currentGesture : 'MODO: LIBRE';

    if (banner) banner.textContent = mode;
    if (badge) badge.textContent = mode;

    const styleConfig = GESTURE_COLORS[mode] || GESTURE_COLORS['MODO: LIBRE'];

    if (cursor) {
      cursor.style.borderColor = styleConfig.border;
      cursor.style.boxShadow = `0 0 14px ${styleConfig.shadow}`;

      if (gestureTracker && gestureTracker.indexTip) {
        cursor.style.left = `${gestureTracker.indexTip.x}px`;
        cursor.style.top = `${gestureTracker.indexTip.y}px`;

        // Dwell Click solo en MODO: LIBRE
        if (gestureTracker.isOpenPalm) {
          handleDwellClick(gestureTracker.indexTip.x, gestureTracker.indexTip.y);
        } else {
          handleDwellClick(-999, -999);
        }
      }
    }

    // Smart Annotations Raycasting (solo en modo Libre o con ratón)
    if (annotationManager && annotationManager.enabled && sceneManager) {
      if (gestureTracker && gestureTracker.indexTip && gestureTracker.isOpenPalm) {
        annotationManager.update(gestureTracker.indexTip, sceneManager);
      } else if (isUsingMouse && mouseCoord) {
        annotationManager.update({ x: mouseCoord.x, y: mouseCoord.y }, sceneManager);
      }
    }
  } catch (err) {
    console.error('Error en bucle animate:', err);
  }
}

// Iniciar al cargar el DOM
window.addEventListener('DOMContentLoaded', init);
