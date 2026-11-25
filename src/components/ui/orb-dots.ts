/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The AI glyph (Orb.tsx): a globe of dots drawn on a canvas. Owner, 2026-11-25 ("AI glyph · All states in one loop"
 * video): no glow, front dots larger and stronger, rim dots small and faint, and four stages that blend into each
 * other (the spin speeds up and slows down smoothly, the ripple fades in and out, a breath starts and ends at full
 * size, so no stage ever jumps):
 * - idle: a slow turn, 10 s a turn.
 * - thinking: the spin eases up to 3 s a turn; a ripple fades in and travels up the globe; a gentle breath.
 * - working (answering): the ripple fades out; a band of bright dots sweeps up the globe, over and over, while it turns.
 * - done: one slow breath while the turn slows to a stop; it rests, then eases back into the idle turn.
 * - listening (the user is typing): the idle turn a little quicker, with a gentle breath.
 * - waiting (stuck, waiting for the user): the dots fold into a cube and hold still (owner, 2026-11-11).
 * One shared animation frame draws every glyph; a glyph draws only while it is on screen and the tab is visible. With
 * reduced motion, and on a phone while idle or done (round 2 §8.10), it draws one still frame.
 * Colours come from the orb tokens (`--zc-orb-blue`, `--zc-orb-deep`); white dots on dark backgrounds.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrbMotion = "idle" | "listening" | "thinking" | "working" | "done" | "waiting";

interface OrbMix {
  /** Turn speed, radians per second. */
  spin: number;
  /** 0–1: the travelling ripple (thinking). */
  ripple: number;
  /** 0–1: the band of bright dots sweeping up (answering). */
  band: number;
  /** 0–1: the gentle, continuous breath (thinking, listening). */
  breath: number;
  /** 0–1: sphere → cube. */
  cube: number;
}

export interface OrbHandle {
  setMotion: (motion: OrbMotion) => void;
  destroy: () => void;
}

interface OrbEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** The glyph's own box, CSS px (the canvas spills past it so a ripple or a bright dot is never clipped). */
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
  /** Clock time the done stage started (its breath and stop run from here). */
  doneAt: number;
  /** Clock time the answering stage started (the band sweeps from the bottom from here). */
  bandAt: number;
  onDark: boolean;
  visible: boolean;
  still: boolean;
  dirty: boolean;
  /** Seconds since the glyph was mounted (its own clock, so glyphs aren't in lock step). */
  clock: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

const TURN = Math.PI * 2;
/** Spin per stage: idle 10 s a turn, thinking 3 s, answering 4 s, listening 7 s. */
const IDLE_SPIN = TURN / 10;
const TARGETS: Record<Exclude<OrbMotion, "done">, OrbMix> = {
  idle: { spin: IDLE_SPIN, ripple: 0, band: 0, breath: 0, cube: 0 },
  listening: { spin: TURN / 7, ripple: 0, band: 0, breath: 0.6, cube: 0 },
  thinking: { spin: TURN / 3, ripple: 1, band: 0, breath: 1, cube: 0 },
  working: { spin: TURN / 4, ripple: 0, band: 1, breath: 0, cube: 0 },
  waiting: { spin: 0, ripple: 0, band: 0, breath: 0, cube: 1 },
};

/** Done: the breath and the slow stop take this long, then the glyph rests, then eases back into the idle turn. */
const DONE_BREATH_S = 2.6;
const DONE_REST_S = 1.4;
/** The done breath shrinks the globe to 86% at its deepest; the thinking breath to 97%. */
const DONE_BREATH_DEPTH = 0.14;
const BREATH_DEPTH = 0.03;
const BREATH_S = 2.6;

