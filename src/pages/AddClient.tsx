import { addToast } from "@heroui/react";
import { toastError } from "../components/ui";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateTenantInput, TenantRegion } from "../types/platform-api";
import { PLAN_LABELS } from "../lib/display-labels.util";
import { errorCodeOf } from "../lib/apollo-client";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { PageHeader } from "../components/common/PageHeader";
import { OwnerCredentialsDialog } from "../components/clients/OwnerCredentialsDialog";
import { useClients, type CreateStoreResult } from "../providers/ClientsProvider";
import { toasts } from "../copy";
import { Button as UiButton, Card, Input, Select, SelectItem, Switch, formatMoney } from "../components/ui";

// ─── Shared ───────────────────────────────────────────────────────────────

const REGIONS: { key: TenantRegion; label: string }[] = [
  { key: "ap_south_1", label: "India (Mumbai)" },
  { key: "us_east_1", label: "US East (Virginia)" },
  { key: "eu_west_1", label: "EU West (Ireland)" },
];

/** Every card's fields: one column on phones, two from 768px, 16px apart, tops aligned. */
const FIELD_GRID = "grid grid-cols-1 items-start gap-4 md:grid-cols-2";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Add store (docs/design/04-super-admin.md §3.3, PRD-005 FR-3.3): full width (owner, 2026-10-26; was a 720px
 * column), every card on the same two-column field grid, ghost Cancel + primary "Add store".
 */
export function AddClient() {
  const navigate = useNavigate();
  const { plans, createStore } = useClients();
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [domain, setDomain] = useState("");
  const [region, setRegion] = useState<TenantRegion>("ap_south_1");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [planId, setPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState<CreateTenantInput["billingCycle"]>("MONTHLY");
  const [startActive, setStartActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CreateStoreResult | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(storeName);
  const selectedPlanId = planId || plans[0]?.id || "";
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId), [plans, selectedPlanId]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!storeName.trim()) next.name = "Enter a store name.";
    if (!SLUG_PATTERN.test(effectiveSlug)) next.slug = "3–40 lower-case letters, digits and hyphens.";
    if (domain.trim() && !/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain.trim())) next.domain = "Enter a valid domain.";
    if (!ownerName.trim()) next.ownerName = "Enter the owner's name.";
    if (!ownerEmail.trim().includes("@")) next.ownerEmail = "Enter a valid owner email.";
    if (!selectedPlanId) next.planId = "Choose a plan.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await createStore({
        name: storeName.trim(),
        slug: effectiveSlug,
        domain: domain.trim().toLowerCase() || null,
        region,
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        ownerPhone: ownerPhone.trim() || null,
        planId: selectedPlanId,
        billingCycle,
        startActive,
      });
      if (result.client.onboarding?.status === "READY") {
        addToast({ title: toasts.storeAdded(result.client.storeName) });
      } else {
        toastError(toasts.storeProvisioningFailed(result.client.storeName));
      }
      setCreated(result);
    } catch (error) {
      const code = errorCodeOf(error);
      const field = (error as { graphQLErrors?: Array<{ extensions?: { field?: string } }> })?.graphQLErrors?.[0]
        ?.extensions?.field;
      if ((code === "CONFLICT" || code === "BAD_USER_INPUT") && field) {
        setErrors({ [field]: (error as Error).message });
      } else {
        // FORBIDDEN and MFA_REQUIRED are reported once by the Apollo link (review C-M5).
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader type="detail" back={{ href: "/stores", label: "Stores" }} title="Add store" />

      <div className="flex flex-col gap-4">
        <Card title="Store details" description="The slug names the database and the key prefix; it can't change later.">
          <div className={FIELD_GRID}>
            <Input
              label="Store name"
              placeholder="Drift Skate Co."
              value={storeName}
              onValueChange={setStoreName}
              isInvalid={!!errors.name}
              errorMessage={errors.name}
            />
            <Input
              label="Slug"
              placeholder="drift-skate"
              value={effectiveSlug}
              onValueChange={(value) => {
                setSlugTouched(true);
                setSlug(value.toLowerCase());
              }}
              isInvalid={!!errors.slug}
              errorMessage={errors.slug}
              description="Database: zcom_<slug>"
            />
            <Input
              label="Storefront domain (optional)"
              placeholder="driftskate.in"
              value={domain}
              onValueChange={setDomain}
              isInvalid={!!errors.domain}
              errorMessage={errors.domain}
            />
            <Select
              label="Region"
              selectedKeys={new Set([region])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                const match = REGIONS.find((item) => item.key === value);
                if (match) setRegion(match.key);
              }}
              disallowEmptySelection
            >
              {REGIONS.map((item) => (
                <SelectItem key={item.key}>{item.label}</SelectItem>
              ))}
            </Select>
          </div>
        </Card>

        <Card title="Owner" description="Gets the owner login for the store dashboard.">
          <div className={FIELD_GRID}>
            <Input
              label="Owner name"
              placeholder="Leo Martinez"
              value={ownerName}
              onValueChange={setOwnerName}
              isInvalid={!!errors.ownerName}
              errorMessage={errors.ownerName}
            />
            <Input
              label="Owner email"
              type="email"
              placeholder="leo@store.com"
              value={ownerEmail}
              onValueChange={setOwnerEmail}
              isInvalid={!!errors.ownerEmail}
              errorMessage={errors.ownerEmail}
            />
            <Input label="Owner phone (optional)" type="tel" placeholder="+91" value={ownerPhone} onValueChange={setOwnerPhone} />
          </div>
        </Card>

        <Card title="Subscription">
          <div className="flex flex-col gap-4">
            <div className={FIELD_GRID}>
              {/* The price is a line under the select, not its description: HeroUI draws an outside label over
                  the trigger when a select has a description. */}
              <div className="flex flex-col gap-1.5">
                <Select
                  label="Plan"
                  selectedKeys={selectedPlanId ? new Set([selectedPlanId]) : new Set()}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];
                    if (typeof value === "string") setPlanId(value);
                  }}
                  disallowEmptySelection
                  isInvalid={!!errors.planId}
                  errorMessage={errors.planId}
                >
                  {plans.map((plan) => (
                    <SelectItem key={plan.id}>{PLAN_LABELS[plan.name]}</SelectItem>
                  ))}
                </Select>
                {selectedPlan ? (
                  <p className="px-1 text-caption text-fg-muted num">
                    {formatMoney(selectedPlan.priceMonthly, { whole: true })} / month
                  </p>
                ) : null}
              </div>
              <Select
                label="Billing cycle"
                selectedKeys={new Set([billingCycle])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (value === "MONTHLY" || value === "YEARLY") setBillingCycle(value);
                }}
                disallowEmptySelection
              >
                <SelectItem key="MONTHLY">Monthly</SelectItem>
                <SelectItem key="YEARLY">Yearly</SelectItem>
              </Select>
            </div>
            <Switch isSelected={startActive} onValueChange={setStartActive}>
              Start live (skip the 14-day trial)
            </Switch>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <UiButton variant="ghost" onPress={() => navigate("/stores")}>
            Cancel
          </UiButton>
          <UiButton variant="primary" isLoading={submitting} onPress={() => void handleCreate()}>
            Add store
          </UiButton>
        </div>
      </div>

      {created ? (
        <OwnerCredentialsDialog
          isOpen
          storeName={created.client.storeName}
          ownerEmail={created.client.ownerEmail}
          temporaryPassword={created.ownerTemporaryPassword}
          onClose={() => navigate(`/stores/${created.client.id}`)}
        />
      ) : null}
    </div>
  );
}

