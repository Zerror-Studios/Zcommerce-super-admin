/**
 * Loading pass (owner, 2026-11-10: "the loading must look like what comes in that place"): a Settings section's
 * real cards while its first answer loads. Titles and descriptions are the real text; switch rows, fields and
 * list rows are placeholders at the controls' heights. Built on the kit's `.zc-skel`, so nothing shows for the
 * first 200 ms and reduced motion is respected. Keep each section's card list next to its loaded markup.
 */
import { Card, FieldGrid } from "../ui";
import { SkelChip, SkelLine } from "../common/SkeletonBits";

export interface SettingsCardSkeletonSpec {
  title: string;
  description?: string;
  /** Switch rows (label + one caption line, the switch on the right). */
  switches?: number;
  /** Fields in the section's FieldGrid (label above a control). */
  fields?: number;
  /** List rows (two lines and a chip), as in the reminder schedule or a job list. */
  rows?: number;
}

function SwitchRow() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <SkelLine className="w-48" />
        <SkelLine text="mt-0.5 text-label" className="w-2/3" />
      </div>
      <span aria-hidden className="zc-skel mt-0.5 h-6 w-10 shrink-0 rounded-full" />
    </div>
  );
}

function FieldPlaceholder() {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <SkelLine text="text-label" className="w-28" />
      <span aria-hidden className="zc-skel block h-[var(--zc-control-h)] rounded-field" />
    </div>
  );
}

function ListRow() {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <SkelLine className="w-1/2" />
        <SkelLine text="text-label" className="w-1/3" />
      </div>
      <SkelChip />
    </div>
  );
}

export function SettingsCardSkeleton({ title, description, switches = 0, fields = 0, rows = 0 }: SettingsCardSkeletonSpec) {
  return (
    <Card title={title} description={description} aria-busy>
      <div className="flex flex-col gap-5">
        {Array.from({ length: switches }, (_, index) => (
          <SwitchRow key={`s${index}`} />
        ))}
        {fields ? (
          <FieldGrid>
            {Array.from({ length: fields }, (_, index) => (
              <FieldPlaceholder key={index} />
            ))}
          </FieldGrid>
        ) : null}
        {rows ? (
          <div className="flex flex-col divide-y divide-line-subtle border-t border-line-subtle">
            {Array.from({ length: rows }, (_, index) => (
              <ListRow key={index} />
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function SettingsCardsSkeleton({ cards, label }: { cards: SettingsCardSkeletonSpec[]; label: string }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label={label}>
      {cards.map((card) => (
        <SettingsCardSkeleton key={card.title} {...card} />
      ))}
    </div>
  );
}
