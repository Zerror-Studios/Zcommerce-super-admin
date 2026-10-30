/**
 * Settings › Discounts (04 S-07e, PRD-005 FR-7.2): the platform discount codes. Search (code or plan) and status
 * live in the URL and filter on the server (PRD-024 FR-3.5); "+ Create discount" at the section's top right.
 */
import { useMutation } from "@apollo/client";
import { useMemo, useState } from "react";
import { toasts } from "../../copy";
import { CREATE_PLATFORM_COUPON, DEACTIVATE_PLATFORM_COUPON, UPDATE_PLATFORM_COUPON } from "../../graphql/billing";
import { useCoupons } from "../../hooks/use-platform-reports";
import { toCouponInput, toCouponUpdateInput } from "../../lib/api-report-adapters";
import type { CouponWrite } from "../../lib/coupon-form.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { splitParam } from "../../lib/store-table.util";
import { useAuth } from "../../providers/AuthProvider";
import type { Coupon } from "../../types";
import { CouponsTab } from "../billing/CouponsTab";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import { Button, ErrorState, TableSkeletonRows, useTableUrlState } from "../ui";
import { IconAdd } from "../ui/icons";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

export function DiscountsSettings() {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.COUPONS_MANAGE);
  const [createOpen, setCreateOpen] = useState(false);
  const table = useTableUrlState();
  const statuses = useMemo(() => splitParam(table.filters.status), [table.filters.status]);
  const coupons = useCoupons({ search: table.search, statuses });
  const [createCoupon] = useMutation(CREATE_PLATFORM_COUPON);
  const [updateCoupon] = useMutation(UPDATE_PLATFORM_COUPON);
  const [deactivateCoupon] = useMutation(DEACTIVATE_PLATFORM_COUPON);

  // PRD-014 UX-24: resolve only after the server answers, so the form can stay open with the error.
  const onCreate = async (coupon: CouponWrite) => {
    await createCoupon({ variables: { input: toCouponInput({ ...coupon, id: "", redemptions: 0 }) } });
    // The code exists now; a failed list refresh must not look like a failed create.
    await coupons.refetch().catch(() => undefined);
  };
  // Update and deactivate return the coupon, which Apollo normalises by id.
  const onUpdate = async (id: string, patch: Partial<Coupon>) => {
    await updateCoupon({ variables: { id, input: toCouponUpdateInput(patch) } });
  };
  const onDeactivate = async (id: string) => {
    await deactivateCoupon({ variables: { id } });
  };

  return (
    <div>
      <SettingsSectionHeader
        section="discounts"
        actions={
          canManage ? (
            <Button variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => setCreateOpen(true)}>
              Create discount
            </Button>
          ) : undefined
        }
      />
      {coupons.error ? (
        <ErrorState title="Couldn't load the discounts." description={toasts.genericError} onRetry={() => void coupons.refetch()} />
      ) : coupons.loading ? (
        <div className="overflow-clip rounded-2xl border border-line" role="status" aria-label="Loading discounts">
          <TableSkeletonRows rows={5} />
        </div>
      ) : (
        <CouponsTab
          coupons={coupons.data}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDeactivate={onDeactivate}
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
          canCreate={canManage}
          footer={
            <LoadMoreFooter
              shown={coupons.data.length}
              total={coupons.totalCount}
              hasMore={coupons.hasMore}
              loading={coupons.loadingMore}
              onLoadMore={coupons.loadMore}
              noun="discounts"
            />
          }
        />
      )}
    </div>
  );
}