/** How fast a stage blends in, per second: the spin eases over about a second, the ripple and band a little faster. */
const SPIN_RATE = 1.6;
const BLEND_RATE = 3;
const CUBE_RATE = 4;
/** The globe's resting tilt (top towards the viewer) and the cube's isometric tilt (radians). */
const TILT = 0.38;
const ISO_TILT = 0.6155;
/** Ripple height on the unit sphere (a hero glyph, the sign-in character, ripples more). */
const RIPPLE = 0.075;
const HERO_RIPPLE = 0.12;
/** One sweep of the answering band, bottom to top, seconds; the band's half width on the unit sphere. */
const SWEEP_S = 2.4;
const BAND_WIDTH = 0.13;
/** Globe radius as a share of half the glyph box; the canvas is 140% of the box. */
const RADIUS_SHARE = 0.92;
const CANVAS_SHARE = 1.4;
/** Half side of the cube on the unit sphere's scale (its outline matches the sphere's). */
const CUBE_HALF = 0.6;
const MAX_DPR = 2;
const MAX_STEP_S = 0.05;

// ─── Colours ─────────────────────────────────────────────────────────────────

type Rgb = readonly [number, number, number];

interface OrbPalette {
  dot: Rgb;
  strong: Rgb;
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
  palettes = {
    light: { dot: blue, strong: deep },
    dark: { dot: white, strong: white },
  };
  return palettes;
}

const rgb = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

// ─── Points ──────────────────────────────────────────────────────────────────

/** Fewer, larger dots on small glyphs so they still read as a dotted globe; a hero glyph is a fine, dense mesh. */
const HERO_SIZE = 64;
const dotCount = (size: number) =>
  size > HERO_SIZE ? Math.min(1100, Math.round(size * 8)) : Math.max(48, Math.min(420, Math.round(size * 4.2)));
const dotRadius = (size: number) =>
  size > HERO_SIZE ? Math.min(3, Math.max(1.3, size * 0.0088)) : Math.max(0.8, Math.min(1.3, size * 0.03));

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

// ─── Motion ──────────────────────────────────────────────────────────────────

const easeInOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * The thinking ripple at a point (−1 to 1): rings that travel up the globe, crossed by a slow three-lobed wave round
 * it, so the outline goes softly lumpy as in the video, never spiky.
 */
function rippleAt(x: number, y: number, z: number, t: number) {
  const around = Math.atan2(z, x);
  return 0.62 * Math.sin(5.5 * y - 4.2 * t) + 0.38 * Math.sin(3 * around + 2.2 * y - 1.6 * t);
}

/** Where the answering band is: from below the globe to above it, once per sweep (−1.2 to 1.2 on the globe's axis). */
const bandAt = (seconds: number) => -1.2 + 2.4 * ((seconds / SWEEP_S) % 1);

/** The target mix for a stage; done follows its own timeline (breath and stop, rest, back to idle). */
function targetFor(entry: OrbEntry): OrbMix {
  if (entry.motion !== "done") return TARGETS[entry.motion];
  const since = entry.clock - entry.doneAt;
  const resting = since < DONE_BREATH_S + DONE_REST_S;
  return { ...TARGETS.idle, spin: resting ? 0 : IDLE_SPIN };
}

