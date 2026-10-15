/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Anything HeroUI accepts in a classNames slot (strings, falsy values, nested arrays). */
export type ClassValue = string | number | bigint | boolean | null | undefined | readonly ClassValue[];

/** Joins class names, skipping falsy values. HeroUI runs tailwind-merge on classNames slots itself. */
export function cx(...classes: ClassValue[]): string {
  const out: string[] = [];
  for (const c of classes) {
    if (!c || c === true) continue;
    if (Array.isArray(c)) {
      const nested = cx(...c);
      if (nested) out.push(nested);
    } else {
      out.push(String(c));
    }
  }
  return out.join(" ");
}
