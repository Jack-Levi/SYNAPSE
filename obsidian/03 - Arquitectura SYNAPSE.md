# Arquitectura SYNAPSE

## Capas de software

### Frontend / Lienzo 3D
- **Three.js** sobre HTML5 Canvas.
- Modelos en formato `.glb` / `.gltf`.
- Carpeta: `assets/models/`.

### IA / Visión Computacional
- **MediaPipe Hands** (ejecución local en el navegador, sin servidor).
- 21 puntos clave de la mano en tiempo real.
- Sin latencia de red.

### Lógica de gestos (JavaScript)
- Detección de pinza, puño, palma abierta, dos manos.
- Suavizado con Exponential Smoothing.
- Raycasting para selección de partes (Smart Annotations).

### Archivos clave
| Archivo | Responsabilidad |
|---------|-----------------|
| `js/main.js` | Orquestador y bucle principal |
| `js/gesture-tracking.js` | MediaPipe + detección de gestos |
| `js/three-scene.js` | Escena 3D, carga de modelos, clipping plane |
| `js/annotations.js` | Panel informativo y raycasting |
| `js/cross-section.js` | Corte transversal dinámico |
| `js/snapshot.js` | Captura de pantalla y galería |
| `css/styles.css` | Estilos base y puntero de partículas |
| `css/hud.css` | HUD ciberespacial, menú lateral, paneles |

## Función Extra #4 (pausada)
Control híbrido de iluminación con mano izquierda.
