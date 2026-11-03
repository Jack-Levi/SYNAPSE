// SYNAPSE — GestureTracker (MediaPipe Hands)
// Detecta 5 gestos específicos para el proyecto:
// 1. Captura (snapshot)
// 2. Mover libremente (puntero sigue la mano)
// 3. Puño → rotar
// 4. Pinza → zoom (acercar/alejar)
// 5. Gesto "L" → alejar

class GestureTracker {
  constructor() {
    this.video = document.getElementById('input_video');
    this.canvas = document.getElementById('output_canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hands = null;
    this.camera = null;

    // Estado de gestos
    this.indexTip = null;        // {x, y} en pantalla del dedo índice
    this.isPinching = false;     // pulgar + índice cerca (zoom)
    this.isFist = false;         // puño cerrado (rotar)
    this.isOpenPalm = false;     // palma abierta (mover libremente)
    this.isGestureL = false;     // gesto "L" (alejar)
    this.twoHandsDistance = null;// distancia entre manos (zoom alternativo)
    this.currentGesture = 'Ninguno'; // string descriptivo

    // Suavizado (Exponential Smoothing)
    this.smoothFactor = 0.2;
    this.prevIndex = { x: 0, y: 0 };

    // Timers para gestos sostenidos
    this.captureGestureStartTime = null;
    this.CAPTURE_HOLD_TIME = 1000; // ms para snapshot

    // Callbacks externos
    this.onGesture = null;
  }

  async init() {
    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
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

    if (results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks) => {
        drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS, {
          color: '#00f3ff',
          lineWidth: 2
        });
        drawLandmarks(this.ctx, landmarks, {
          color: '#ff00ff',
          lineWidth: 1
        });
      });
    }
    this.ctx.restore();

    this.processLandmarks(results.multiHandLandmarks);
  }

  processLandmarks(handsLandmarks) {
    // Reset estado
    this.indexTip = null;
    this.isPinching = false;
    this.isFist = false;
    this.isOpenPalm = false;
    this.isGestureL = false;
    this.twoHandsDistance = null;

    if (handsLandmarks.length === 0) {
      this.currentGesture = 'Ninguno';
      this.notify();
      return;
    }

    // Si hay dos manos, calcular distancia (zoom alternativo con pinza en cada mano)
    if (handsLandmarks.length === 2) {
      const h1 = handsLandmarks[0];
      const h2 = handsLandmarks[1];
      const p1 = h1[9];
      const p2 = h2[9];
      this.twoHandsDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      this.currentGesture = 'Dos manos (zoom)';
      this.notify();
      return;
    }

    // Procesar primera mano
    const hand = handsLandmarks[0];

    const indexTip = hand[8];
    const indexMCP = hand[5];
    const thumbTip = hand[4];
    const thumbMCP = hand[2];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];

    // Coordenadas de pantalla del índice (suavizado)
    const rawX = indexTip.x * window.innerWidth;
    const rawY = indexTip.y * window.innerHeight;

    this.prevIndex.x += (rawX - this.prevIndex.x) * this.smoothFactor;
    this.prevIndex.y += (rawY - this.prevIndex.y) * this.smoothFactor;

    this.indexTip = {
      x: this.prevIndex.x,
      y: this.prevIndex.y,
      normalized: indexTip
    };

    // --- DETECCIÓN DE GESTOS ---

    // 1. Pinza: pulgar e índice cerca (zoom)
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    this.isPinching = pinchDist < 0.05;

    // 2. Puño: dedos medio, anular, meñique cerca de la base de la palma (rotar)
    const fistDist =
      Math.hypot(middleTip.x - indexMCP.x, middleTip.y - indexMCP.y) +
      Math.hypot(ringTip.x - indexMCP.x, ringTip.y - indexMCP.y) +
      Math.hypot(pinkyTip.x - indexMCP.x, pinkyTip.y - indexMCP.y);
    this.isFist = fistDist < 0.25;

    // 3. Palma abierta: todos los dedos extendidos (mover libremente como mouse)
    this.isOpenPalm =
      indexTip.y < indexMCP.y &&
      middleTip.y < hand[9].y &&
      ringTip.y < hand[9].y &&
      pinkyTip.y < hand[9].y &&
      thumbTip.x < thumbMCP.x; // pulgar extendido hacia afuera

    // 4. Gesto "L": pulgar extendido horizontalmente + índice extendido verticalmente
    // El pulgar apunta a la derecha (o izquierda) y el índice hacia arriba
    const thumbExtended = Math.abs(thumbTip.x - thumbMCP.x) > 0.08;
    const indexExtendedUp = indexTip.y < indexMCP.y - 0.05;
    const otherFingersClosed =
      middleTip.y > indexMCP.y &&
      ringTip.y > indexMCP.y &&
      pinkyTip.y > indexMCP.y;
    this.isGestureL = thumbExtended && indexExtendedUp && otherFingersClosed;

    // --- DETERMINAR GESTO ACTIVO (prioridad) ---
    if (this.isGestureL) {
      this.currentGesture = 'L (alejar)';
    } else if (this.isPinching) {
      this.currentGesture = 'Pinza (zoom)';
    } else if (this.isFist) {
      this.currentGesture = 'Puño (rotar)';
    } else if (this.isOpenPalm) {
      this.currentGesture = 'Mover libremente';
    } else {
      this.currentGesture = 'Ninguno';
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
        twoHandsDistance: this.twoHandsDistance,
        currentGesture: this.currentGesture
      });
    }
  }

  // Métodos para snapshot (pinza sostenida)
  startCaptureGesture() {
    this.captureGestureStartTime = Date.now();
  }

  endCaptureGesture() {
    this.captureGestureStartTime = null;
  }

  isCaptureGestureActive() {
    return this.captureGestureStartTime !== null;
  }

  getCaptureElapsedTime() {
    if (!this.captureGestureStartTime) return 0;
    return Date.now() - this.captureGestureStartTime;
  }

  update(delta) {
    // Lógica adicional si se necesita
  }

  stop() {
    if (this.camera) this.camera.stop();
  }
}
