// SKYLINE — cockpit avionics strip: pitch ladder + heading tape.
// A glass strip that rides above the instrument panel in cockpit view
// only. The left half is a moving pitch ladder (banked with the wing,
// sliding with the nose); the right half is a scrolling heading tape.
// Both are drawn fresh every frame from the flight state, so what the
// pilot sees is the aeroplane's own attitude, not a picture of one.

import { headingDegOf, eulerOf } from './flight.js';
import { clamp } from './config.js';

const W = 640, H = 120;
const TAPE_W = 288, TAPE_H = 96;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapAngle(a) {
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}

function compassLabel(deg) {
  const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  if (names[deg] !== undefined) return names[deg];
  return String(deg).padStart(3, '0');
}

// Pitch ladder: horizon lines every 10 degrees, long bars at 20/30,
// the whole ladder rolled with the aircraft and slid by pitch.
function drawPitchLadder(ctx, x0, y0, pitchDeg, rollRad) {
  const cx = x0 + TAPE_W / 2, cy = y0 + TAPE_H / 2;
  ctx.save();
  roundRect(ctx, x0, y0, TAPE_W, TAPE_H, 8);
  ctx.fillStyle = 'rgba(8, 20, 34, 0.78)';
  ctx.fill();
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(rollRad);
  // Sky above the horizon line, ground below it, both sliding with pitch.
  const slide = pitchDeg * 2.4;
  ctx.fillStyle = 'rgba(47, 127, 201, 0.55)';
  ctx.fillRect(-TAPE_W, -TAPE_H - slide, TAPE_W * 2, TAPE_H + slide);
  ctx.fillStyle = 'rgba(122, 82, 48, 0.55)';
  ctx.fillRect(-TAPE_W, -slide, TAPE_W * 2, TAPE_H + slide);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-TAPE_W, -slide); ctx.lineTo(TAPE_W, -slide); ctx.stroke();
  ctx.font = '700 11px Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (let p = -30; p <= 30; p += 10) {
    if (p === 0) continue;
    const y = -slide - p * 2.4;
    if (y < -TAPE_H / 2 - 14 || y > TAPE_H / 2 + 14) continue;
    const half = Math.abs(p) >= 20 ? 52 : 34;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = p > 0 ? 2 : 2;
    ctx.beginPath(); ctx.moveTo(-half, y); ctx.lineTo(half, y); ctx.stroke();
    // Climb lines point up, dive lines point down: short end ticks.
    ctx.beginPath();
    ctx.moveTo(-half, y); ctx.lineTo(-half, y + (p > 0 ? -7 : 7));
    ctx.moveTo(half, y); ctx.lineTo(half, y + (p > 0 ? -7 : 7));
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(String(Math.abs(p)), -half - 16, y + 4);
    ctx.fillText(String(Math.abs(p)), half + 16, y + 4);
  }
  ctx.restore();
  // Fixed aircraft symbol: the ladder moves, the wings do not.
  ctx.strokeStyle = '#ffd75e';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx - 46, cy); ctx.lineTo(cx - 12, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 12, cy); ctx.lineTo(cx + 46, cy); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd75e'; ctx.fill();
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '600 10px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PITCH', x0 + 6, y0 + 14);
  ctx.textAlign = 'right';
  ctx.fillText(`${pitchDeg >= 0 ? '+' : ''}${Math.round(pitchDeg)}°`, x0 + TAPE_W - 6, y0 + 14);
}

// Heading tape: a window of compass ticks that scrolls under a fixed
// caret as the nose swings, with a digital readout underneath.
function drawHeadingTape(ctx, x0, y0, headingDeg) {
  const cx = x0 + TAPE_W / 2, cy = y0 + TAPE_H / 2;
  ctx.save();
  roundRect(ctx, x0, y0, TAPE_W, TAPE_H, 8);
  ctx.fillStyle = 'rgba(8, 20, 34, 0.78)';
  ctx.fill();
  ctx.clip();
  const pxPerDeg = 3.2;
  const base = Math.floor((headingDeg - 45) / 10) * 10;
  ctx.font = '700 12px Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (let d = base; d <= headingDeg + 45; d += 10) {
    const deg = ((d % 360) + 360) % 360;
    const off = wrapAngle(d - headingDeg) * pxPerDeg;
    const x = cx + off;
    const major = deg % 30 === 0;
    ctx.strokeStyle = major ? '#fff' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = major ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(x, cy - 26); ctx.lineTo(x, cy - (major ? 2 : 12)); ctx.stroke();
    if (major) {
      ctx.fillStyle = '#fff';
      ctx.fillText(compassLabel(deg), x, cy + 20);
    }
  }
  ctx.restore();
  // Fixed caret + digital heading.
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.moveTo(cx - 9, y0 + 6); ctx.lineTo(cx + 9, y0 + 6); ctx.lineTo(cx, y0 + 18);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 20px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, cx, y0 + TAPE_H - 12);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '600 10px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HDG', x0 + 6, y0 + 14);
}

export function drawAvionics(state) {
  const panel = document.getElementById('cockpit');
  if (!panel || !panel.classList.contains('on')) return;
  const cv = document.getElementById('avionics');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const e = eulerOf(state);
  const pitchDeg = (e.x * 180) / Math.PI;
  drawPitchLadder(ctx, 8, 12, pitchDeg, e.z);
  drawHeadingTape(ctx, W - TAPE_W - 8, 12, headingDegOf(state));
  // Divider between the two tapes.
  ctx.strokeStyle = 'rgba(160, 220, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2, 20); ctx.lineTo(W / 2, H - 12); ctx.stroke();
}
