/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import morningPoster from "../../assets/banner/morning-sky-poster.jpg";
import morningClip from "../../assets/banner/morning-sky.mp4";
import nightPoster from "../../assets/banner/night-poster.jpg";
import nightClip from "../../assets/banner/night.mp4";
import sunsetPoster from "../../assets/banner/sunset-poster.jpg";
import sunsetClip from "../../assets/banner/sunset.mp4";
import { cx } from "./cx";
import { Skeleton } from "./Skeleton";

/**
 * Home banner (01 §7.22, `.zc-banner` in src/styles/components.css): a time-of-day video loop behind a scrim, the
 * date eyebrow, the greeting (display) and a sub-line, one glass button top right, and up to 4 glass tiles.
 * Without tiles (super admin) the greeting sits at the bottom left. 304px tall (264 on tablet, auto on phone).
 *
 * The clip follows the given time zone: morning sky 05:00–16:59, sunset 17:00–19:59, night 20:00–04:59; the greeting
 * says morning before 12, afternoon before 17, evening after. The video fades in over its poster when it plays,
 * crossfades when the clock crosses a boundary, pauses when the tab is hidden or the banner is off screen, and is
 * replaced by the poster under reduced motion, Save-Data or a 2g connection.
 */
type Clip = "morning" | "sunset" | "night";

const CLIPS: Record<Clip, { src: string; poster: string; position: string }> = {
  morning: { src: morningClip, poster: morningPoster, position: "30% 60%" },
  sunset: { src: sunsetClip, poster: sunsetPoster, position: "70% 60%" },
  night: { src: nightClip, poster: nightPoster, position: "80% 45%" },
};

const CLOCK_TICK_MS = 60_000;
const CROSSFADE_MS = 600;

export interface VideoBannerTile {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
}

export interface VideoBannerProps {
  /** IANA time zone for the clip, greeting and date (default Asia/Kolkata). */
  timeZone?: string;
  /** Overrides the date eyebrow ("OCTOBER 2026 · 3 STORES"); shown uppercase. */
  eyebrow?: ReactNode;
  /** First name for the greeting; empty → "Good evening" alone. */
  name?: string;
  subline?: ReactNode;
  /** The one glass button, top right ("View store ↗", "+ Add store"). */
  action?: ReactNode;
  tiles?: VideoBannerTile[];
  className?: string;
}

function hourIn(timeZone: string, date: Date): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(date));
  } catch {
    return date.getHours();
  }
}

function dateIn(timeZone: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone }).format(date);
  } catch {
    return date.toDateString();
  }
}

const clipFor = (hour: number): Clip => (hour >= 5 && hour < 17 ? "morning" : hour >= 17 && hour < 20 ? "sunset" : "night");
const greetingFor = (hour: number) =>
  hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";

/** Poster only: reduced motion, Save-Data, or a 2g connection. */
function posterOnly(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!connection?.saveData || connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g";
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function BannerVideo({ clip, entering, staticOnly }: { clip: Clip; entering: boolean; staticOnly: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  // Muted as a property too: React doesn't always set the attribute, and browsers then block autoplay.
  // Play only while the tab is visible and the banner is on screen.
  useEffect(() => {
    const video = ref.current;
    if (!video || staticOnly) return undefined;
    video.muted = true;
    let onScreen = true;
    const sync = () => {
      if (onScreen && document.visibilityState === "visible") void video.play().catch(() => undefined);
      else video.pause();
    };
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            sync();
          })
        : null;
    observer?.observe(video);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [staticOnly]);

  const { src, poster, position } = CLIPS[clip];
  return (
    <div
      aria-hidden
      className={cx("zc-banner__layer", entering && "zc-banner__layer--enter")}
      style={{ backgroundImage: `url(${poster})`, backgroundPosition: position }}
    >
      {staticOnly ? null : (
        <video
          ref={ref}
          className={cx("zc-banner__video", playing && "is-playing")}
          style={{ objectPosition: position }}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          onPlaying={() => setPlaying(true)}
        >
          <source src={src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

export function VideoBanner({ timeZone = "Asia/Kolkata", eyebrow, name, subline, action, tiles, className }: VideoBannerProps) {
  const now = useClock();
  const hour = hourIn(timeZone, now);
  const clip = clipFor(hour);
  const [staticOnly] = useState(posterOnly);

  // When the clock crosses a boundary, the old clip stays underneath while the new one fades in.
  const [previous, setPrevious] = useState<Clip | null>(null);
  const shown = useRef(clip);
  // Before paint, so the new layer's first frame is already transparent and fades in.
  useLayoutEffect(() => {
    if (shown.current === clip) return undefined;
    setPrevious(shown.current);
    shown.current = clip;
    const timer = window.setTimeout(() => setPrevious(null), CROSSFADE_MS);
    return () => window.clearTimeout(timer);
  }, [clip]);

  const greeting = name ? `${greetingFor(hour)}, ${name}` : greetingFor(hour);
  const hasTiles = !!tiles?.length;

  return (
    <section aria-label="Welcome" className={cx("zc-banner", !hasTiles && "zc-banner--plain", className)}>
      {previous ? <BannerVideo key={previous} clip={previous} entering={false} staticOnly={staticOnly} /> : null}
      <BannerVideo key={clip} clip={clip} entering={previous !== null} staticOnly={staticOnly} />
      <div aria-hidden className="zc-banner__scrim" />

      <div className="zc-banner__top">
        <div className="min-w-0">
          <p className="zc-banner__eyebrow">{eyebrow ?? dateIn(timeZone, now)}</p>
          {hasTiles ? (
            <>
              <h1 className="zc-banner__greeting">{greeting}</h1>
              {subline ? <p className="zc-banner__subline">{subline}</p> : null}
            </>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {hasTiles ? (
        <div className="zc-banner__tiles">
          {tiles.map((tile, index) => (
            <div key={index} className="zc-banner__tile">
              <p className="zc-banner__tile-label">{tile.label}</p>
              {tile.loading ? (
                <Skeleton className="mt-1 h-7 w-20 bg-white/20" />
              ) : (
                <p className="zc-banner__tile-value num">{tile.value}</p>
              )}
              {tile.sub ? <p className="zc-banner__tile-sub">{tile.sub}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-auto">
          <h1 className="zc-banner__greeting">{greeting}</h1>
          {subline ? <p className="zc-banner__subline">{subline}</p> : null}
        </div>
      )}
    </section>
  );
}
