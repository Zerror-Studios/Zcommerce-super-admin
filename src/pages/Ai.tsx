import { useMemo } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { AiBenchmarksTab } from "../components/ai/AiBenchmarksTab";
import { AiConfigTab } from "../components/ai/AiConfigTab";
import { AiDataHealthTab } from "../components/ai/AiDataHealthTab";
import { AiOverviewTab } from "../components/ai/AiOverviewTab";
import { AiTopUpsTab } from "../components/ai/AiTopUpsTab";
import { AiUsageTab } from "../components/ai/AiUsageTab";
import { PageHeader } from "../components/common/PageHeader";
import { Card, EmptyState, Tab, Tabs } from "../components/ui";
import { IconAi, IconLock } from "../components/ui/icons";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";

/**
 * ZCOM AI for Zerror staff (PRD-021 FR-6): Overview (spend and quality), Usage & data and Settings
 * (`ai_config`). Usage & data (/ai/usage) holds four tables as tabs in the toolbar row (owner 2026-10-29: three
 * sidebar entries, not six): Usage by store, Top-up requests, Data health and Benchmarks, as ?view=…; the old
 * /ai/top-ups, /ai/data-health and /ai/benchmarks URLs open those tabs. Everything needs `platform:ai:read`; changes also
 * need `platform:ai:manage`. Keep this list and `config/navigation.ts` in step.
 */
const sections = ["overview", "usage", "settings"] as const;

type UsageView = "stores" | "top-ups" | "data-health" | "benchmarks";

const USAGE_VIEWS: Record<UsageView, string> = {
  stores: "Usage by store",
  "top-ups": "Top-up requests",
  "data-health": "Data health",
  benchmarks: "Benchmarks",
};

/** Old sidebar pages, now tabs of Usage & data. */
const OLD_SECTIONS = new Set(["top-ups", "data-health", "benchmarks"]);

const isUsageView = (value: string | null | undefined): value is UsageView => !!value && value in USAGE_VIEWS;

type AiSection = (typeof sections)[number];

export function Ai() {
  const { section } = useParams<{ section: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: UsageView = isUsageView(viewParam) ? viewParam : "stores";
  const { can } = useAuth();

  const active = useMemo(() => {
    if (!section || !(sections as readonly string[]).includes(section)) return null;
    return section as AiSection;
  }, [section]);

  if (section && OLD_SECTIONS.has(section)) return <Navigate to={`/ai/usage?view=${section}`} replace />;
  if (section === "stores") return <Navigate to="/ai/usage" replace />;
  if (!active) {
    return <Navigate to="/ai/overview" replace />;
  }

  // Client-side mirror of the backend guard (`platform:ai:read`); the server still decides.
  if (!can(PLATFORM_PERMISSIONS.AI_READ)) {
    return (
      <div>
        <PageHeader type="page" icon={<IconAi aria-hidden />} section="pink" title="ZCOM AI" />
        <Card>
          <EmptyState
            icon={IconLock}
            title="AI usage isn't available to your role"
            description="Ask a platform owner for AI access."
          />
        </Card>
      </div>
    );
  }

  if (active === "settings") return <AiConfigTab />;
  if (active === "usage") {
    const tabs = (
      <Tabs
        aria-label="ZCOM AI usage and data"
        selectedKey={view}
        // A new tab starts clean: its own search and page.
        onSelectionChange={(key) => setSearchParams(key === "stores" ? {} : { view: String(key) })}
        classNames={{ base: "h-full min-w-0 max-w-full", tabList: "h-full border-b-0", tab: "h-full" }}
      >
        {(Object.keys(USAGE_VIEWS) as UsageView[]).map((key) => (
          <Tab key={key} title={USAGE_VIEWS[key]} />
        ))}
      </Tabs>
    );
    if (view === "top-ups") return <AiTopUpsTab tabs={tabs} />;
    if (view === "data-health") return <AiDataHealthTab tabs={tabs} />;
    if (view === "benchmarks") return <AiBenchmarksTab tabs={tabs} />;
    return <AiUsageTab tabs={tabs} />;
  }
  return <AiOverviewTab />;
}
