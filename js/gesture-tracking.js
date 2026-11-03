// SYNAPSE — GestureTracker (MediaPipe Hands)
// Detecta coordenadas de la mano, gestos (pinza, puño, dos manos, palma abierta)
// y expone la punta del índice para el puntero de partículas.

class GestureTracker {
  constructor() {
    this.video = document.getElementById('input_video');
    this.canvas = document.getElementById('output_canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hands = null;
    this.camera = null;

    // Estado de gestos
    this.indexTip = null;        // {x, y} en pantalla del dedo índice
    this.isPinching = false;     // pulgar + índice cerca
    this.isFist = false;         // puño cerrado
    this.isOpenPalm = false;     // palma abierta
    this.twoHandsDistance = null;// distancia entre manos (para zoom)
    this.currentGesture = 'Ninguno'; // string descriptivo del gesto activo

    // Suavizado (Exponential Smoothing)
    this.smoothFactor = 0.2;
    this.prevIndex = { x: 0, y: 0 };

    // Callbacks externos
    this.onGesture = null;
  }

  async init() {
    // Configurar MediaPipe Hands
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

    // Iniciar cámara
    this.camera = new Camera(this.video, {
      onFrame: async () => {
        await this.hands.send({ image: this.video });
      },
      width: 640,
      height: 480
    });

    this.camera.start();

    // Ajustar canvas al video
    this.canvas.width = 640;
    this.canvas.height = 480;
  }

  onResults(results) {
    // Dibujar landmarks en canvas oculto (opcional, para depuración)
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
    this.twoHandsDistance = null;

    if (handsLandmarks.length === 0) return;

    // Si hay dos manos, calcular distancia entre ellas (zoom)
    if (handsLandmarks.length === 2) {
      const h1 = handsLandmarks[0];
      const h2 = handsLandmarks[1];
      const p1 = h1[9]; // medio de la mano 1
      const p2 = h2[9]; // medio de la mano 2
      this.twoHandsDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    // Procesar primera mano para gestos principales
    const hand = handsLandmarks[0];

    // Índice: punta (8), base (5)
    const indexTip = hand[8];
    const indexMCP = hand[5];

    // Pulgar: punta (4)
    const thumbTip = hand[4];

    // Otros dedos para detectar puño / palma abierta
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
      normalized: indexTip // {x, y, z} en [0,1]
    };

    // Detectar pinza: distancia entre pulgar e índice pequeña
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    this.isPinching = pinchDist < 0.05;

    // Detectar puño: puntas de dedos cercanas a la base de la palma
    const fistDist =
      Math.hypot(middleTip.x - indexMCP.x, middleTip.y - indexMCP.y) +
      Math.hypot(ringTip.x - indexMCP.x, ringTip.y - indexMCP.y) +
      Math.hypot(pinkyTip.x - indexMCP.x, pinkyTip.y - indexMCP.y);
    this.isFist = fistDist < 0.25;

    // Detectar palma abierta: dedos extendidos (y de índice mayor que de pulgar)
    this.isOpenPalm =
      indexTip.y < indexMCP.y &&
      middleTip.y < hand[9].y &&
      ringTip.y < hand[9].y &&
      pinkyTip.y < hand[9].y;

    // Determinar gesto activo como string
    if (handsLandmarks.length === 2) {
      this.currentGesture = 'Dos manos (zoom)';
    } else if (this.isPinching) {
      this.currentGesture = 'Pinza (agarrar/rotar)';
    } else if (this.isFist) {
      this.currentGesture = 'Puño (rotar)';
    } else if (this.isOpenPalm) {
      this.currentGesture = 'Palma abierta (pausar)';
    } else {
      this.currentGesture = 'Ninguno';
    }

    // Notificar callback si existe
    if (this.onGesture) {
      this.onGesture({
        indexTip: this.indexTip,
        isPinching: this.isPinching,
        isFist: this.isFist,
        isOpenPalm: this.isOpenPalm,
        twoHandsDistance: this.twoHandsDistance,
        currentGesture: this.currentGesture
      });
    }
  }

  update(delta) {
    // Aquí podría ir lógica adicional de filtrado temporal
  }

  stop() {
    if (this.camera) this.camera.stop();
  }
}
