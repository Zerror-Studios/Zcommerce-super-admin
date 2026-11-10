/**
 * Small skeleton pieces for page skeletons that copy the real content (owner, 2026-11-10: "the loading must look like
 * what comes in that place"). Spans only, so they are valid inside headings and paragraphs (PageHeader subtitle, chips).
 * They use the kit's `.zc-skel`, so they stay invisible for `--zc-skeleton-delay` and respect reduced motion.
 */
import { cx } from "../ui";

/**
 * One line of text: the wrapper takes the real text style's line height (`h-lh`), the bar sits in the middle,
 * so the skeleton is exactly as tall as the line it stands for. `text` is the real line's type class.
 */
export function SkelLine({ text = "text-body", className }: { text?: string; className?: string }) {
  return (
    <span aria-hidden className={cx("flex h-lh min-w-0 items-center", text)}>
      <span className={cx("zc-skel h-3 rounded-md", className ?? "w-1/2")} />
    </span>
  );
}

/** A status chip's place (22px high, pill). */
export function SkelChip({ className }: { className?: string }) {
  return <span aria-hidden className={cx("zc-skel inline-block h-5.5 rounded-full align-middle", className ?? "w-16")} />;
}

/** A button's place at the kit control height (`sm` or the default `md`). */
export function SkelButton({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "zc-skel inline-block shrink-0 rounded-field",
        size === "sm" ? "h-[var(--zc-control-h-sm)]" : "h-[var(--zc-control-h)]",
        className ?? "w-24",
      )}
    />
  );
}

/** The kit's RankedBars rows (label and value on one body line, then the 4px track), for a list still loading. */
export function SkelBars({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index}>
          <div className="flex items-center justify-between gap-3">
            <SkelLine className={index % 2 ? "w-1/3" : "w-2/5"} />
            <SkelLine text="shrink-0 text-body" className="w-10" />
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
            <div className="zc-skel h-1 rounded-full" style={{ width: `${80 - index * 12}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
