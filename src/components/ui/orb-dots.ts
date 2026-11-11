/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The dot-sphere orb (Orb.tsx; owner, 2026-11-11): a sphere of dots in the orb blues that turns slowly in a soft
 * glow, drawn on a canvas.
 * - idle: a slow turn. listening: the dots bubble gently and the glow breathes.
 * - thinking: the surface bubbles up organically, dots pushed slightly outwards.
 * - working: a line of dots sweeps across the sphere, horizontally, vertically and at angles, the rest dimmed.
 * - done: a slow turn with a brighter ambient glow.
 * - waiting (stuck, waiting for the user): the dots fold into a cube and hold still.
 * One shared animation frame draws every orb; an orb draws only while it is on screen and the tab is visible. With
 * reduced motion, and on a phone while idle or done (round 2 §8.10), it draws one still frame.
 * Colours come from the orb tokens (`--zc-orb-blue`, `--zc-orb-deep`, `--zc-orb-cyan`).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrbMotion = "idle" | "listening" | "thinking" | "working" | "done" | "waiting";

interface OrbMix {
  /** Turn speed, radians per second. */
  spin: number;
  /** 0–1: how much the surface bubbles. */
  bubble: number;
  /** 0–1: the sweeping line of dots. */
  sweep: number;
  /** 0–1: sphere → cube. */
  cube: number;
  /** Glow opacity at the centre. */
  glow: number;
  /** 0–1: how much the glow breathes. */
  pulse: number;
}

export interface OrbHandle {
  setMotion: (motion: OrbMotion) => void;
  destroy: () => void;
}

interface OrbEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** The orb's own box, CSS px (the canvas spills past it for the glow). */
  size: number;
  /** Canvas side, CSS px. */
  side: number;
  dpr: number;
  sphere: Float32Array;
  cubeAt: Float32Array;
  /** Dominant cube face per dot: 0 x, 1 y, 2 z, signed by +1 / -1 in `faceSign`. */
  face: Uint8Array;
  faceSign: Int8Array;
  count: number;
  motion: OrbMotion;
  mix: OrbMix;
  yaw: number;
  /** The cube's resting turn, fixed when waiting starts so it never jumps. */
  snapYaw: number;
  onDark: boolean;
  visible: boolean;
  still: boolean;
  dirty: boolean;
  /** Seconds since the orb was mounted (its own clock, so orbs aren't in lock step). */
  clock: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

const TARGETS: Record<OrbMotion, OrbMix> = {
  idle: { spin: 0.35, bubble: 0, sweep: 0, cube: 0, glow: 0.22, pulse: 0 },
  listening: { spin: 0.6, bubble: 0.45, sweep: 0, cube: 0, glow: 0.28, pulse: 1 },
  thinking: { spin: 0.75, bubble: 1, sweep: 0, cube: 0, glow: 0.3, pulse: 0.4 },
  working: { spin: 0.45, bubble: 0, sweep: 1, cube: 0, glow: 0.26, pulse: 0 },
  done: { spin: 0.22, bubble: 0, sweep: 0, cube: 0, glow: 0.42, pulse: 0.35 },
  waiting: { spin: 0, bubble: 0, sweep: 0, cube: 1, glow: 0.3, pulse: 0 },
};

/** How fast a state change blends in, per second (≈ 400ms; the cube folds a little slower). */
const BLEND_RATE = 6;
const CUBE_RATE = 4;
/** The sphere's resting tilt and the cube's isometric tilt (radians). */
const TILT = 0.38;
const ISO_TILT = 0.6155;
/** One sweep of the working line, seconds; the line's half width on the unit sphere. */
const SWEEP_S = 1.7;
const SWEEP_WIDTH = 0.14;
/** Sweep directions in view space: across, down, and the two diagonals. */
const SWEEP_AXES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [0.7071, 0.7071],
  [-0.7071, 0.7071],
];
/** Sphere radius as a share of half the orb box; the canvas is 160% of the box. */
const RADIUS_SHARE = 0.9;
const CANVAS_SHARE = 1.6;
/** Half side of the cube on the unit sphere's scale (its outline matches the sphere's). */
const CUBE_HALF = 0.6;
const MAX_DPR = 2;
const MAX_STEP_S = 0.05;

// ─── Colours ─────────────────────────────────────────────────────────────────

type Rgb = readonly [number, number, number];

interface OrbPalette {
  dot: Rgb;
  strong: Rgb;
  glow: Rgb;
}

let palettes: { light: OrbPalette; dark: OrbPalette } | null = null;

/** Reads a token colour (`#rrggbb` or `rgb()`) into channels. */
function readToken(name: string, fallback: Rgb): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(value);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : fallback;
}

function getPalettes() {
  if (palettes) return palettes;
  const white: Rgb = [255, 255, 255];
  const blue = readToken("--zc-orb-blue", [59, 130, 246]);
  const deep = readToken("--zc-orb-deep", [29, 78, 216]);
  const cyan = readToken("--zc-orb-cyan", [125, 211, 252]);
  palettes = {
    light: { dot: blue, strong: deep, glow: blue },
    dark: { dot: white, strong: cyan, glow: cyan },
  };
  return palettes;
}

