/* ball404.js - the tennis ball that is the "0" in 404.

   How it is put together, top to bottom:
     1. CONFIG        every number worth tuning lives here
     2. SETUP         renderer, camera, lights, the ball, its shadow
     3. LAYOUT        reads the page (slot, baseline) so the 3D world lines up with HTML
     4. STATE         docked / free / held / returning
     5. PHYSICS       gravity, bounces, rolling, squash. Runs at a fixed 120 steps a second
     6. INPUT         grab, throw, tap, keyboard
     7. RENDER LOOP   draws a frame, pauses when the court is off screen
     8. SOUND         real court bounces, cut into a small audio sprite

   Coordinates: the world is measured in CSS pixels. x goes right, y goes UP, and (0,0)
   is the bottom-left corner of the court. The camera is orthographic, so a ball at
   x = 300 is drawn exactly 300px from the left edge. No perspective maths anywhere.
*/

import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

// ------------------------------------------------------------------ 1. CONFIG
const CONFIG = {
  gravity: 2600,          // px/s². Higher = heavier, snappier ball
  floorBounce: 0.62,      // fraction of speed kept after hitting the floor
  wallBounce: 0.7,        // ...after hitting a side wall
  rollFriction: 1.1,      // how quickly a rolling ball slows down (per second)
  airDrag: 0.05,          // tiny slowdown in the air
  stopBelow: 45,          // impacts slower than this (px/s) stop bouncing instead
  maxThrow: 3600,         // cap on throw speed, px/s
  popUp: 720,             // upward speed when you tap the ball out of the 404
  hop: 950,               // upward speed when you tap the ball on the floor
  returnDistance: 1.1,    // release within this many radii of the slot to put it back
  squashMax: 0.2,         // most the ball can flatten on impact (0.2 = 20%)
  squashPerSpeed: 0.0022, // how much each px/s of impact feeds the squash spring
  idleSpin: 0.28,         // rad/s, slow turn while it sits in the 404
  sound: true,
};

const STEP = 1 / 120;     // physics timestep, seconds

// ------------------------------------------------------------------ elements
const court = document.getElementById('court');
const canvas = document.getElementById('ballCanvas');
const slot = document.getElementById('ballSlot');
const hint = document.getElementById('ballHint');
const soundBtn = document.getElementById('ballSound');
const baseline = court.querySelector('.court__baseline');

const HINTS = {
  docked: '',
  out: 'Throw it around. Drag it back into the gap to put it back in play.',
  back: 'Back in play.',
};


function hasWebGL() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

