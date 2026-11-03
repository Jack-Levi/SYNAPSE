// SYNAPSE — Orquestador principal

let sceneManager, gestureTracker, annotationManager, crossSection, snapshotMgr;
let lastTime = 0;
let initError = null;

// Control de captura Shaka (🤙) sostenida
let shakaGestureStartTime = null;
const SHAKA_HOLD_DURATION = 1000;
let shakaCaptured = false;

// Coordenadas para fallback con ratón si no hay mano
let mouseCoord = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let isUsingMouse = true;

// Sistema de Dwell Click (clic por permanencia de 800 ms)
let dwellTargetElement = null;
let dwellStartTime = null;
const DWELL_DURATION = 800;

// Variables de FPS y Telemetría
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 60;

// Paleta de colores para cada modo de gesto
const GESTURE_COLORS = {
  'MODO: LIBRE': { border: '#38bdf8', shadow: 'rgba(56, 189, 248, 0.8)' },
  'MODO: ROTAR': { border: '#ef4444', shadow: 'rgba(239, 68, 68, 0.8)' },
  'MODO: ACERCAR / ZOOM IN': { border: '#10b981', shadow: 'rgba(16, 185, 129, 0.8)' },
  'MODO: ALEJAR / ZOOM OUT': { border: '#a855f7', shadow: 'rgba(168, 85, 247, 0.8)' },
  'MODO: CORTE RX': { border: '#06b6d4', shadow: 'rgba(6, 182, 212, 0.8)' },
  'MODO: CAPTURANDO...': { border: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.95)' },
  'Sin mano detectada': { border: '#64748b', shadow: 'rgba(100, 116, 139, 0.5)' }
};

async function init() {
  try {
    // 1. Escena 3D
    sceneManager = new SceneManager();
    await sceneManager.init();
    window.sceneManager = sceneManager;

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
    const toggleExp = document.getElementById('toggle-exploded');

    envBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        envBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const env = btn.dataset.env;
        if (sceneManager) sceneManager.loadEnvironment(env);
        if (annotationManager) annotationManager.setEnvironment(env);
        if (toggleExp) toggleExp.checked = false;
      });
    });

    if (toggleCS) {
      toggleCS.checked = false;
      toggleCS.addEventListener('change', (e) => {
        if (crossSection) crossSection.setEnabled(e.target.checked);
      });
    }

    if (toggleAnn) {
      toggleAnn.addEventListener('change', (e) => {
        if (annotationManager) annotationManager.setEnabled(e.target.checked);
      });
    }

    if (toggleExp) {
      toggleExp.checked = false;
      toggleExp.addEventListener('change', (e) => {
        if (sceneManager) sceneManager.setExplosionFactor(e.target.checked ? 0.75 : 0.0);
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

      // === 7. MODO: VISTA EXPLOTADA (2 Manos) ===
      if (gesture.isTwoHandsExplode) {
        sceneManager.setExplosionFactor(gesture.explosionFactor);
        if (toggleExp) toggleExp.checked = gesture.explosionFactor > 0.05;
      }

      // === 6. GESTO SHAKA (🤙): Captura con anillo de 1s y cooldown 5s ===
      if (gesture.isShaka) {
        if (!shakaGestureStartTime) {
          shakaGestureStartTime = Date.now();
          shakaCaptured = false;
        } else {
          const elapsed = Date.now() - shakaGestureStartTime;
          const dwellPath = document.querySelector('.dwell-path');
          const progress = Math.min(1, elapsed / SHAKA_HOLD_DURATION);
          if (dwellPath) {
            dwellPath.style.stroke = '#f59e0b';
            dwellPath.style.strokeDashoffset = `${100 - (progress * 100)}`;
          }

          if (elapsed >= SHAKA_HOLD_DURATION && !shakaCaptured) {
            if (snapshotMgr && snapshotMgr.canCapture()) {
              const success = snapshotMgr.capture();
              if (success) {
                shakaCaptured = true;
                if (dwellPath) dwellPath.style.strokeDashoffset = '100';
              }
            }
          }
        }
      } else {
        shakaGestureStartTime = null;
        shakaCaptured = false;
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
        dwellPath.style.stroke = '#38bdf8';
        dwellPath.style.strokeDashoffset = `${100 - (progress * 100)}`;
      }

      if (elapsed >= DWELL_DURATION) {
        clickable.click();
        dwellStartTime = Date.now() + 600;
        if (dwellPath) dwellPath.style.strokeDashoffset = '100';
      }
    }
  } else {
    if (dwellTargetElement) {
      dwellTargetElement.classList.remove('dwell-hover');
      dwellTargetElement = null;
    }
    dwellStartTime = null;
    if (dwellPath && (!gestureTracker || !gestureTracker.isShaka)) {
      dwellPath.style.stroke = '#38bdf8';
      dwellPath.style.strokeDashoffset = '100';
    }
  }
}

