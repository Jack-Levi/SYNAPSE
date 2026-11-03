// SYNAPSE — GestureTracker (MediaPipe Hands)
// Detecta 5 gestos específicos:
// 1. Palma abierta → mover libremente (cursor)
// 2. Puño cerrado → rotar
// 3. Pinza → zoom
// 4. Gesto "L" → alejar / reset zoom
// 5. Pinza sostenida → snapshot

class GestureTracker {
  constructor() {
    this.video = document.getElementById('input_video');
    this.canvas = document.getElementById('output_canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hands = null;
    this.camera = null;

    this.indexTip = null;        // {x, y} pantalla, normalized {x,y,z}
    this.isPinching = false;
    this.isFist = false;
    this.isOpenPalm = false;
    this.isGestureL = false;
    this.twoHandsDistance = null;
    this.currentGesture = 'Ninguno';

    this.smoothFactor = 0.2;
    this.prevIndex = { x: 0, y: 0 };

    this.captureGestureStartTime = null;
    this.CAPTURE_HOLD_TIME = 1000;

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

    if (results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks) => {
        drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS, {
          color: '#22d3ee',
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

  processLandmarks(handsLandmarks) {
    this.indexTip = null;
    this.isPinching = false;
    this.isFist = false;
    this.isOpenPalm = false;
    this.isGestureL = false;
    this.twoHandsDistance = null;

    if (!handsLandmarks || handsLandmarks.length === 0) {
      this.currentGesture = 'Ninguno';
      this.notify();
      return;
    }

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

    const hand = handsLandmarks[0];
    const indexTip = hand[8];
    const indexPIP = hand[6];
    const indexMCP = hand[5];
    const thumbTip = hand[4];
    const thumbMCP = hand[2];
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

    // Invertir eje X por efecto espejo de la cámara
    const rawX = (1 - indexTip.x) * window.innerWidth;
    const rawY = indexTip.y * window.innerHeight;

    // Suavizado exponencial (lerp)
    this.prevIndex.x += (rawX - this.prevIndex.x) * this.smoothFactor;
    this.prevIndex.y += (rawY - this.prevIndex.y) * this.smoothFactor;

    this.indexTip = {
      x: this.prevIndex.x,
      y: this.prevIndex.y,
      rawNormalized: indexTip, // Landmark original de MediaPipe
      normalized: {
        x: (1 - indexTip.x),
        y: indexTip.y
      }
    };

    // 1. Distancia de pinza (pulgar e índice) en espacio normalizado 3D/2D
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y, thumbTip.z - indexTip.z);
    this.isPinching = pinchDist < 0.07;

    // 2. Puño cerrado: todos los dedos flexionados hacia la palma / muñeca
    const fingersFolded =
      middleTip.y > middlePIP.y &&
      ringTip.y > ringPIP.y &&
      pinkyTip.y > pinkyPIP.y &&
      indexTip.y > indexPIP.y;
    const fistCompactness =
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) <
      Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y) * 1.35;
    this.isFist = fingersFolded || fistCompactness;

    // 3. Gesto "L": pulgar extendido lateralmente, índice extendido hacia arriba, y los otros 3 cerrados
    const thumbExtended = Math.hypot(thumbTip.x - thumbMCP.x, thumbTip.y - thumbMCP.y) > 0.12;
    const indexExtended = (indexMCP.y - indexTip.y) > 0.08;
    const middleClosed = middleTip.y > middlePIP.y || Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y);
    const ringClosed = ringTip.y > ringPIP.y || Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < Math.hypot(ringMCP.x - wrist.x, ringMCP.y - wrist.y);
    const pinkyClosed = pinkyTip.y > pinkyPIP.y || Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < Math.hypot(pinkyMCP.x - wrist.x, pinkyMCP.y - wrist.y);
    this.isGestureL = thumbExtended && indexExtended && middleClosed && ringClosed && pinkyClosed && !this.isPinching;

    // 4. Palma abierta: todos los dedos extendidos y separados
    const indexOpen = indexTip.y < indexPIP.y;
    const middleOpen = middleTip.y < middlePIP.y;
    const ringOpen = ringTip.y < ringPIP.y;
    const pinkyOpen = pinkyTip.y < pinkyPIP.y;
    this.isOpenPalm = indexOpen && middleOpen && ringOpen && pinkyOpen && !this.isPinching;

    if (this.isGestureL) {
      this.currentGesture = 'Gesto L (reset zoom)';
    } else if (this.isPinching) {
      this.currentGesture = 'Pinza (zoom / snapshot)';
    } else if (this.isFist) {
      this.currentGesture = 'Puño (rotar)';
    } else if (this.isOpenPalm) {
      this.currentGesture = 'Palma abierta (mover)';
    } else {
      this.currentGesture = 'Detectando...';
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

  startCaptureGesture() { this.captureGestureStartTime = Date.now(); }
  endCaptureGesture() { this.captureGestureStartTime = null; }
  isCaptureGestureActive() { return this.captureGestureStartTime !== null; }
  getCaptureElapsedTime() { return this.captureGestureStartTime ? Date.now() - this.captureGestureStartTime : 0; }

  update(delta) {}
  stop() { if (this.camera) this.camera.stop(); }
}
