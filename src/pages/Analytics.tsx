import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { StoreSalesTab } from "../components/analytics/StoreSalesTab";
import { RevenueReportsTab } from "../components/billing/RevenueReportsTab";

/** Analytics › Platform revenue (route "revenue", unchanged) and Analytics › Store sales. */
const sections = ["revenue", "store-sales"] as const;

type AnalyticsSection = (typeof sections)[number];

export function Analytics() {
  const { section } = useParams<{ section: string }>();

  const active = useMemo(() => {
    if (!section || !(sections as readonly string[]).includes(section)) return null;
    return section as AnalyticsSection;
  }, [section]);

  if (!active) {
    return <Navigate to="/analytics/revenue" replace />;
  }

  if (active === "store-sales") return <StoreSalesTab />;

  // Platform revenue renders its own header: the date control and export share state with the report.
  return <RevenueReportsTab />;
}
