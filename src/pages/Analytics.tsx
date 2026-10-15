import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { RevenueReportsTab } from "../components/billing/RevenueReportsTab";

const sections = ["revenue"] as const;

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

  // Revenue renders its own header: the date control and export share state with the report.
  return <RevenueReportsTab />;
}
