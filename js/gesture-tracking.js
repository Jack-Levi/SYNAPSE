// SYNAPSE — GestureTracker (MediaPipe Hands)
// 6 Gestos específicos y aislados:
// 1. Palma abierta       -> MODO: LIBRE (cursor, hover annotations, dwell click)
// 2. Puño cerrado        -> MODO: ROTAR (arrastrar 3D)
// 3. Pinza               -> MODO: ACERCAR / ZOOM IN (progresivo suave)
// 4. Gesto "L" (1 mano)  -> MODO: ALEJAR / ZOOM OUT (progresivo suave)
// 5. Dos dedos (paz)     -> MODO: CORTE RX (ajuste Y de corte)
// 6. Gesto Foto          -> MODO: CAPTURA (2 manos con encuadre L / 1 mano sostenida)

class GestureTracker {
  constructor() {
    this.video = document.getElementById('input_video');
    this.canvas = document.getElementById('output_canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hands = null;
    this.camera = null;

    this.indexTip = null;        // {x, y, normalized, rawNormalized}
    this.isPinching = false;
    this.isFist = false;
    this.isOpenPalm = false;
    this.isGestureL = false;
    this.isTwoFingers = false;
    this.isPhotoFrame = false;
    this.twoHandsDistance = null;
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
    this.canvas.width = 640;
    this.canvas.height = 480;
  }

  onResults(results) {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks) => {
        drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS, {
          color: '#38bdf8',
          lineWidth: 2
        });
        drawLandmarks(this.ctx, landmarks, {
          color: '#f8fafc',
          lineWidth: 1
        });
      });
    }
    this.ctx.restore();

    this.processLandmarks(results.multiHandLandmarks);
  }

  // Detecta si una mano individual forma una 'L' (pulgar + índice extendidos perpendicularmente, resto doblados)
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
    this.isPhotoFrame = false;
    this.twoHandsDistance = null;

    if (!handsLandmarks || handsLandmarks.length === 0) {
      this.currentGesture = 'Sin mano detectada';
      this.notify();
      return;
    }

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

    // --- REVISIÓN GESTO FOTO / ENCUADRE DE 2 MANOS ---
    if (handsLandmarks.length >= 2) {
      const h1 = handsLandmarks[0];
      const h2 = handsLandmarks[1];
      const h1IsL = this.checkHandL(h1);
      const h2IsL = this.checkHandL(h2);

      // Si ambas manos hacen L (formando el visor fotográfico rectangular)
      if (h1IsL && h2IsL) {
        this.isPhotoFrame = true;
        this.currentGesture = 'MODO: CAPTURA';
        this.notify();
        return;
      }
    }

    // Análisis de la mano principal
    const hand = primaryHand;
    const thumbTip = hand[4];
    const thumbIP = hand[3];
    const thumbMCP = hand[2];
    const indexPIP = hand[6];
    const indexMCP = hand[5];
    const middleTip = hand[12];
    const middlePIP = hand[10];
    const middleMCP = hand[9];
    const ringTip = hand[16];
    const ringPIP = hand[14];
    const ringMCP = hand[13];
    const pinkyTip = hand[20];
    const pinkyPIP = hand[18];
    const pinkyMCP = hand[17];
    const wrist = hand[0];

    // 1. PINZA: Pulgar e índice juntos (< 0.05 en distancia normalizada)
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y, thumbTip.z - indexTip.z);
    const isPinchingCandidate = pinchDist < 0.055;

    // 2. DOS DEDOS (Tijera / Paz): Índice y medio extendidos juntos, anular y meñique doblados
    const indexUp = indexTip.y < indexPIP.y && indexPIP.y < indexMCP.y;
    const middleUp = middleTip.y < middlePIP.y && middlePIP.y < middleMCP.y;
    const ringDown = ringTip.y > ringPIP.y;
    const pinkyDown = pinkyTip.y > pinkyPIP.y;
    const fingersNearEachOther = Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y) < 0.09;
    const isTwoFingersCandidate = indexUp && middleUp && ringDown && pinkyDown && fingersNearEachOther && pinchDist > 0.07;

    // 3. GESTO "L": Pulgar extendido horizontalmente, índice vertical, otros 3 doblados
    const isLCandidate = this.checkHandL(hand);

    // 4. PUÑO CERRADO: Todos los dedos doblados hacia la palma
    const allFolded =
      indexTip.y > indexPIP.y &&
      middleTip.y > middlePIP.y &&
      ringTip.y > ringPIP.y &&
      pinkyTip.y > pinkyPIP.y;
    const fistProximity =
      Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) < 0.28 &&
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.28;
    const isFistCandidate = allFolded || fistProximity;

    // 5. PALMA ABIERTA: Todos los dedos extendidos y abiertos
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
      // Estado libre por defecto
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
        isPhotoFrame: this.isPhotoFrame,
        twoHandsDistance: this.twoHandsDistance,
        currentGesture: this.currentGesture
      });
    }
  }

  update(delta) {}
  stop() { if (this.camera) this.camera.stop(); }
}