function start() {
  spriteBytes = fetch(SPRITE.url).then((r) => r.arrayBuffer()).catch(() => null);

  // ---------------------------------------------------------------- 2. SETUP
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));   // 3x screens cost a lot for no visible gain
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;          // keeps the yellow from going muddy
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  // Soft studio lighting built in code. No HDRI download.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-1, 1.5, 1.4);                           // upper left, in front
  scene.add(key);

  // Orthographic camera sized to the court in pixels (set properly in layout()).
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -5000, 5000);
  camera.position.z = 1000;

  // The ball is three nested objects, so each job stays separate:
  //   root   -> position on screen
  //   squash -> flattening on impact (stays lined up with the floor or wall)
  //   ball   -> rotation from rolling and spinning
  const root = new THREE.Group();
  const squash = new THREE.Group();
  const loader = new THREE.TextureLoader(new THREE.LoadingManager(onTexturesReady));
  const tex = (name, srgb) => {
    const t = loader.load(`assets/ball/ball_${name}.webp`);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;          // color map only. Normal/roughness are data
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  // three's SphereGeometry is equirectangular like the Blender sphere, so the textures fit it
  // directly and we skip loading a .glb (and the GLTFLoader).
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 32),
    new THREE.MeshPhysicalMaterial({
      map: tex('color', true),
      normalMap: tex('normal'),
      roughnessMap: tex('roughness'),
      roughness: 1,
      sheen: 1,                                 // the felt. Fabric-style glow at the edges
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color('#fff7c2'),
    })
  );
  ball.quaternion.setFromEuler(new THREE.Euler(0.45, 0.7, 0.2));  // a nice view of the seam
  squash.add(ball);
  root.add(squash);
  scene.add(root);

  // Shadow: a soft navy ellipse on the baseline. It sits behind the ball (z < 0).
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.position.z = -500;
  scene.add(shadow);

  // ---------------------------------------------------------------- 3. LAYOUT
  // Everything the physics needs to know about the page, in world coordinates.
  const L = { w: 1, h: 1, r: 40, floor: 0, slotX: 0, slotY: 0 };

  function layout() {
    const c = court.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    const b = baseline.getBoundingClientRect();
    L.w = c.width;
    L.h = c.height;
    L.r = s.width / 2;
    L.floor = c.bottom - b.top;                               // top edge of the baseline
    L.slotX = s.left + s.width / 2 - c.left;
    L.slotY = c.bottom - (s.top + s.height / 2);

    renderer.setSize(L.w, L.h, false);                        // CSS already sizes the canvas
    camera.left = 0; camera.right = L.w; camera.top = L.h; camera.bottom = 0;
    camera.updateProjectionMatrix();

    if (S.mode === 'docked' || S.mode === 'returning') { S.x = L.slotX; S.y = L.slotY; }
    S.x = clamp(S.x, L.r, L.w - L.r);
    S.y = clamp(S.y, L.floor + L.r, L.h - L.r);
    wake();
  }

  // ---------------------------------------------------------------- 4. STATE
  const S = {
    mode: 'docked',        // 'docked' | 'free' | 'held' | 'returning'
    x: 0, y: 0,            // centre position, px
    vx: 0, vy: 0,          // velocity, px/s
    spin: new THREE.Vector3(0, CONFIG.idleSpin, 0),   // angular velocity, rad/s (world axes)
    sq: 0, sqv: 0,         // squash amount and its speed (a damped spring)
    sqAxis: 'y', sqSide: -1,
    hover: 0,              // 0..1, eased, for the hover swell
    ret: null,             // { t, fromX, fromY } while returning
    outFor: 0,             // seconds since it left the slot
    asleep: false,
  };

  if (location.search.includes('debug')) window.__ball = { S, L };   // for poking at it in the console

  function setMode(mode) {
    if (mode === 'held' || (mode === 'free' && S.mode !== 'held')) S.outFor = 0;
    S.mode = mode;
    const out = mode === 'free' || mode === 'held';
    court.classList.toggle('is-out', out);
    slot.setAttribute('aria-label', out ? 'Put the ball back' : 'The zero is a tennis ball. Press to drop it.');
    wake();
  }
  function say(key) { if (hint.textContent !== HINTS[key]) hint.textContent = HINTS[key]; }

  // ---------------------------------------------------------------- 5. PHYSICS
  const dq = new THREE.Quaternion();
  const axis = new THREE.Vector3();

  function step(dt) {
    if (S.mode === 'free') {
      S.outFor += dt;
      S.vy -= CONFIG.gravity * dt;
      const drag = Math.exp(-CONFIG.airDrag * dt);
      S.vx *= drag;
      S.x += S.vx * dt;
      S.y += S.vy * dt;

      const minY = L.floor + L.r;
      let onFloor = false;
      if (S.y <= minY) {                                     // floor
        S.y = minY;
        onFloor = true;
        if (S.vy < 0) {
          const hit = -S.vy;
          S.vy = hit > CONFIG.stopBelow ? hit * CONFIG.floorBounce : 0;
          impact(hit, 'y', -1);
        }
      }
      if (S.x < L.r)        { S.x = L.r;        if (S.vx < 0) { impact(-S.vx, 'x', -1); S.vx = -S.vx * CONFIG.wallBounce; } }
      if (S.x > L.w - L.r)  { S.x = L.w - L.r;  if (S.vx > 0) { impact(S.vx, 'x', 1);   S.vx = -S.vx * CONFIG.wallBounce; } }
      if (S.y > L.h - L.r)  { S.y = L.h - L.r;  if (S.vy > 0) S.vy = -S.vy * 0.5; }

      if (onFloor && S.vy === 0) {
        // Rolling: friction slows it, and it spins exactly as fast as it travels (no slipping).
        S.vx *= Math.exp(-CONFIG.rollFriction * dt);
        if (Math.abs(S.vx) < 3) S.vx = 0;
        S.spin.set(S.spin.x * Math.exp(-6 * dt), S.spin.y * Math.exp(-6 * dt), -S.vx / L.r);
      } else {
        S.spin.multiplyScalar(Math.exp(-0.25 * dt));         // spin fades slowly in the air
      }

      // Rolled or bounced back into the gap, slowly enough? It drops back in.
      // (Ignored for the first second, or it would drop straight back in as it pops out.)
      if (S.outFor > 1 && Math.hypot(S.x - L.slotX, S.y - L.slotY) < L.r * 0.5 && Math.hypot(S.vx, S.vy) < 900) putBack();

      if (onFloor && S.vx === 0 && S.vy === 0 && Math.abs(S.sq) < 0.001) S.asleep = true;
    }

    if (S.mode === 'returning') {
      S.ret.t = Math.min(1, S.ret.t + dt / 0.34);
      const k = easeOutBack(S.ret.t);
      S.x = S.ret.fromX + (L.slotX - S.ret.fromX) * k;
      S.y = S.ret.fromY + (L.slotY - S.ret.fromY) * k;
      S.spin.lerp(new THREE.Vector3(0, CONFIG.idleSpin, 0), 0.08);
      if (S.ret.t >= 1) { setMode('docked'); say('back'); }
    }

    if (S.mode === 'docked') {
      S.x = L.slotX; S.y = L.slotY;
      S.spin.lerp(new THREE.Vector3(0, CONFIG.idleSpin * (1 + 2 * S.hover), 0), 0.05);
    }

    // Squash spring: pulled back to 0, slightly underdamped so it rebounds a touch.
    S.sqv += (-900 * S.sq - 32 * S.sqv) * dt;
    S.sq = clamp(S.sq + S.sqv * dt, -0.08, CONFIG.squashMax);

    // Turn the ball by its angular velocity (world space, so pre-multiply).
    const w = S.spin.length();
    if (w > 1e-5) {
      dq.setFromAxisAngle(axis.copy(S.spin).divideScalar(w), w * dt);
      ball.quaternion.premultiply(dq);
    }
  }

  function impact(speed, ax, side) {
    S.sqAxis = ax; S.sqSide = side;
    S.sqv += speed * CONFIG.squashPerSpeed;
    thock(speed);
  }

  function putBack() {
    hoverArmed = false;
    S.ret = { t: 0, fromX: S.x, fromY: S.y };
    S.vx = S.vy = 0;
    setMode('returning');
  }

  function drop() {                                          // tapped while sitting in the 404
    S.vx = (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 120);
    S.vy = CONFIG.popUp;
    S.spin.set(Math.random() - 0.5, Math.random() - 0.5, -S.vx / L.r);
    setMode('free');
    say('out');
  }

  // ---------------------------------------------------------------- 6. INPUT
  // The canvas ignores the mouse (pointer-events: none) so buttons and links still work.
  // Instead the court listens, and only claims the pointer when it lands on the ball.
  const P = { id: null, downX: 0, downY: 0, offX: 0, offY: 0, moved: false, samples: [] };

  // On a computer with a mouse, just moving over the ball knocks it out of the 404.
  // It re-arms only after the mouse has left the ball, so putting it back doesn't
  // immediately knock it out again.
  const mouseHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let hoverArmed = true;

  const toWorld = (e) => {
    const c = court.getBoundingClientRect();
    return { x: e.clientX - c.left, y: c.bottom - e.clientY };
  };
  const overBall = (p) => Math.hypot(p.x - S.x, p.y - S.y) < L.r * 1.08;

  court.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || S.mode === 'returning') return;
    const p = toWorld(e);
    if (!overBall(p)) return;
    e.preventDefault();
    court.setPointerCapture(e.pointerId);
    unlockAudio();
    Object.assign(P, { id: e.pointerId, downX: p.x, downY: p.y, offX: S.x - p.x, offY: S.y - p.y, moved: false });
    P.samples = [{ t: e.timeStamp, x: p.x, y: p.y }];
  });

  court.addEventListener('pointermove', (e) => {
    const p = toWorld(e);
    if (P.id === null) {                                     // just hovering
      const over = overBall(p) && S.mode !== 'returning';
      if (mouseHover && e.pointerType === 'mouse') {
        if (!over) hoverArmed = true;
        else if (hoverArmed && S.mode === 'docked') { hoverArmed = false; drop(); return; }
      }
      court.style.cursor = over ? 'grab' : '';
      court.classList.toggle('is-hover', over);
      return;
    }
    if (e.pointerId !== P.id) return;
    if (!P.moved && Math.hypot(p.x - P.downX, p.y - P.downY) > 6) {
      P.moved = true;                                        // it's a drag, not a tap
      setMode('held');
      say('out');
      court.style.cursor = 'grabbing';
    }
    if (P.moved) {
      P.samples.push({ t: e.timeStamp, x: p.x, y: p.y });
      while (P.samples.length > 2 && e.timeStamp - P.samples[0].t > 90) P.samples.shift();
      const nx = clamp(p.x + P.offX, L.r, L.w - L.r);
      S.spin.z += (-(nx - S.x) / L.r * 20 - S.spin.z) * 0.3;  // dragging sideways rolls it a little
      S.x = nx;
      S.y = clamp(p.y + P.offY, L.floor + L.r, L.h - L.r);
    }
  });

  const release = (e) => {
    if (e.pointerId !== P.id) return;
    P.id = null;
    P.lastUp = performance.now();                            // so the slot's click event can ignore this tap
    court.style.cursor = '';
    if (!P.moved) {                                          // a tap
      if (S.mode === 'docked') drop();
      else if (S.mode === 'free') {
        S.vy = Math.max(S.vy, 0) + CONFIG.hop;
        S.vx += (S.x - P.downX) * 8;                         // tap the left side, it goes right
        wake();
      }
      return;
    }
    // A throw: speed from the last ~90ms of movement, not just the last frame (too jittery).
    const a = P.samples[0], b = P.samples[P.samples.length - 1];
    const dt = Math.max((b.t - a.t) / 1000, 1 / 120);
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    const sp = Math.hypot(vx, vy);
    if (sp > CONFIG.maxThrow) { vx *= CONFIG.maxThrow / sp; vy *= CONFIG.maxThrow / sp; }

    if (Math.hypot(S.x - L.slotX, S.y - L.slotY) < L.r * CONFIG.returnDistance) return putBack();
    S.vx = vx; S.vy = vy;
    S.spin.set(-vy / L.r * 0.15, vx / L.r * 0.15, -vx / L.r);  // a throw carries some spin
    setMode('free');
  };
  court.addEventListener('pointerup', release);
  court.addEventListener('pointercancel', release);

  // On touch screens, stop the page scrolling only when the finger lands on the ball.
  court.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t && overBall(toWorld(t))) e.preventDefault();
  }, { passive: false });

  // Keyboard and the ghost outline: the slot is a real button.
  slot.addEventListener('click', (e) => {
    if (performance.now() - (P.lastUp || 0) < 500) return;   // already handled as a pointer tap
    const out = S.mode === 'free' || S.mode === 'held';
    if (out) { unlockAudio(); putBack(); return; }
    if (e.detail === 0 && S.mode === 'docked') { unlockAudio(); drop(); }  // keyboard only. Mouse taps are handled above
  });

  // ---------------------------------------------------------------- 7. RENDER LOOP
  let raf = 0, last = 0, acc = 0, visible = true, ready = false;

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - (last || now)) / 1000, 0.05);  // after a tab switch, don't jump
    last = now;
    acc += dt;
    while (acc >= STEP) { step(STEP); acc -= STEP; }

    S.hover += ((court.classList.contains('is-hover') && S.mode === 'docked' ? 1 : 0) - S.hover) * 0.15;
    draw();
    if (visible && !(S.asleep && S.mode === 'free')) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  function draw() {
    const r = L.r * (1 + 0.05 * S.hover);
    const a = S.sq;
    // Flatten along the impact axis, bulge the other two, keep the volume roughly the same.
    if (S.sqAxis === 'y') squash.scale.set(r * (1 + a / 2), r * (1 - a), r * (1 + a / 2));
    else squash.scale.set(r * (1 - a), r * (1 + a / 2), r * (1 + a / 2));
    // Keep the contact side planted while it flattens.
    const offX = S.sqAxis === 'x' ? S.sqSide * L.r * a : 0;
    const offY = S.sqAxis === 'y' && S.mode === 'free' ? -L.r * a : 0;
    root.position.set(S.x + offX, S.y + offY, 0);

    // Shadow grows and fades as the ball rises.
    const height = Math.max(0, S.y - L.r - L.floor);
    const fade = clamp(1 - height / (L.h * 0.75), 0, 1);
    shadow.position.set(S.x, L.floor, -500);
    shadow.scale.set(L.r * 2.0 * (1 + height / 1400), L.r * 0.34 * (1 + height / 1400), 1);
    shadow.material.opacity = 0.4 * fade * fade * (S.mode === 'docked' || S.mode === 'returning' ? 0 : 1);

    renderer.render(scene, camera);
  }

  function wake() {
    S.asleep = false;
    if (ready && visible && !raf) raf = requestAnimationFrame(frame);
  }

  function onTexturesReady() {
    ready = true;
    layout();
    draw();
    court.classList.add('is-3d');      // fades out the static image
    soundBtn.hidden = false;
    wake();
  }

  new ResizeObserver(layout).observe(court);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(court);
  document.fonts?.ready.then(layout);  // the slot moves once Archivo loads
  layout();
}

