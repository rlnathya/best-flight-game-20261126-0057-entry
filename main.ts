// SKYLINE — make.fun hand-in for "Make the best flight game"
// (best-flight-game-20261126-0057).
//
// This program assembles the submission from this repository alone:
// it copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// It uses only the Node standard library, reads nothing outside the repo,
// writes nothing but the output directory, and is deterministic: two runs
// over the same repository produce the same bytes.
//
// Run it locally the way the grader does, with MAKEFUN_OUTPUT_DIR set:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, /output is used when MAKEFUN_OUTPUT_DIR is unset.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const GAME_DIR = join(REPO_ROOT, 'game');
const SHOTS_DIR = join(REPO_ROOT, 'screenshots');

function requireDir(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`SKYLINE hand-in: ${label} is missing at ${path}`);
  }
}

function handIn(): void {
  requireDir(GAME_DIR, 'game/');
  requireDir(SHOTS_DIR, 'screenshots/');

  // Start from a clean output directory so a stale file from an earlier
  // run can never leak into the submission.
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  cpSync(GAME_DIR, join(OUTPUT_DIR, 'game'), { recursive: true });
  cpSync(SHOTS_DIR, join(OUTPUT_DIR, 'screenshots'), { recursive: true });

  const dossier = buildDossier(OUTPUT_DIR, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);

  // A short, honest summary so a human running this by hand can see at a
  // glance what was handed in (the dossier itself is the authority).
  const shotNames = readdirSync(join(OUTPUT_DIR, 'screenshots'))
    .filter((n) => !n.startsWith('.'))
    .sort();
  console.log(`SKYLINE hand-in written to ${OUTPUT_DIR}`);
  console.log(`game/index.html: ${existsSync(join(OUTPUT_DIR, 'game', 'index.html')) ? 'present' : 'MISSING'}`);
  console.log(`screenshots: ${shotNames.join(', ')}`);
  console.log(`dossier.json: ${dossier.length} bytes`);
}

handIn();
