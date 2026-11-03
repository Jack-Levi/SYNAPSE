// SYNAPSE — GestureTracker (MediaPipe Hands)
// Gestos soportados:
// 1. Palma abierta       -> MODO: LIBRE (cursor, hover annotations, dwell click)
// 2. Puño cerrado        -> MODO: ROTAR (arrastrar 3D)
// 3. Pinza               -> MODO: ACERCAR / ZOOM IN (progresivo suave)
// 4. Gesto "L" (1 mano)  -> MODO: ALEJAR / ZOOM OUT (progresivo suave)
// 5. Dos dedos (paz)     -> MODO: CORTE RX (ajuste Y de corte)
// 6. Gesto Shaka / Llamada (🤙) -> MODO: CAPTURANDO... (snapshot sostenido 1s)
// 7. Dos manos abiertas  -> MODO: VISTA EXPLOTADA (separación relativa)

class GestureTracker {
  constructor() {
    this.video = document.getElementById('input_video');
    this.canvas = document.getElementById('output_canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.radarCanvas = document.getElementById('hand-radar-canvas');
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;
    this.hands = null;
    this.camera = null;

    this.indexTip = null;        // {x, y, normalized, rawNormalized}
    this.isPinching = false;
    this.isFist = false;
    this.isOpenPalm = false;
    this.isGestureL = false;
    this.isTwoFingers = false;
    this.isShaka = false;
    this.isTwoHandsExplode = false;
    this.explosionFactor = 0;
    this.twoHandsDistance = null;
    this.handsPoints = [];       // [{x, y}] para conectar en pantalla si 2 manos
    this.numHands = 0;
    this.currentGesture = 'MODO: LIBRE';

    this.smoothFactor = 0.25;
    this.prevIndex = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    this.onGesture = null;
  }

  async init() {
    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults((results) => this.onResults(results));

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        await this.hands.send({ image: this.video });
      },
      width: 640,
      height: 480
    });

    this.camera.start();
    if (this.canvas) {
      this.canvas.width = 640;
      this.canvas.height = 480;
    }
  }

  onResults(results) {
    const multiHands = results.multiHandLandmarks || [];
    this.numHands = multiHands.length;

    // Renderizar radar biométrico
    this.drawBiometricRadar(multiHands);

    // Procesar gestos
    this.processLandmarks(multiHands);
  }

  // Mini-Radar de esqueleto de mano sin vídeo real, estilo laboratorio
  drawBiometricRadar(multiHands) {
    if (!this.radarCtx || !this.radarCanvas) return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;

    // Fondo limpio oscuro
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(9, 13, 20, 0.95)';
    ctx.fillRect(0, 0, w, h);

    // Cuadrícula sutil de radar
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 20; x < w; x += 30) {
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let y = 15; y < h; y += 25) {
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Círculos concéntricos de radar
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 35, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
    ctx.stroke();

    // Actualizar cabecera de estado del radar
    const statusHeader = document.getElementById('radar-status-text');
    if (statusHeader) {
      if (multiHands.length === 0) {
        statusHeader.textContent = 'TRACKING: EN ESPERA...';
        statusHeader.style.color = '#94a3b8';
      } else if (multiHands.length === 1) {
        statusHeader.textContent = 'TRACKING BIOMÉTRICO: ACTIVO (1 MANO)';
        statusHeader.style.color = '#38bdf8';
      } else {
        statusHeader.textContent = 'TRACKING BIOMÉTRICO: ACTIVO (2 MANOS)';
        statusHeader.style.color = '#38bdf8';
      }
    }

    if (multiHands.length === 0) {
      // Cruz central tenue
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.beginPath();
      ctx.moveTo(w / 2 - 12, h / 2); ctx.lineTo(w / 2 + 12, h / 2);
      ctx.moveTo(w / 2, h / 2 - 12); ctx.lineTo(w / 2, h / 2 + 12);
      ctx.stroke();
      return;
    }

    const tipIndices = [4, 8, 12, 16, 20];
    const tipColor = this.getGestureColor();

    multiHands.forEach(hand => {
      // 1. Dibujar conexiones esqueléticas
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const p1 = hand[startIdx];
        const p2 = hand[endIdx];
        // Invertir X para modo espejo natural
        const x1 = (1 - p1.x) * (w - 30) + 15;
        const y1 = p1.y * (h - 25) + 12;
        const x2 = (1 - p2.x) * (w - 30) + 15;
        const y2 = p2.y * (h - 25) + 12;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      });
      ctx.stroke();

      // 2. Dibujar 21 nodos (landmarks)
      hand.forEach((p, idx) => {
        const x = (1 - p.x) * (w - 30) + 15;
        const y = p.y * (h - 25) + 12;

        ctx.beginPath();
        if (tipIndices.includes(idx)) {
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = tipColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    });
  }

  getGestureColor() {
    if (this.isShaka) return '#f59e0b';
    if (this.isFist) return '#ef4444';
    if (this.isPinching) return '#10b981';
    if (this.isGestureL) return '#a855f7';
    if (this.isTwoFingers) return '#06b6d4';
    if (this.isTwoHandsExplode) return '#38bdf8';
    return '#38bdf8';
  }

  // Detecta el gesto de la llamada / Shaka (🤙)
  checkHandShaka(hand) {
    const wrist = hand[0];
    const thumbTip = hand[4];
    const thumbMCP = hand[2];
    const indexMCP = hand[5];
    const palmCenter = hand[9];
    const indexTip = hand[8];
    const indexPIP = hand[6];
    const middleTip = hand[12];
    const middlePIP = hand[10];
    const ringTip = hand[16];
    const ringPIP = hand[14];
    const pinkyTip = hand[20];
    const pinkyPIP = hand[18];

    // 1. Pulgar extendido (punta alejada de MCP, de indexMCP y del centro de la palma)
    const thumbExtended = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y) > 0.12 &&
                          Math.hypot(thumbTip.x - palmCenter.x, thumbTip.y - palmCenter.y) > 0.13;

    // 2. Meñique extendido (punta más lejos de la muñeca que su articulación PIP)
    const pinkyExtended = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) >
                          Math.hypot(pinkyPIP.x - wrist.x, pinkyPIP.y - wrist.y) * 1.15;

    // 3. Índice, medio y anular doblados/cerrados hacia la palma/muñeca
    const indexFolded = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) <
                        Math.hypot(indexMCP.x - wrist.x, indexMCP.y - wrist.y) * 1.35;
    const middleFolded = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) <
                         Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y) * 1.35;
    const ringFolded = Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) <
                       Math.hypot(hand[13].x - wrist.x, hand[13].y - wrist.y) * 1.35;

    return thumbExtended && pinkyExtended && indexFolded && middleFolded && ringFolded;
  }

  // Detecta si una mano individual forma una 'L'
  checkHandL(hand) {
    const thumbTip = hand[4];
    const thumbMCP = hand[2];
    const indexTip = hand[8];
    const indexMCP = hand[5];
    const middleTip = hand[12];
    const middlePIP = hand[10];
    const ringTip = hand[16];
    const ringPIP = hand[14];
    const pinkyTip = hand[20];
    const pinkyPIP = hand[18];
    const wrist = hand[0];

    const thumbSpread = Math.hypot(thumbTip.x - thumbMCP.x, thumbTip.y - thumbMCP.y) > 0.11;
    const indexExtended = (indexMCP.y - indexTip.y) > 0.07;
    const middleClosed = middleTip.y > middlePIP.y || Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < Math.hypot(indexMCP.x - wrist.x, indexMCP.y - wrist.y);
    const ringClosed = ringTip.y > ringPIP.y;
    const pinkyClosed = pinkyTip.y > pinkyPIP.y;
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

    return thumbSpread && indexExtended && middleClosed && ringClosed && pinkyClosed && pinchDist > 0.08;
  }

  processLandmarks(handsLandmarks) {
    this.indexTip = null;
    this.isPinching = false;
    this.isFist = false;
    this.isOpenPalm = false;
    this.isGestureL = false;
    this.isTwoFingers = false;
    this.isShaka = false;
    this.isTwoHandsExplode = false;
    this.twoHandsDistance = null;
    this.handsPoints = [];

    if (!handsLandmarks || handsLandmarks.length === 0) {
      this.currentGesture = 'Sin mano detectada';
      this.notify();
      return;
    }

    // Guardar puntos 2D en pantalla de cada mano
    handsLandmarks.forEach(h => {
      const p = h[9]; // centro palma
      this.handsPoints.push({
        x: (1 - p.x) * window.innerWidth,
        y: p.y * window.innerHeight
      });
    });

    // Mano principal de puntero (usamos la primera)
    const primaryHand = handsLandmarks[0];
    const indexTip = primaryHand[8];
    const rawX = (1 - indexTip.x) * window.innerWidth;
    const rawY = indexTip.y * window.innerHeight;

    // Suavizado exponencial (lerp)
    this.prevIndex.x += (rawX - this.prevIndex.x) * this.smoothFactor;
    this.prevIndex.y += (rawY - this.prevIndex.y) * this.smoothFactor;

    this.indexTip = {
      x: this.prevIndex.x,
      y: this.prevIndex.y,
      rawNormalized: indexTip,
      normalized: {
        x: (1 - indexTip.x),
        y: indexTip.y
      }
    };

    // --- 1. REVISIÓN VISTA EXPLOTADA (2 MANOS EN PANTALLA) ---
    if (handsLandmarks.length >= 2) {
      const h1 = handsLandmarks[0];
      const h2 = handsLandmarks[1];
      const p1 = h1[9]; // centro palma mano 1
      const p2 = h2[9]; // centro palma mano 2
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      this.twoHandsDistance = dist;

      // Ambas palmas abiertas o no-puño
      const h1NotFist = h1[8].y < h1[6].y || h1[12].y < h1[10].y;
      const h2NotFist = h2[8].y < h2[6].y || h2[12].y < h2[10].y;

      if (h1NotFist && h2NotFist) {
        this.isTwoHandsExplode = true;
        // Mapear dist (0.18 a 0.65) a 0.0 - 1.0
        const factor = THREE.MathUtils.clamp((dist - 0.18) / (0.65 - 0.18), 0, 1);
        this.explosionFactor = factor;
        const pct = Math.round(factor * 100);
        this.currentGesture = `MODO: VISTA EXPLOTADA (2 Manos) — ${pct}%`;
        this.notify();
        return;
      }
    }

    // Análisis de la mano principal (1 mano)
    const hand = primaryHand;
    const thumbTip = hand[4];
    const indexPIP = hand[6];
    const indexMCP = hand[5];
    const middleTip = hand[12];
    const middlePIP = hand[10];
    const ringTip = hand[16];
    const ringPIP = hand[14];
    const pinkyTip = hand[20];
    const pinkyPIP = hand[18];
    const wrist = hand[0];

    // GESTO SHAKA (🤙)
    if (this.checkHandShaka(hand)) {
      this.isShaka = true;
      this.currentGesture = 'MODO: CAPTURANDO...';
      this.notify();
      return;
    }

    // PINZA: Pulgar e índice juntos (< 0.05 en distancia normalizada)
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y, thumbTip.z - indexTip.z);
    const isPinchingCandidate = pinchDist < 0.055;

    // DOS DEDOS (Tijera / Paz): Índice y medio extendidos juntos, anular y meñique doblados
    const indexUp = indexTip.y < indexPIP.y && indexPIP.y < indexMCP.y;
    const middleUp = middleTip.y < middlePIP.y && middlePIP.y < hand[9].y;
    const ringDown = ringTip.y > ringPIP.y;
    const pinkyDown = pinkyTip.y > pinkyPIP.y;
    const fingersNearEachOther = Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y) < 0.09;
    const isTwoFingersCandidate = indexUp && middleUp && ringDown && pinkyDown && fingersNearEachOther && pinchDist > 0.07;

    // GESTO "L": Pulgar extendido horizontalmente, índice vertical, otros 3 doblados
    const isLCandidate = this.checkHandL(hand);

    // PUÑO CERRADO: Todos los dedos doblados hacia la palma
    const allFolded =
      indexTip.y > indexPIP.y &&
      middleTip.y > middlePIP.y &&
      ringTip.y > ringPIP.y &&
      pinkyTip.y > pinkyPIP.y;
    const fistProximity =
      Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) < 0.28 &&
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.28;
    const isFistCandidate = allFolded || fistProximity;

    // PALMA ABIERTA
    const isOpenPalmCandidate =
      indexTip.y < indexPIP.y &&
      middleTip.y < middlePIP.y &&
      ringTip.y < ringPIP.y &&
      pinkyTip.y < pinkyPIP.y &&
      pinchDist > 0.09;

    // Asignación estricta por prioridad
    if (isPinchingCandidate) {
      this.isPinching = true;
      this.currentGesture = 'MODO: ACERCAR / ZOOM IN';
    } else if (isTwoFingersCandidate) {
      this.isTwoFingers = true;
      this.currentGesture = 'MODO: CORTE RX';
    } else if (isLCandidate) {
      this.isGestureL = true;
      this.currentGesture = 'MODO: ALEJAR / ZOOM OUT';
    } else if (isFistCandidate) {
      this.isFist = true;
      this.currentGesture = 'MODO: ROTAR';
    } else if (isOpenPalmCandidate) {
      this.isOpenPalm = true;
      this.currentGesture = 'MODO: LIBRE';
    } else {
      this.isOpenPalm = true;
      this.currentGesture = 'MODO: LIBRE';
    }

    this.notify();
  }

  notify() {
    if (this.onGesture) {
      this.onGesture({
        indexTip: this.indexTip,
        isPinching: this.isPinching,
        isFist: this.isFist,
        isOpenPalm: this.isOpenPalm,
        isGestureL: this.isGestureL,
        isTwoFingers: this.isTwoFingers,
        isShaka: this.isShaka,
        isTwoHandsExplode: this.isTwoHandsExplode,
        explosionFactor: this.explosionFactor,
        twoHandsDistance: this.twoHandsDistance,
        handsPoints: this.handsPoints,
        numHands: this.numHands,
        currentGesture: this.currentGesture
      });
    }
  }

  update(delta) {}
  stop() { if (this.camera) this.camera.stop(); }
}
