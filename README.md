# SYNAPSE — Laboratorio Científico Futurista

Plataforma web interactiva para visualizar, manipular e inspeccionar modelos tridimensionales complejos mediante **gestos en el aire** y **Inteligencia Artificial / Visión Computacional**, sin teclado ni ratón.

## Modelos 3D incluidos

1. **Motor Mecánico** — Rotación libre, corte transversal de cilindros, anotaciones de pistón, biela, cigüeñal.
2. **Célula Biológica** — Exploración de orgánulos (mitocondria, núcleo, retículo endoplasmático), modo escáner RX.
3. **Planeta / Sistema Planetario** — Capas atmosféricas, corte geológico, zoom por distancia entre manos.

## Interacción por gestos (IA Core)

| Gesto | Acción |
|-------|--------|
| **Pinza / Puño** | Agarrar y arrastre para rotar el modelo 360° |
| **Dos manos (distancia relativa)** | Zoom / escalar el objeto |
| **Palma abierta** | Cancelar agarre o pausar rotación |
| **Apuntar y mantener (índice)** | Selección vectorial (raycasting) → panel informativo |
| **Mano como escáner (arriba-abajo / lateral)** | Corte transversal dinámico (clipping plane) |
| **Gesto de captura / encuadre** | Snapshot de la vista 3D actual |

## Estética y UX

- **Puntero con estela de partículas** blancas luminosas y desvanecimiento progresivo.
- **HUD ciberespacial**: marcos mínimos, indicadores de estado de la cámara, menú lateral para cambiar entre entornos.
- **Filtros de suavizado** (Exponential Smoothing) para movimiento fluido sin temblores.
- **Smart Annotations**: panel flotante con nombre técnico y datos de la parte seleccionada.
- **Galería flotante** de capturas (snapshot).

## Arquitectura de software

| Capa | Tecnología |
|------|------------|
| Lienzo 3D | Three.js (HTML5 Canvas) |
| Tracking de manos | MediaPipe Hands (ejecución local en el navegador) |
| Lógica de gestos | Funciones vectoriales JS (distancia, ángulos, mapeo 2D/3D) |
| Modelos | Archivos `.gltf` / `.glb` (fuentes abiertas, ej. Sketchfab) |

> ⚠️ **Función Extra #4 (Control Híbrido de Iluminación con Mano Izquierda)** queda pausada.

## Cómo empezar

1. Clona o descarga este repositorio.
2. Abre `index.html` en un servidor local (ej. Live Server de VS Code) — MediaPipe no funciona directamente sobre `file://` en algunos navegadores.
3. Coloca tus modelos `.glb` en `assets/models/`.
4. Permite el acceso a la cámara cuando el navegador lo solicite.

## Estructura del proyecto

```
SYNAPSE/
├── index.html
├── css/
│   ├── styles.css
│   └── hud.css
├── js/
│   ├── main.js
│   ├── gesture-tracking.js
│   ├── three-scene.js
│   ├── annotations.js
│   ├── cross-section.js
│   └── snapshot.js
├── assets/
│   ├── models/          ← colocar .glb /.gltf aquí
│   └── textures/
├── obsidian/            ← notas del proyecto (vault)
│   ├── 00 - Inicio.md
│   ├── 01 - Proyecto SYNAPSE.md
│   ├── 02 - Tareas pendientes.md
│   ├── 03 - Arquitectura SYNAPSE.md
│   └── 04 - Hoja de Ruta.md
├── .gitignore
└── README.md
```

## Git y Obsidian

Esta carpeta es un repositorio Git vinculado a https://github.com/Jack-Levi/SYNAPSE.

Para abrir en Obsidian:
1. Abre Obsidian → **Abrir vault como carpeta**.
2. Selecciona esta carpeta `SYNAPSE`.

Cada cambio en el código o las notas se sube con:
```bash
git add .
git commit -m "descripción del cambio"
git push
```
