/**
 * Zcom AI suggestions per page (docs/design-v2/README.md §3.3, §9: "the suggestions per page can start as a static
 * list"): the bar shows the first as its chip; the half sheet shows three. The longest matching path prefix wins.
 */
const BY_PATH: { prefix: string; suggestions: [string, string, string] }[] = [
  { prefix: "/", suggestions: ["Which stores need me today?", "How did GMV move this week?", "Which subscriptions are past due?"] },
  { prefix: "/stores", suggestions: ["Which stores are at risk?", "Which stores are stuck in setup?", "Which stores grew fastest this month?"] },
  { prefix: "/subscriptions", suggestions: ["Who is past due right now?", "What renews in the next 7 days?", "How much did we collect this month?"] },
  { prefix: "/analytics", suggestions: ["Explain this month's platform revenue", "Which stores drive the most GMV?", "Which stores need a look?"] },
  // Analytics Level 1 §3.7: Stores (store performance) has its own questions; system ones live on System health.
  { prefix: "/analytics/store-sales", suggestions: ["Which stores drive the most GMV?", "Which stores grew fastest this month?", "Which stores need a look?"] },
  { prefix: "/system-health", suggestions: ["Is anything slow or failing?", "Which stores' Google Analytics sync is failing?", "Are payment providers healthy?"] },
  { prefix: "/ai", suggestions: ["Which stores use AI the most?", "Are any stores close to their AI limit?", "What do merchants ask most?"] },
  { prefix: "/settings", suggestions: ["Who on the team can manage billing?", "What changed in settings this week?", "How are plans priced today?"] },
];

export function askSuggestionsFor(pathname: string): [string, string, string] {
  const match = BY_PATH.filter(({ prefix }) =>
    prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.suggestions ?? BY_PATH[0].suggestions;
}