/** Overall scale of the globe now: the gentle breath, and the one deep breath of done. */
function scaleFor(entry: OrbEntry) {
  const { mix, clock } = entry;
  let scale = 1 - mix.breath * BREATH_DEPTH * (1 - Math.cos((TURN * clock) / BREATH_S)) * 0.5;
  if (entry.motion === "done") {
    const p = (clock - entry.doneAt) / DONE_BREATH_S;
    if (p > 0 && p < 1) scale *= 1 - DONE_BREATH_DEPTH * Math.sin(Math.PI * easeInOut(p));
  }
  return scale;
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

function draw(entry: OrbEntry) {
  const { ctx, side, dpr, count, sphere, cubeAt, face, faceSign, mix, clock } = entry;
  const palette = entry.onDark ? getPalettes().dark : getPalettes().light;
  const centre = side / 2;
  const radius = (entry.size / 2) * RADIUS_SHARE * scaleFor(entry);
  const dotR = dotRadius(entry.size);
  const rippleHeight = (entry.size > HERO_SIZE ? HERO_RIPPLE : RIPPLE) * mix.ripple;
  const band = bandAt(clock - entry.bandAt);
  const small = entry.size <= 48;
  const backAlpha = small ? 0.22 : 0.06;
  const depthCurve = small ? 1.3 : 1.6;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, side, side);

  // Turn: yaw about the vertical axis, then tilt the top towards the viewer.
  const yaw = entry.yaw + (entry.snapYaw - entry.yaw) * mix.cube;
  const tilt = TILT + (ISO_TILT - TILT) * mix.cube;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);

  for (let i = 0; i < count; i += 1) {
    const o = i * 3;
    let x = sphere[o];
    let y = sphere[o + 1];
    let z = sphere[o + 2];
    // The band follows the globe's own axis, so it reads as a ring of latitude moving up.
    const latitude = y;

    if (rippleHeight > 0.0005) {
      const lift = 1 + rippleHeight * rippleAt(x, y, z, clock);
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

    // Front dots are larger and stronger, rim dots small and grey, the back barely there (a small glyph keeps its
    // back dots a little stronger so it still reads as a full globe).
    const depth = Math.max(0, Math.min(1, (z2 + 1) / 2));
    let alpha = backAlpha + (1 - backAlpha) * Math.pow(depth, depthCurve);
    let r = dotR * (0.55 + 0.6 * depth);
    let strong = false;

    if (mix.band > 0.001) {
      const hit = Math.exp(-(((latitude - band) / BAND_WIDTH) ** 2)) * mix.band;
      alpha = alpha * (1 - 0.18 * mix.band) + hit;
      r *= 1 + 0.45 * hit;
      strong = hit > 0.3;
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
    ctx.fillStyle = rgb(strong ? palette.strong : palette.dot);
    ctx.beginPath();
    ctx.arc(centre + x1 * radius, centre - y2 * radius, r, 0, TURN);
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
  entry.clock += dt;
  const target = targetFor(entry);
  const k = 1 - Math.exp(-dt * BLEND_RATE);
  const kSpin = 1 - Math.exp(-dt * SPIN_RATE);
  const kCube = 1 - Math.exp(-dt * CUBE_RATE);
  const mix = entry.mix;
  mix.spin += (target.spin - mix.spin) * kSpin;
  mix.ripple += (target.ripple - mix.ripple) * k;
  mix.band += (target.band - mix.band) * k;
  mix.breath += (target.breath - mix.breath) * k;
  mix.cube += (target.cube - mix.cube) * kCube;
  entry.yaw += mix.spin * dt;
}

function tick(now: number) {
  const dt = Math.min(MAX_STEP_S, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  let moving = false;
  for (const entry of entries) {
    if (!entry.visible) continue;
    if (entry.still) {
      if (entry.dirty) {
        entry.mix = { ...targetFor(entry), spin: 0 };
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

/** Starts drawing a glyph on `canvas`, sized from its box `box` (the glyph's own size, CSS px). */
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
  const clock = Math.random() * 10;
  const entry: OrbEntry = {
    canvas,
    ctx,
    size,
    side,
    dpr,
    ...buildPoints(count),
    count,
    motion,
    // A glyph mounted already done starts at rest, not mid-breath.
    mix: motion === "done" ? { ...TARGETS.idle } : { ...TARGETS[motion] },
    yaw: Math.random() * TURN,
    snapYaw: 0,
    doneAt: motion === "done" ? clock - DONE_BREATH_S - DONE_REST_S : clock,
    bandAt: clock,
    onDark,
    visible: true,
    still: isStill(motion),
    dirty: true,
    clock,
  };
  entry.snapYaw = snapYawFor(entry.yaw);
  entries.add(entry);
  observer?.observe(canvas);
  wake();

  return {
    setMotion(next) {
      if (next === entry.motion) return;
      if (next === "waiting") entry.snapYaw = snapYawFor(entry.yaw + entry.mix.spin * 0.4);
      if (next === "done") entry.doneAt = entry.clock;
      // The band always starts its first sweep from the bottom.
      if (next === "working") entry.bandAt = entry.clock;
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
