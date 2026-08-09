# 🕷️ Swing City — FPV Edition

**Swing City** is a high-speed **3D Spider-Man-inspired web-swinging game prototype** built for the browser using **JavaScript and Three.js**.

Swing between skyscrapers, dive to build speed, run along walls, leap across rooftops, and maintain momentum while navigating a dense Manhattan-inspired city.

The project focuses primarily on **movement, momentum, and the feeling of web-swinging** rather than combat, missions, or story content.

---

## 🎮 Gameplay

Swing City is designed around fast and fluid superhero traversal.

Attach webs to surrounding buildings, use gravity and momentum to accelerate through the city, release at the right moment to launch yourself forward, dive from skyscrapers to gain speed, and transition between swinging, wall-running, jumping, and rooftop traversal.

The chase camera automatically follows the player, so the entire game can be controlled using the keyboard without mouse movement or pointer lock.

---

## ✨ Features

### 🕸️ Web Swinging

* Dual left/right web system
* Physics-inspired swinging
* Elastic web tension
* Momentum preservation
* Forward-aware web anchor selection
* Swing pumping for additional speed
* Mid-air web release and reattachment
* Independent left and right web controls

### 🏃 Movement

* High-speed aerial traversal
* Air steering
* Dive mechanic for building speed
* Rooftop landing
* Wall running
* Wall jumping
* Coyote-time jumping
* Buffered jump inputs
* Swing-assisted jumps
* Responsive turning at high speeds

### 🏙️ City

* Large procedural Manhattan-style environment
* Dense skyscraper corridors
* Downtown-inspired skyline
* Reflective glass buildings
* Procedural facade and window details
* Rooftops designed for traversal
* Day and night environments

### 🎥 Camera & Visuals

* Automatic third-person chase camera
* Ultra-wide close-follow perspective
* Speed-responsive field of view
* Peripheral speed streaks
* Center reticle
* Vignette effects
* Cool cinematic daylight grading
* Stable camera behavior during high-speed swings

### 🦸 Character

* Original placeholder superhero
* Articulated arms and legs
* Running poses
* Swinging poses
* Jumping and aerial movement
* Procedural movement animation

### 🔊 Audio

Procedurally generated sound effects for:

* Wind
* Web firing
* Swinging
* Jumping
* Landing
* Building impacts

Sound can be enabled or disabled at any time.

---

## 🕹️ Controls

| Key                | Action                       |
| ------------------ | ---------------------------- |
| **↑ Up Arrow**     | Accelerate / move forward    |
| **↓ Down Arrow**   | Brake / reverse at low speed |
| **← → Arrow Keys** | Steer                        |
| **Z**              | Hold left web                |
| **X**              | Hold right web               |
| **Space**          | Jump / wall-jump / swing hop |
| **Shift**          | Dive and build aerial speed  |
| **N**              | Toggle day / night           |
| **M**              | Toggle sound                 |
| **R**              | Reset player                 |

> The camera is completely automatic. Mouse movement and pointer lock are not required.

Touch controls are also available for the left and right webs on compatible devices.

---

## 🛠️ Tech Stack

| Technology        | Purpose                                        |
| ----------------- | ---------------------------------------------- |
| **JavaScript**    | Core game programming                          |
| **Three.js**      | 3D rendering and scene management              |
| **WebGL**         | Browser-based GPU rendering                    |
| **Vite**          | Development server and production build system |
| **HTML5**         | Application structure                          |
| **CSS3**          | HUD, controls, and visual presentation         |
| **Web Audio API** | Procedural game audio                          |

The current prototype implements its movement and swinging logic directly in JavaScript rather than relying on a full external game engine.

---

## 🚀 Getting Started

### Prerequisites

Install:

* **Node.js**
* **npm**

Then clone the repository:

```bash
git clone <YOUR-REPOSITORY-URL>
cd swing-city
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite will display a local address, normally:

```text
http://localhost:5173
```

Open it in your browser and start swinging.

---

## 📦 Production Build

Create an optimized production build with:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

The compiled application will be generated inside:

```text
dist/
```

The `dist/` directory is intentionally excluded from Git.

---

## 📁 Project Structure

```text
swing-city/
│
├── public/
│   └── assets/
│       └── Static textures and character assets
│
├── src/
│   ├── main.js
│   │   └── Three.js scene, game loop, movement,
│   │       swinging physics and audio
│   │
│   ├── realism.css
│   │   └── Environment presentation
│   │
│   ├── sound.css
│   │   └── Sound-control interface
│   │
│   └── style.css
│       └── Core UI and HUD styles
│
├── index.html
├── package.json
└── README.md
```

---

## 🧠 How the Swinging Works

The web-swinging system is built around momentum-based traversal.

When a web attaches to a valid point on a building, the player is constrained relative to that anchor while still being affected by velocity and gravity.

This allows the player to:

1. Fall and gain speed.
2. Attach a web to a skyscraper.
3. Convert downward momentum into forward swinging momentum.
4. Pump the swing to increase speed.
5. Release the web at the correct moment.
6. Launch through the city.
7. Attach another web and continue the movement chain.

The goal is to reward **timing and momentum management** rather than simply pulling the player toward a predefined point.

---

## 🎯 Project Goals

Swing City is primarily an experiment in building satisfying superhero traversal mechanics directly in the browser.

The project explores:

* Momentum-based web swinging
* High-speed 3D browser gameplay
* Procedural urban environments
* Responsive character traversal
* Automatic high-speed camera systems
* Lightweight browser-based game architecture

The long-term goal is to make traversal itself enjoyable enough that simply moving around the city feels like the game.

---

## 🔮 Planned Improvements

Future versions may include:

* Improved humanoid character model
* Full skeletal character animations
* More advanced web animations
* Web zipping
* Point launching
* Ledge vaulting
* Improved parkour
* Wall crawling
* More varied building architecture
* Street-level environment details
* Traffic and environmental objects
* Improved collision detection
* Better mobile controls
* Graphics/performance settings
* Improved lighting and shadows
* Larger city generation
* Performance optimizations

---

## ⚡ Performance

Because Swing City runs directly inside a web browser, performance is an important part of the project.

The environment therefore uses lightweight procedural geometry and repeated facade details instead of extremely high-poly city assets.

Future development will explore techniques such as:

* Instanced rendering
* Level of Detail (LOD)
* Frustum culling
* Object pooling
* Distance-based environment generation

These techniques should allow the city to become significantly larger without sacrificing smooth traversal.

---

## ⚠️ Disclaimer

Swing City is an **independent fan-made technical prototype** created for educational and experimental purposes.

The project is inspired by superhero web-swinging mechanics and Spider-Man-style traversal, but the game itself uses an **original placeholder hero and fictional city environment**.

No official Marvel or Spider-Man character models, logos, story content, animations, audio, or assets are included in this repository.

**Spider-Man and related characters are trademarks and intellectual property of Marvel Entertainment.**

This project is not affiliated with, endorsed by, or sponsored by Marvel Entertainment, Sony Interactive Entertainment, Insomniac Games, or any related company.

---

---

**Built with JavaScript + Three.js.**

*Swing. Release. Dive. Repeat.*
<img width="1091" height="704" alt="Screenshot From 2026-08-09 13-59-31" src="https://github.com/user-attachments/assets/896211ed-5549-4c3b-8339-b0d5bb29de02" />
In-game snap <<