// ------------------------------------------------------------------ 8. SOUND
// bounce.mp3 is an "audio sprite": 12 single bounces from an indoor hard-court recording,
// back to back, each about 0.2s. The physics already makes each bounce weaker than the last,
// so we play ONE hit per impact: a hard hit for fast impacts, softer hits as it dies down.
// That keeps the sound in sync with what you see, which a full recording never would.
// Several takes per group, rotated, so repeated bounces don't sound like a machine gun.
const SPRITE = {
  url: 'assets/ball/bounce.mp3',
  clip: 0.22,                                              // seconds per hit
  hard:   [0.05, 0.32],
  medium: [0.59, 0.86, 1.13, 1.4],
  soft:   [1.67, 1.94, 2.21, 2.48, 2.75, 3.02],
};
let audio = null, bounceBuf = null, lastThock = 0;
const turn = { hard: 0, medium: 0, soft: 0 };
// Downloaded when the 3D ball starts (47KB), decoded once the audio system exists.
let spriteBytes = Promise.resolve(null);

let soundOn = CONFIG.sound;
try { if (localStorage.getItem('ptk-ball-sound') === 'off') soundOn = false; } catch {}
syncSoundBtn();
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  try { localStorage.setItem('ptk-ball-sound', soundOn ? 'on' : 'off'); } catch {}
  syncSoundBtn();
});
function syncSoundBtn() {
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.querySelector('span').textContent = soundOn ? 'Sound on' : 'Sound off';
}