// Actualiza los valores de la barra inferior de telemetría científica
function updateTelemetry(now) {
  // 1. Contador de FPS
  frameCount++;
  if (now - lastFpsUpdate >= 1000) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    frameCount = 0;
    lastFpsUpdate = now;
    const fpsElem = document.getElementById('tel-fps');
    if (fpsElem) fpsElem.textContent = `${currentFps} FPS`;
  }

  if (!sceneManager || !sceneManager.camera || !sceneManager.currentModel) return;

  // 2. Zoom actual
  const camDist = sceneManager.camera.position.length();
  const zoomFactor = (6.0 / Math.max(0.1, camDist)).toFixed(2);
  const zoomElem = document.getElementById('tel-zoom');
  if (zoomElem) zoomElem.textContent = `${zoomFactor}x`;

  // 3. Rotación en grados
  const rotX = Math.round(THREE.MathUtils.radToDeg(sceneManager.currentModel.rotation.x) % 360);
  const rotY = Math.round(THREE.MathUtils.radToDeg(sceneManager.currentModel.rotation.y) % 360);
  const rotElem = document.getElementById('tel-rot');
  if (rotElem) rotElem.textContent = `X ${rotX}° | Y ${rotY}°`;

  // 4. Explosión
  const expPct = Math.round((sceneManager.explosionFactor || 0) * 100);
  const expElem = document.getElementById('tel-exp');
  if (expElem) expElem.textContent = `${expPct}%`;

  // 5. Corte RX
  const rxElem = document.getElementById('tel-rx');
  if (rxElem) {
    if (crossSection && crossSection.enabled) {
      const rxVal = (crossSection.currentConstant || 0).toFixed(1);
      rxElem.textContent = `ACTIVO (${rxVal})`;
      rxElem.style.color = '#06b6d4';
    } else {
      rxElem.textContent = 'OFF';
      rxElem.style.color = '#94a3b8';
    }
  }

  // 6. Escala física dinámica
  const scaleTextElem = document.getElementById('tel-scale-text');
  if (scaleTextElem) {
    const env = sceneManager.currentEnv || 'celula';
    const numZoom = parseFloat(zoomFactor);
    if (env === 'celula') {
      const val = (10 / numZoom).toFixed(1);
      scaleTextElem.textContent = `${val} μm`;
    } else if (env === 'motor') {
      const val = (15 / numZoom).toFixed(1);
      scaleTextElem.textContent = `${val} cm`;
    } else {
      const val = Math.round(2500 / numZoom);
      scaleTextElem.textContent = `${val.toLocaleString()} km`;
    }
  }
}

// Dibuja línea punteada entre 2 manos si están en vista explotada
function updateTwoHandsLine() {
  const svg = document.getElementById('two-hands-line-svg');
  if (!svg) return;

  if (gestureTracker && gestureTracker.isTwoHandsExplode && gestureTracker.handsPoints.length >= 2) {
    svg.style.display = 'block';
    const p1 = gestureTracker.handsPoints[0];
    const p2 = gestureTracker.handsPoints[1];

    const line = document.getElementById('two-hands-line');
    const c1 = document.getElementById('two-hands-c1');
    const c2 = document.getElementById('two-hands-c2');

    if (line) {
      line.setAttribute('x1', p1.x);
      line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x);
      line.setAttribute('y2', p2.y);
    }
    if (c1) { c1.setAttribute('cx', p1.x); c1.setAttribute('cy', p1.y); }
    if (c2) { c2.setAttribute('cx', p2.x); c2.setAttribute('cy', p2.y); }
  } else {
    svg.style.display = 'none';
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

    // Zoom continuo por gesto
    if (gestureTracker && gestureTracker.isPinching && sceneManager) {
      sceneManager.zoomInStep(0.04);
    }
    if (gestureTracker && gestureTracker.isGestureL && sceneManager) {
      sceneManager.zoomOutStep(0.04);
    }

    // Actualizar proyección 3D a 2D de Callouts / Pines
    if (annotationManager && sceneManager) {
      annotationManager.updateCallouts(sceneManager);
    }

    // Actualizar cursor 2D, etiquetas de modo e indicadores
    const cursor = document.getElementById('hand-cursor');
    const badge = document.getElementById('cursor-badge');
    const banner = document.getElementById('gesture-mode-banner');
    const mode = gestureTracker ? gestureTracker.currentGesture : 'MODO: LIBRE';

    if (banner) banner.textContent = mode;
    if (badge) badge.textContent = mode;

    let styleKey = mode;
    if (mode.startsWith('MODO: VISTA EXPLOTADA')) styleKey = 'MODO: LIBRE';
    const styleConfig = GESTURE_COLORS[styleKey] || GESTURE_COLORS['MODO: LIBRE'];

    if (cursor) {
      cursor.style.borderColor = styleConfig.border;
      cursor.style.boxShadow = `0 0 14px ${styleConfig.shadow}`;

      if (gestureTracker && gestureTracker.indexTip) {
        cursor.style.left = `${gestureTracker.indexTip.x}px`;
        cursor.style.top = `${gestureTracker.indexTip.y}px`;

        if (gestureTracker.isOpenPalm) {
          handleDwellClick(gestureTracker.indexTip.x, gestureTracker.indexTip.y);
        } else if (!gestureTracker.isShaka) {
          handleDwellClick(-999, -999);
        }
      }
    }

    // Smart Annotations: Proximidad de Imán y Hover (solo en modo libre o con ratón)
    if (annotationManager && annotationManager.enabled && sceneManager) {
      if (gestureTracker && gestureTracker.indexTip && gestureTracker.isOpenPalm) {
        annotationManager.update(gestureTracker.indexTip, sceneManager);
      } else if (isUsingMouse && mouseCoord) {
        annotationManager.update({ x: mouseCoord.x, y: mouseCoord.y }, sceneManager);
      }
    }

    // Actualizar línea de conexión visual de 2 manos
    updateTwoHandsLine();

    // Actualizar telemetría científica en tiempo real
    updateTelemetry(now);

  } catch (err) {
    console.error('Error en bucle animate:', err);
  }
}

// Iniciar al cargar el DOM
window.addEventListener('DOMContentLoaded', init);