const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;

// ─── Points ──────────────────────────────────────────────────────────────────

/** Fewer, larger dots on small orbs so they still read as a dotted sphere. */
const dotCount = (size: number) => Math.max(48, Math.min(420, Math.round(size * 4.2)));
const dotRadius = (size: number) => Math.max(0.65, size * 0.022);

/**
 * Evenly spread points on the unit sphere (Fibonacci), and for each one its place on the cube: the point pushed
 * onto the cube's surface, then snapped to that face's grid so the cube reads as neat rows.
 */
function buildPoints(count: number) {
  const sphere = new Float32Array(count * 3);
  const cubeAt = new Float32Array(count * 3);
  const face = new Uint8Array(count);
  const faceSign = new Int8Array(count);
  const golden = Math.PI * (3 - Math.sqrt(5));
  // Grid steps per cube edge so the six faces hold about as many slots as there are dots.
  const perEdge = Math.max(3, Math.round(Math.sqrt(count / 6)) + 1);
  const step = (2 * CUBE_HALF) / (perEdge - 1);
  const snap = (v: number) => Math.round((v + CUBE_HALF) / step) * step - CUBE_HALF;

  for (let i = 0; i < count; i += 1) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const x = Math.cos(golden * i) * ring;
    const z = Math.sin(golden * i) * ring;
    sphere.set([x, y, z], i * 3);

    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const az = Math.abs(z);
    const big = Math.max(ax, ay, az);
    const axis = big === ax ? 0 : big === ay ? 1 : 2;
    const onCube = [(x / big) * CUBE_HALF, (y / big) * CUBE_HALF, (z / big) * CUBE_HALF];
    for (let k = 0; k < 3; k += 1) onCube[k] = k === axis ? onCube[k] : snap(onCube[k]);
    cubeAt.set(onCube, i * 3);
    face[i] = axis;
    faceSign[i] = [x, y, z][axis] >= 0 ? 1 : -1;
  }
  return { sphere, cubeAt, face, faceSign };
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

/** A smooth, moving bump field on the sphere (the thinking surface): 0 most places, up to 1 on a bubble. */
function bubbleAt(x: number, y: number, z: number, t: number) {
  const a = Math.sin(3.1 * x + 1.9 * t) * Math.sin(2.7 * y - 1.4 * t + 1) * Math.sin(2.3 * z + 1.1 * t + 2);
  const b = Math.sin(4.3 * y + 2.3 * t + 0.5) * Math.sin(3.7 * z - 1.7 * t) * Math.sin(3.3 * x + 0.9 * t + 1.3);
  const n = Math.max(0, Math.min(1, (a * 0.65 + b * 0.35) * 2.2));
  return n * n;
}

