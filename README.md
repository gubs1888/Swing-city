# Swing City — FPV Edition

A high-speed superhero traversal prototype focused on web-swinging through dense glass city canyons.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

The production bundle is generated in `dist/`. It is intentionally ignored by Git.

## Project structure

```text
swing-city/
├── public/
│   └── assets/        # Static textures and character sprites
├── src/
│   ├── main.js        # Three.js scene, game loop, physics, and audio
│   ├── realism.css    # Environment presentation
│   ├── sound.css      # Sound-control UI
│   └── style.css      # Core interface styles
├── index.html         # Vite application entry
├── package.json       # Scripts and dependencies
└── README.md
```

## Controls

- **Up Arrow** — accelerate / move forward
- **Down Arrow** — brake; reverse at low speed
- **Left / Right Arrow** — steer
- **Z** — hold left web
- **X** — hold right web
- **Space** — jump / wall-jump / small swing hop
- **Shift** — dive and build speed in the air
- **N** — toggle day / night
- **M** — toggle sound
- **R** — reset

The camera is fully automatic. Mouse movement and pointer lock are not used.

## Features in this edition

- Keyboard-only steering and automatic chase camera
- Ultra-wide, stable close-follow chase camera
- Taller, denser reflective skyline inspired by modern drone footage
- Cool daylight color grade, vignette, reticle, and peripheral speed streaks
- Minimal dual-circle touch controls for left and right webs
- Higher aerial speed cap, stronger dives, and more responsive turning
- Smoother elastic web tension and momentum preservation
- Better forward-aware web anchor selection
- Swing pumping while holding Up
- Air dive / speed-building mechanic
- Rooftop landing
- Wall running and wall jumping
- Coyote-time and buffered jumping for more responsive controls
- Articulated hero arms and legs during running/swinging
- Speed-responsive FOV
- Larger, denser Manhattan-style city with stronger downtown skyline
- Lightweight facade/window detailing
- Updated HUD and control guide
- Procedural wind, web, jump, landing, and impact sound effects

The prototype uses an original placeholder hero and fictional city. It does not include Marvel/Spider-Man character assets, logos, story content, or other copyrighted game assets.
