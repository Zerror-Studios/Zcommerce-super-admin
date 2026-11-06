import { useState } from "react";
import { useQuery } from "@apollo/client";
import { PageHeader } from "../components/common/PageHeader";
import { CellText, DataTable, EmptyState, ErrorState, SegmentedSwitch, type DataTableColumn } from "../components/ui";
import { IconVideo } from "../components/ui/icons";
import { PLATFORM_SUPPORT_TOPIC_COUNTS } from "../graphql/support";

interface TopicCount {
  topic: string;
  label: string;
  count: number;
  open: number;
}

type Window = "30" | "90" | "365";

const COLUMNS: DataTableColumn<TopicCount>[] = [
  { key: "topic", label: "Topic", mobile: "primary" },
  { key: "count", label: "Tickets", width: 120, align: "end", mobile: "value" },
  { key: "open", label: "Still open", width: 120, align: "end", mobile: "meta" },
];

/**
 * Super Admin › Support › Guides & videos (round 2 §4). The stores' tutorial videos and guides are edited in the
 * store admin's help content (zcom-frontend `src/config/help-learn.data.ts`); this page shows what stores raise
 * tickets about, from the tickets themselves, so the next guide or video answers the most common question.
 */
export function SupportGuides() {
  const [days, setDays] = useState<Window>("30");
  const { data, loading, error, refetch } = useQuery(PLATFORM_SUPPORT_TOPIC_COUNTS, {
    variables: { days: Number(days) },
    fetchPolicy: "cache-and-network",
  });
  const rows: TopicCount[] = data?.platformSupportTopicCounts ?? [];

  return (
    <>
      <PageHeader
        title="Guides & videos"
        eyebrow="Support"
        description="What stores ask about most, so the next guide or video answers it. Guides are edited in the store admin's help content."
      />
      <div className="space-y-4">
        <SegmentedSwitch<Window>
          ariaLabel="Period"
          items={[
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
            { value: "365", label: "12 months" },
          ]}
          value={days}
          onChange={setDays}
        />
        {error && !rows.length ? (
          <ErrorState title="Couldn't load ticket topics." onRetry={() => void refetch()} />
        ) : (
          <DataTable<TopicCount>
            aria-label="Tickets per topic"
            columns={COLUMNS}
            rows={rows}
            getRowKey={(row) => row.topic}
            renderCell={(row, key) =>
              key === "topic" ? <CellText>{row.label}</CellText> : <CellText>{key === "count" ? row.count : row.open}</CellText>
            }
            isLoading={loading && !data}
            emptyContent={<EmptyState icon={IconVideo} title="No tickets in this period" description="Topics show here once stores raise tickets." />}
          />
        )}
      </div>
    </>
  );
}
