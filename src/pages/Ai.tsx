import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AiBenchmarksTab } from "../components/ai/AiBenchmarksTab";
import { AiConfigTab } from "../components/ai/AiConfigTab";
import { AiDataHealthTab } from "../components/ai/AiDataHealthTab";
import { AiOverviewTab } from "../components/ai/AiOverviewTab";
import { AiTopUpsTab } from "../components/ai/AiTopUpsTab";
import { AiUsageTab } from "../components/ai/AiUsageTab";
import { PageHeader } from "../components/common/PageHeader";
import { Card, EmptyState } from "../components/ui";
import { IconChat, IconLock } from "../components/ui/icons";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";

/**
 * ZCOM AI for Zerror staff (PRD-021 FR-6): Overview (spend and quality),
 * Usage by store, Top-up requests, Data health, Benchmarks and Settings
 * (`ai_config`). Everything needs `platform:ai:read`; changes also need
 * `platform:ai:manage`. Keep this list and `config/navigation.ts` in step.
 */
const sections = ["overview", "usage", "top-ups", "data-health", "benchmarks", "settings"] as const;

type AiSection = (typeof sections)[number];

export function Ai() {
  const { section } = useParams<{ section: string }>();
  const { can } = useAuth();

  const active = useMemo(() => {
    if (!section || !(sections as readonly string[]).includes(section)) return null;
    return section as AiSection;
  }, [section]);

  if (!active) {
    return <Navigate to="/ai/overview" replace />;
  }

  // Client-side mirror of the backend guard (`platform:ai:read`); the server still decides.
  if (!can(PLATFORM_PERMISSIONS.AI_READ)) {
    return (
      <div>
        <PageHeader type="page" icon={<IconChat aria-hidden />} section="pink" title="ZCOM AI" />
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

  if (active === "usage") return <AiUsageTab />;
  if (active === "top-ups") return <AiTopUpsTab />;
  if (active === "data-health") return <AiDataHealthTab />;
  if (active === "benchmarks") return <AiBenchmarksTab />;
  if (active === "settings") return <AiConfigTab />;
  return <AiOverviewTab />;
}
