/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The orb character on the sign-in screen (docs/design-v2/README.md §5): the Zcom AI orb, large, with two eyes on
 * its bright core, in a soft blue halo. It asks one question at a time and its line types out under it.
 * - idle: the eyes follow the pointer, and with `follow` (0–1, how far along the field the caret is) they follow
 *   the typing; a blink now and then.
 * - shy (password): the eyes close and turn away ("I'm not looking.").
 * - thinking (signing in): the orb spins fast and three dots follow the line.
 * - sad (failed): drooping eyes. happy: a smile of the eyes.
 * Screen readers get each line once, politely; with reduced motion the eyes stay still and the line shows at once.
 */
import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "../ui/cx";

export type AuthBuddyMood = "idle" | "happy" | "shy" | "thinking" | "sad";

export interface AuthBuddyProps {
  /** The question or line under the orb. A new line is typed out again. */
  message: string;
  mood?: AuthBuddyMood;
  /** 0–1: where the caret is in the field being typed; the eyes follow it. */
  follow?: number;
  className?: string;
}

/** How far the eyes move, in px. */
const EYE_TRAVEL = 5;
const TYPE_MS = 24;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function AuthBuddy({ message, mood = "idle", follow, className }: AuthBuddyProps) {
  const orbRef = useRef<HTMLSpanElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [typed, setTyped] = useState(message);

  // Eyes follow the pointer anywhere on the page (the typing wins while `follow` is set).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = orbRef.current?.getBoundingClientRect();
        if (!box) return;
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, distance / 160);
        setLook({ x: (dx / distance) * EYE_TRAVEL * reach, y: (dy / distance) * EYE_TRAVEL * reach });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // A blink every 3–6 seconds.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        schedule();
      }, 3000 + Math.random() * 3000);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  // Type the line out.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setTyped(message);
      return;
    }
    setTyped("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(message.slice(0, index));
      if (index >= message.length) window.clearInterval(timer);
    }, TYPE_MS);
    return () => window.clearInterval(timer);
  }, [message]);

  const shut = mood === "shy" || blink;
  const typing = follow != null && mood === "idle";
  const offset =
    mood === "thinking"
      ? { x: 0, y: -EYE_TRAVEL }
      : mood === "shy"
        ? { x: -EYE_TRAVEL, y: 1 }
        : typing
          ? { x: (Math.max(0, Math.min(1, follow)) * 2 - 1) * EYE_TRAVEL, y: EYE_TRAVEL * 0.6 }
          : look;

  return (
    <div className={cx("flex flex-col items-center gap-5 text-center", className)}>
      <span ref={orbRef} aria-hidden className="zc-orb-wrap zc-auth-orb" data-state={mood === "thinking" ? "thinking" : "idle"}>
        <span className="zc-orb zc-orb--auth" />
        <span
          className="zc-auth-orb__eyes"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)${mood === "shy" ? " rotate(-8deg)" : ""}` }}
        >
          {[0, 1].map((eye) => (
            <span
              key={eye}
              className={cx(
                "zc-auth-orb__eye",
                shut && "zc-auth-orb__eye--shut",
                mood === "sad" && !shut && (eye === 0 ? "-rotate-12" : "rotate-12"),
                mood === "happy" && !shut && "zc-auth-orb__eye--happy",
              )}
            />
          ))}
        </span>
      </span>
      <p aria-hidden className="min-h-8 text-title-1 text-brand-on">
        {typed || " "}
        {mood === "thinking" ? <span className="zc-auth-dots" /> : null}
      </p>
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </div>
  );
}

/** A login field that slides open when its step comes (the next field after "Continue"). Closed, it can't be focused. Use in a `gap-4` column. */
export function AuthReveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cx(
        "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none",
        // Closed, it also gives back the form's 16px gap so no empty space is left.
        open ? "grid-rows-[1fr] opacity-100" : "-mt-4 grid-rows-[0fr] opacity-0",
      )}
      aria-hidden={open ? undefined : true}
      // `inert` keeps a closed field out of the tab order and away from screen readers.
      inert={!open}
    >
      {/* Padding inside the clip so the focus ring isn't cut off */}
      <div className="-m-1 overflow-hidden p-1">{children}</div>
    </div>
  );
}

export interface AuthCodeInputProps {
  /** The digits typed so far ("" to "123456"). */
  value: string;
  onChange: (value: string) => void;
  /** Called once all boxes are filled, with the full code. */
  onComplete?: (code: string) => void;
  length?: number;
  error?: string;
  /** For screen readers: "One-time code". */
  label: string;
  autoFocus?: boolean;
}

/**
 * A one-time code as separate boxes (owner, 2026-11-04): typing moves to the next box, Backspace to the previous,
 * arrows move, and pasting or the phone's code suggestion fills them all. Digits only; an empty box is a space in
 * `value`.
 */
export const AuthCodeInput = forwardRef<HTMLInputElement, AuthCodeInputProps>(function AuthCodeInput(
  { value, onChange, onComplete, length = 6, error, label, autoFocus },
  ref,
) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const errorId = useId();
  // An empty box is a space in `value`, so later digits stay in their boxes.
  const digits = Array.from({ length }, (_, index) => (value[index] ?? "").trim());
  const toValue = (list: string[]) => list.map((digit) => digit || " ").join("").trimEnd();

  const focusBox = (index: number) => boxes.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  const write = (start: number, typed: string) => {
    const clean = typed.replace(/\D/g, "");
    if (!clean) return;
    const next = digits.slice();
    clean
      .slice(0, length - start)
      .split("")
      .forEach((digit, offset) => {
        next[start + offset] = digit;
      });
    const code = toValue(next);
    onChange(code);
    focusBox(start + clean.length);
    if (/^\d+$/.test(code) && code.length === length) onComplete?.(code);
  };

  return (
    <div role="group" aria-label={label} aria-describedby={error ? errorId : undefined} className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element;
              if (index === 0) {
                if (typeof ref === "function") ref(element);
                else if (ref) ref.current = element;
              }
            }}
            aria-label={`${label}, digit ${index + 1} of ${length}`}
            aria-invalid={error ? true : undefined}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && index === 0}
            maxLength={index === 0 ? length : 1}
            value={digit}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const typed = event.target.value;
              if (!typed) {
                const next = digits.slice();
                next[index] = "";
                onChange(toValue(next));
                return;
              }
              // The box keeps its old digit selected, so the new one is the last character typed
              write(index, typed.length > 1 && index > 0 ? typed.slice(-1) : typed);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index]) {
                event.preventDefault();
                const next = digits.slice();
                next[Math.max(0, index - 1)] = "";
                onChange(toValue(next));
                focusBox(index - 1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusBox(index - 1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                focusBox(index + 1);
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              write(index, event.clipboardData.getData("text"));
            }}
            className={cx(
              "auth-field h-12 w-full min-w-0 rounded-field border bg-auth-field text-center text-title-3 font-semibold text-brand-on outline-hidden transition-colors duration-instant num",
              "focus:border-auth-focus focus:shadow-auth-focus",
              error ? "border-auth-error" : "border-auth-field-line",
            )}
          />
        ))}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
