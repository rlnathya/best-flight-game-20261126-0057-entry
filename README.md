# SKYLINE — Island Flight

[![Bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/rlnathya/best-flight-game-20261126-0057-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/rlnathya/best-flight-game-20261126-0057-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete 3D flight game that runs offline in a desktop browser from its
own static files. Take off from Coral Bay runway, thread the glowing rings
over a procedural island — beaches, mountains, a little town, a lighthouse —
then bring the plane home for a clean landing, or put her down at Harbour
Field, the second strip on the east coast. Mind your speed: too slow
and she stalls; too rough and the airframe breaks; too thirsty and the fuel
runs out before the runway.

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
server). No network, no build step — Three.js is vendored under
`game/vendor/`.

Pick a sortie on the menu and press **Take Off**:

- **Island Tour** — 8 rings over the whole island, full tank.
- **Sunset Sprint** — 5 low rings, little fuel, beat the clock.
- **Harbour Landing** — 6 rings east across the island, then a southbound
  landing on Harbour Field runway 18, the second airfield.

Fly every ring in order (each is worth 1000 points), then land on your
sortie's own runway to finish — landing on the other airfield with all
rings flown is a wrong-field touchdown, not a finish. Time and fuel left
over become bonus points; a rough landing costs 25% damage.

Not sure how a sortie is flown? **Watch Autopilot** flies it for you —
press any key or grab the mouse to take over at any moment.

## Controls

| Input | Action |
| --- | --- |
| ↑ / ↓ or W / S | Pitch up / down |
| ← / → | Roll and turn |
| A / D, Q / E | Rudder |
| Shift / Ctrl | Throttle up / down |
| Mouse drag | Steer (pitch + roll) |
| Mouse wheel | Throttle |
| C | Chase / cockpit camera |
| P / Esc | Pause |
| R | Restart the sortie |
| M | Mute |

## Features

- Procedural island terrain (beaches, hills, two mountain ranges, snow caps), sea with surf foam, town with red roofs and lit windows, a lighthouse with a sweeping beam, two runways with markings and edge lights, deterministic clouds and trees.
- Flight model with throttle, drag, climb penalty, coordinated turns, stall with nose drop, ground effect-free but honest landings, ditching and crash detection.
- Two cameras: three-quarter chase view and a cockpit view with a lit instrument panel (airspeed, attitude, altitude and fuel dials).
- Full HUD: artificial horizon, altitude, airspeed, heading, compass strip, fuel and throttle bars, damage, score, timer, and a next-ring bearing/distance readout.
- Three missions across two airfields, fuel and damage as real decisions, mission-complete and crash screens with a score breakdown.
- An autopilot demo that flies any sortie end to end — take-off, rings, a lined-up final with a flare, and a touchdown — and hands the stick back the moment you touch a control.
- Deterministic screenshot mode: `game/index.html?shot=1..4` freezes a fixed pose for each render.

## Layout

- `main.ts` — hand-in program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier`.
- `vendor/makefun-game.ts` — kit library, unchanged.
- `game/index.html` — page, HUD and cockpit panel.
- `game/src/config.js` — tuning, missions, screenshot poses.
- `game/src/terrain.js` — island height function, terrain, sea, sky, runway, town, trees.
- `game/src/airfield.js` — the second airfield, Harbour Field, with its own strip, markings, lights and hangar.
- `game/src/aircraft.js` — the plane and the rings.
- `game/src/flight.js` — flight model, landing/crash rules, scoring.
- `game/src/missions.js` — ring placement, pass detection, navigation.
- `game/src/autopilot.js` — hands-free demo pilot: take-off, ring chasing, final approach, flare and touchdown.
- `game/src/hud.js` — HUD and canvas instruments.
- `game/src/sound.js` — engine hum, ring chime, touchdown and crash sounds (WebAudio).
- `game/src/main.js` — scene, input, cameras, game loop, screens.
- `game/vendor/three.module.min.js` — Three.js r160, vendored for offline play.

## License

MIT — see `LICENSE`.