function unlockAudio() {           // browsers only allow audio after a user gesture
  if (!audio) {
    try { audio = new AudioContext(); } catch { audio = null; return; }
    spriteBytes.then((bytes) => bytes && audio.decodeAudioData(bytes))
      .then((buf) => { bounceBuf = buf || null; })
      .catch(() => {});
  }
  audio.resume?.();
}

function thock(speed) {
  if (!soundOn || !audio || !bounceBuf || speed < 140) return;
  const now = audio.currentTime;
  if (now - lastThock < 0.04) return;                      // walls + floor at once: one sound
  lastThock = now;

  const group = speed > 1700 ? 'hard' : speed > 700 ? 'medium' : 'soft';
  const takes = SPRITE[group];
  const start = takes[turn[group]++ % takes.length];

  const src = audio.createBufferSource();
  src.buffer = bounceBuf;
  src.playbackRate.value = 0.96 + Math.random() * 0.08;    // tiny pitch wobble, sounds less canned
  const gain = audio.createGain();
  gain.gain.value = Math.min(1, Math.max(0.1, speed / 2400)) * 0.7;
  src.connect(gain).connect(audio.destination);
  src.start(now, start, SPRITE.clip);
}

// ------------------------------------------------------------------ go
// Respect reduced motion, and bail out quietly without WebGL: the static ball image stays.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion || !hasWebGL()) {
  hint.textContent = '';
  slot.setAttribute('aria-label', '404');
  slot.tabIndex = -1;
} else {
  start();
}

// ------------------------------------------------------------------ helpers
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function easeOutBack(t) { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,43,92,0.55)');
  grad.addColorStop(0.5, 'rgba(0,43,92,0.22)');
  grad.addColorStop(1, 'rgba(0,43,92,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