function draw(entry: OrbEntry) {
  const { ctx, side, dpr, count, sphere, cubeAt, face, faceSign, mix, clock } = entry;
  const palette = entry.onDark ? getPalettes().dark : getPalettes().light;
  const centre = side / 2;
  const radius = (entry.size / 2) * RADIUS_SHARE;
  const dotR = dotRadius(entry.size);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, side, side);

  // Ambient glow behind the dots.
  const glow = mix.glow * (1 + mix.pulse * 0.25 * Math.sin(clock * 2.4));
  const gradient = ctx.createRadialGradient(centre, centre, 0, centre, centre, radius * 1.6);
  gradient.addColorStop(0, rgba(palette.glow, glow));
  gradient.addColorStop(0.55, rgba(palette.glow, glow * 0.45));
  gradient.addColorStop(1, rgba(palette.glow, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, side, side);

  // Turn: yaw about the vertical axis, then tilt towards the viewer.
  const yaw = entry.yaw + (entry.snapYaw - entry.yaw) * mix.cube;
  const tilt = TILT + (ISO_TILT - TILT) * mix.cube;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);

  // The working line: a plane moving across the sphere along one view-space direction per sweep.
  const sweepIndex = Math.floor(clock / SWEEP_S);
  const [ax, ay] = SWEEP_AXES[sweepIndex % SWEEP_AXES.length];
  const sweepAt = Math.cos(Math.PI * ((clock / SWEEP_S) % 1));

  for (let i = 0; i < count; i += 1) {
    const o = i * 3;
    let x = sphere[o];
    let y = sphere[o + 1];
    let z = sphere[o + 2];

    if (mix.bubble > 0.001) {
      const lift = 1 + mix.bubble * 0.14 * bubbleAt(x, y, z, clock);
      x *= lift;
      y *= lift;
      z *= lift;
    }
    if (mix.cube > 0.001) {
      x += (cubeAt[o] - x) * mix.cube;
      y += (cubeAt[o + 1] - y) * mix.cube;
      z += (cubeAt[o + 2] - z) * mix.cube;
    }

    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * ct - z1 * st;
    const z2 = y * st + z1 * ct;

    // Front dots are larger and stronger, back dots small and faint.
    const depth = Math.max(0, Math.min(1, (z2 + 1) / 2));
    let alpha = 0.16 + 0.84 * Math.pow(depth, 1.3);
    let r = dotR * (0.6 + 0.55 * depth);
    let strong = false;

    if (mix.sweep > 0.001) {
      const along = (x1 * ax + y2 * ay) / Math.max(0.0001, Math.hypot(x, y, z));
      const hit = Math.exp(-(((along - sweepAt) / SWEEP_WIDTH) ** 2)) * mix.sweep;
      alpha = alpha * (1 - 0.45 * mix.sweep) + hit * 0.9;
      r *= 1 + 0.7 * hit;
      strong = hit > 0.35;
    }
    if (mix.cube > 0.5) {
      // Shade the cube by face: the top face lighter, the right-hand side face darker, the left one as is.
      const n = [0, 0, 0];
      n[face[i]] = faceSign[i];
      const nx1 = n[0] * cy + n[2] * sy;
      const nz1 = -n[0] * sy + n[2] * cy;
      const ny2 = n[1] * ct - nz1 * st;
      if (ny2 > 0.6) alpha *= 0.55;
      else if (nx1 > 0.3) strong = true;
    }

    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = rgba(strong ? palette.strong : palette.dot, 1);
    ctx.beginPath();
    ctx.arc(centre + x1 * radius, centre - y2 * radius, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Loop ────────────────────────────────────────────────────────────────────

const entries = new Set<OrbEntry>();
let frame = 0;
let lastTime = 0;
let observer: IntersectionObserver | null = null;
let listening = false;

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const isPhone = () => window.matchMedia?.("(max-width: 767px)").matches ?? false;

function isStill(motion: OrbMotion) {
  return prefersReducedMotion() || (isPhone() && (motion === "idle" || motion === "done"));
}

function blend(entry: OrbEntry, dt: number) {
  const target = TARGETS[entry.motion];
  const k = 1 - Math.exp(-dt * BLEND_RATE);
  const kCube = 1 - Math.exp(-dt * CUBE_RATE);
  const mix = entry.mix;
  mix.spin += (target.spin - mix.spin) * k;
  mix.bubble += (target.bubble - mix.bubble) * k;
  mix.sweep += (target.sweep - mix.sweep) * k;
  mix.cube += (target.cube - mix.cube) * kCube;
  mix.glow += (target.glow - mix.glow) * k;
  mix.pulse += (target.pulse - mix.pulse) * k;
  entry.yaw += mix.spin * dt;
  entry.clock += dt;
}

function tick(now: number) {
  const dt = Math.min(MAX_STEP_S, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  let moving = false;
  for (const entry of entries) {
    if (!entry.visible) continue;
    if (entry.still) {
      if (entry.dirty) {
        entry.mix = { ...TARGETS[entry.motion] };
        draw(entry);
        entry.dirty = false;
      }
      continue;
    }
    moving = true;
    blend(entry, dt);
    draw(entry);
  }
  frame = moving && !document.hidden ? requestAnimationFrame(tick) : 0;
}

function wake() {
  if (frame || document.hidden) return;
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
}

function ensureListeners() {
  if (listening) return;
  listening = true;
  document.addEventListener("visibilitychange", wake);
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver((records) => {
      for (const record of records) {
        for (const entry of entries) {
          if (entry.canvas !== record.target) continue;
          entry.visible = record.isIntersecting;
          entry.dirty = true;
        }
      }
      wake();
    });
  }
}

// ─── Public ──────────────────────────────────────────────────────────────────

/** Starts drawing an orb on `canvas`, sized from its box `box` (the orb's own size, CSS px). */
export function mountOrb(canvas: HTMLCanvasElement, box: HTMLElement, motion: OrbMotion, onDark: boolean): OrbHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { setMotion: () => undefined, destroy: () => undefined };
  ensureListeners();

  const size = box.offsetWidth || 18;
  const side = size * CANVAS_SHARE;
  const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.round(side * dpr);
  canvas.height = Math.round(side * dpr);

  const count = dotCount(size);
  const entry: OrbEntry = {
    canvas,
    ctx,
    size,
    side,
    dpr,
    ...buildPoints(count),
    count,
    motion,
    mix: { ...TARGETS[motion] },
    yaw: Math.random() * Math.PI * 2,
    snapYaw: 0,
    onDark,
    visible: true,
    still: isStill(motion),
    dirty: true,
    clock: Math.random() * 10,
  };
  entry.snapYaw = snapYawFor(entry.yaw);
  entries.add(entry);
  observer?.observe(canvas);
  wake();

  return {
    setMotion(next) {
      if (next === entry.motion) return;
      if (next === "waiting") entry.snapYaw = snapYawFor(entry.yaw + entry.mix.spin * 0.4);
      entry.motion = next;
      entry.still = isStill(next);
      entry.dirty = true;
      wake();
    },
    destroy() {
      entries.delete(entry);
      observer?.unobserve(canvas);
    },
  };
}

/** The nearest turn that shows the cube corner-on (45° plus quarter turns). */
function snapYawFor(yaw: number) {
  const quarter = Math.PI / 2;
  return Math.round((yaw - quarter / 2) / quarter) * quarter + quarter / 2;
}
