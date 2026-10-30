/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Colour picker (01 §7.29, `<ColorPicker>`): a 36px field with a 20px swatch (radius 6, 1px `--zc-border`) and the
 * hex value in `body`, uppercase. Click opens a 240px popover (radius 12, padding 12): a 216×140 saturation area, a
 * 12px hue slider, a hex input, and up to 8 swatches of the store's saved colours.
 * `trigger` replaces the field (e.g. a tertiary "Change" next to a swatch).
 */
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactElement } from "react";
import { cx } from "./cx";
import { Input } from "./Input";

export interface ColorPickerProps {
  /** "#RRGGBB" or "" when not set. */
  value: string;
  onChange: (hex: string) => void;
  /** Names the field and the popover ("Brand colour"). */
  label: string;
  /** Saved colours, at most 8 are shown. */
  swatches?: string[];
  isDisabled?: boolean;
  /** Replaces the default field as the popover trigger. */
  trigger?: ReactElement;
  id?: string;
  className?: string;
}

// ─── Colour maths (HSV ↔ hex) ─────────────────────────────────────────────────

interface Hsv {
  h: number;
  s: number;
  v: number;
}

const HEX_INPUT = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

function normalizeHex(input: string): string | null {
  const match = HEX_INPUT.exec(input.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1];
  return `#${digits.toUpperCase()}`;
}

function hexToHsv(hex: string): Hsv {
  const value = normalizeHex(hex);
  if (!value) return { h: 0, s: 0, v: 0 };
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const channel = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(channel * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`.toUpperCase();
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// ─── Component ───────────────────────────────────────────────────────────────

export function ColorPicker({ value, onChange, label, swatches = [], isDisabled, trigger, id, className }: ColorPickerProps) {
  const current = normalizeHex(value);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current ?? ""));
  const [hexText, setHexText] = useState(current ?? "");
  const areaRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Follow outside changes (discard, load) without fighting the drag.
  useEffect(() => {
    if (!current) {
      setHexText("");
      return;
    }
    setHexText(current);
    setHsv((previous) => (hsvToHex(previous) === current ? previous : hexToHsv(current)));
  }, [current]);

  const commit = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexText(hex);
    onChange(hex);
  };

  const fromArea = (event: PointerEvent<HTMLDivElement>) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    commit({ h: hsv.h, s: clamp01((event.clientX - rect.left) / rect.width), v: 1 - clamp01((event.clientY - rect.top) / rect.height) });
  };

  const fromHue = (event: PointerEvent<HTMLDivElement>) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    commit({ ...hsv, h: clamp01((event.clientX - rect.left) / rect.width) * 359 });
  };

  const drag = (handler: (event: PointerEvent<HTMLDivElement>) => void) => ({
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      handler(event);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) handler(event);
    },
  });

  const onAreaKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: clamp01(hsv.s - step) },
      ArrowRight: { s: clamp01(hsv.s + step) },
      ArrowUp: { v: clamp01(hsv.v + step) },
      ArrowDown: { v: clamp01(hsv.v - step) },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    commit({ ...hsv, ...move });
  };

  const onHueKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -step : step;
    commit({ ...hsv, h: Math.max(0, Math.min(359, hsv.h + delta)) });
  };

  const hueColor = `hsl(${Math.round(hsv.h)} 100% 50%)`;
  const shown = current ?? "";

  const field = (
    <button
      type="button"
      id={id}
      disabled={isDisabled}
      aria-label={`${label}: ${shown || "not set"}`}
      className={cx(
        "flex h-9 w-full items-center gap-2 rounded-field border border-field-line bg-surface px-3 text-left text-body text-fg",
        "transition-colors hover:border-field-line-hover focus-visible:shadow-focus focus-visible:outline-none",
        "disabled:border-line disabled:bg-surface-muted disabled:text-fg-disabled",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-5 shrink-0 rounded-sm border border-line"
        style={shown ? { background: shown } : undefined}
      />
      <span className={cx("num uppercase", !shown && "text-fg-placeholder normal-case")}>{shown || "Not set"}</span>
    </button>
  );

  return (
    <Popover placement="bottom-start" offset={6}>
      <PopoverTrigger>{trigger ?? field}</PopoverTrigger>
      <PopoverContent className="w-60 rounded-tile border border-line bg-surface p-3 shadow-popover">
        <div className="flex w-full flex-col gap-3" aria-label={label} role="group">
          <div
            ref={areaRef}
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuetext={hsvToHex(hsv)}
            onKeyDown={onAreaKey}
            {...drag(fromArea)}
            className="relative h-35 w-full cursor-crosshair touch-none rounded-field focus-visible:shadow-focus focus-visible:outline-none"
            style={{
              background: `linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent), ${hueColor}`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-popover"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }}
            />
          </div>
          <div
            ref={hueRef}
            role="slider"
            tabIndex={0}
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={Math.round(hsv.h)}
            onKeyDown={onHueKey}
            {...drag(fromHue)}
            className="relative h-3 w-full cursor-pointer touch-none rounded-full focus-visible:shadow-focus focus-visible:outline-none"
            style={{
              background: "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-popover"
              style={{ left: `${(hsv.h / 359) * 100}%`, background: hueColor }}
            />
          </div>
          <Input
            size="sm"
            aria-label="Hex code"
            labelPlacement="outside"
            placeholder="Hex code"
            value={hexText}
            onValueChange={(text) => {
              setHexText(text);
              const hex = normalizeHex(text);
              if (hex) {
                setHsv(hexToHsv(hex));
                onChange(hex);
              }
            }}
            classNames={{ input: "uppercase num" }}
          />
          {swatches.length ? (
            <div className="flex flex-wrap gap-2" role="list" aria-label="Saved colours">
              {swatches.slice(0, 8).map((swatch) => {
                const hex = normalizeHex(swatch);
                if (!hex) return null;
                return (
                  <button
                    key={hex}
                    type="button"
                    role="listitem"
                    aria-label={hex}
                    aria-pressed={hex === current}
                    onClick={() => {
                      setHsv(hexToHsv(hex));
                      setHexText(hex);
                      onChange(hex);
                    }}
                    className={cx(
                      "size-6 rounded-sm border border-line focus-visible:shadow-focus focus-visible:outline-none",
                      hex === current && "ring-2 ring-brand ring-offset-1",
                    )}
                    style={{ background: hex }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
