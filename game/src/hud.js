// SKYLINE — HUD and cockpit instruments.
// The DOM HUD carries altitude, speed, heading, compass, fuel, throttle,
// score and the objective; the canvas gauges draw the attitude ball and
// the lit dials the cockpit view is judged by.

import { formatTime, clamp, RUNWAY } from './config.js';
import { altitudeOf, headingDegOf, eulerOf } from './flight.js';
import { bearingToNext, nextRingPosition } from './missions.js';
import { drawAvionics } from './avionics.js';

const $ = (id) => document.getElementById(id);

export function showHud(on) { $('hud').classList.toggle('hidden', !on); }
export function showCockpit(on) {
  $('cockpit').classList.toggle('on', on);
  document.body.classList.toggle('cockpit-on', on);
}

export function setMessage(text, sub) {
  const el = $('message');
  el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
}

export function clearMessage() { $('message').innerHTML = ''; }

export function updateHud(state) {
  const alt = Math.max(0, Math.round(altitudeOf(state)));
  const spdKt = Math.round(state.speed * 1.944);
  const hdg = Math.round(headingDegOf(state));
  $('alt').textContent = String(alt);
  $('spd').textContent = String(spdKt);
  $('hdg').textContent = String(hdg).padStart(3, '0');
  $('compass-hdg').textContent = `${String(hdg).padStart(3, '0')}°`;
  $('rings').textContent = `${state.ringsPassed} / ${state.mission.rings.length}`;
  $('score').textContent = String(state.score);
  $('time').textContent = formatTime(state.time);
  $('fuel-pct').textContent = `${Math.round(state.fuel)}%`;
  $('fuel-fill').style.width = `${clamp(state.fuel, 0, 100)}%`;
  $('fuel-fill').classList.toggle('low', state.fuel < 25);
  $('thr-pct').textContent = `${Math.round(state.throttle * 100)}%`;
  $('thr-fill').style.width = `${state.throttle * 100}%`;
  $('damage').textContent = `${Math.round(state.damage)}%`;
  $('mission-name').textContent = state.mission.name;
  $('warn').classList.toggle('show', state.stalled && state.phase === 'flying');

  // Compass strip: the five nearest 30-degree points centred on heading.
  const pointNames = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
  const centre = Math.round(hdg / 30) % 12;
  const strip = [];
  for (let k = -2; k <= 2; k++) strip.push(pointNames[(centre + k + 12) % 12]);
  $('compass-strip').textContent = strip.join('   ');

  // Objective line: next ring bearing + distance, or the runway.
  const target = nextRingPosition(state);
  const nav = bearingToNext(state);
  const obj = $('objective');
  if (target) {
    obj.innerHTML = `NEXT RING <b>${state.ringsPassed + 1}/${state.mission.rings.length}</b> &middot; ` +
      `BRG <b>${String(Math.round(nav.bearing)).padStart(3, '0')}&deg;</b> &middot; ` +
      `DIST <b>${Math.round(nav.distance)} m</b>`;
  } else {
    const home = state.mission.landingRunway || RUNWAY;
    obj.innerHTML = `ALL RINGS CLEAR &mdash; LAND ON <b>${home.label} &middot; ${home.name.toUpperCase()}</b> &middot; ` +
      `BRG <b>${String(Math.round(nav.bearing)).padStart(3, '0')}&deg;</b> &middot; ` +
      `DIST <b>${Math.round(nav.distance)} m</b>`;
  }
  if (state.message && state.elapsed < state.messageUntil) {
    setMessage(state.message);
  } else if (!state.message || state.elapsed >= state.messageUntil) {
    clearMessage();
  }

  drawHorizon(state);
  drawGauges(state);
  drawAvionics(state);
}

// Artificial horizon: blue sky / brown ground split by pitch and roll.
export function drawHorizon(state) {
  const cv = $('horizon');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = W / 2 - 6;
  const e = eulerOf(state);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(e.z);
  const pitchPx = clamp(-e.x, -0.6, 0.6) * (R / 0.6);
  ctx.fillStyle = '#2f7fc9';
  ctx.fillRect(-R - 10, -R - 10 - pitchPx, (R + 10) * 2, R + 10 + pitchPx);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-R - 10, -pitchPx, (R + 10) * 2, R + 10 + pitchPx);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-R, -pitchPx); ctx.lineTo(R, -pitchPx); ctx.stroke();
  // Pitch ladder.
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.75)';
  for (const p of [-20, -10, 10, 20]) {
    const y = -pitchPx + (p / 20) * (R * 0.28);
    ctx.beginPath(); ctx.moveTo(-34, y); ctx.lineTo(34, y); ctx.stroke();
  }
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx - 44, cy); ctx.lineTo(cx + 44, cy); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = '#ffd75e'; ctx.fill();
}

function dial(ctx, W, label, valueText) {
  ctx.clearRect(0, 0, W, W);
  ctx.strokeStyle = 'rgba(160,220,255,.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 8, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#cfeaff'; ctx.font = `600 ${Math.round(W * 0.08)}px Verdana, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, W * 0.86);
  ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(W * 0.16)}px Verdana, sans-serif`;
  ctx.fillText(valueText, W / 2, W * 0.56);
}

function needleDial(ctx, W, fraction, color) {
  const a = -Math.PI * 0.75 + fraction * Math.PI * 1.5;
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(W / 2, W / 2);
  ctx.lineTo(W / 2 + Math.cos(a) * (W * 0.36), W / 2 + Math.sin(a) * (W * 0.36));
  ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, W / 2, 9, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}

export function drawGauges(state) {
  const W = 240;
  const spd = $('gauge-speed').getContext('2d');
  dial(spd, W, 'AIRSPEED', `${Math.round(state.speed * 1.944)}`);
  needleDial(spd, W, clamp(state.speed / 100, 0, 1), '#37d67a');

  const alt = $('gauge-alt').getContext('2d');
  dial(alt, W, 'ALTITUDE', `${Math.max(0, Math.round(altitudeOf(state)))}`);
  needleDial(alt, W, clamp(altitudeOf(state) / 400, 0, 1), '#3db9ff');

  const fuel = $('gauge-fuel').getContext('2d');
  dial(fuel, W, 'FUEL', `${Math.round(state.fuel)}%`);
  needleDial(fuel, W, clamp(state.fuel / 100, 0, 1), state.fuel < 25 ? '#ff5a4e' : '#ffd75e');

  // Attitude gauge: a smaller horizon ball.
  const att = $('gauge-att').getContext('2d');
  const e = eulerOf(state);
  att.clearRect(0, 0, W, W);
  att.save();
  att.beginPath(); att.arc(W / 2, W / 2, W / 2 - 8, 0, Math.PI * 2); att.clip();
  att.translate(W / 2, W / 2);
  att.rotate(e.z);
  const pitchPx = clamp(-e.x, -0.6, 0.6) * (W / 2 / 0.6);
  att.fillStyle = '#2f7fc9'; att.fillRect(-W, -W - pitchPx, W * 2, W + pitchPx);
  att.fillStyle = '#7a5230'; att.fillRect(-W, -pitchPx, W * 2, W + pitchPx);
  att.strokeStyle = '#fff'; att.lineWidth = 4;
  att.beginPath(); att.moveTo(-W, -pitchPx); att.lineTo(W, -pitchPx); att.stroke();
  att.restore();
  att.strokeStyle = '#ffd75e'; att.lineWidth = 5;
  att.beginPath(); att.moveTo(W / 2 - 40, W / 2); att.lineTo(W / 2 + 40, W / 2); att.stroke();
}
