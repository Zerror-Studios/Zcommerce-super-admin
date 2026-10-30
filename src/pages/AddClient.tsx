import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateTenantInput, TenantRegion } from "../types/platform-api";
import {
  addStorePlans,
  DEFAULT_STORE_CURRENCY,
  DEFAULT_STORE_TIMEZONE,
  normaliseCurrency,
  planOptionLabel,
  planPriceHint,
} from "../lib/plan-identity.util";
import { errorCodeOf } from "../lib/apollo-client";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { PageHeader } from "../components/common/PageHeader";
import { OwnerCredentialsDialog } from "../components/clients/OwnerCredentialsDialog";
import { FormFooter } from "../components/clients/add-store/FormFooter";
import { useClients, type CreateStoreResult } from "../providers/ClientsProvider";
import { toasts } from "../copy";
import {
  Button,
  Card,
  FieldGrid,
  Input,
  Select,
  SelectItem,
  Switch,
  fieldSpanFull,
  formatMoney,
  toast,
  toastError,
} from "../components/ui";

// ─── Shared ───────────────────────────────────────────────────────────────

const REGIONS: { key: TenantRegion; label: string }[] = [
  { key: "ap_south_1", label: "India (Mumbai)" },
  { key: "us_east_1", label: "US East (Virginia)" },
  { key: "eu_west_1", label: "EU West (Ireland)" },
];

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
const DOMAIN_PATTERN = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;
const PHONE_PREFIX = "+91";

type Field =
  | "name"
  | "slug"
  | "domain"
  | "ownerName"
  | "ownerEmail"
  | "ownerPhone"
  | "planId"
  | "timezone"
  | "currency";

/** Form order, for focusing the first field with an error. */
const FIELD_ORDER: Field[] = ["name", "slug", "domain", "ownerName", "ownerEmail", "ownerPhone", "planId", "timezone", "currency"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** "98765 43210" → "+919876543210"; a number typed with its own country code is sent as typed. */
function phoneValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("+") ? trimmed.replace(/\s+/g, "") : `${PHONE_PREFIX}${trimmed.replace(/\s+/g, "")}`;
}

/**
 * Add store (04 S-09): a detail header ("Back to Stores"), a centred 720px form column with three cards on the
 * two-column field grid, and the sticky form footer (Cancel / Add store). The AI bar is hidden on this page.
 * Time zone and Currency stay free text (05 #26) and the slug's live helper stays (05 #6) until confirmed.
 */
export function AddClient() {
  const navigate = useNavigate();
  const { clients, plans: allPlans, createStore } = useClients();
  // PRD-024 FR-1.3 (D-03): global ACTIVE plans only, never another store's custom plan.
  const plans = useMemo(() => addStorePlans(allPlans), [allPlans]);
  const takenSlugs = useMemo(() => new Set(clients.map((client) => client.slug).filter(Boolean)), [clients]);
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
  // PRD-024 FR-1.4 (B-10): sent on create (the server's defaults shown).
  const [timezone, setTimezone] = useState(DEFAULT_STORE_TIMEZONE);
  const [currency, setCurrency] = useState(DEFAULT_STORE_CURRENCY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Set<Field>>(new Set());
  const [serverErrors, setServerErrors] = useState<Partial<Record<Field, string>>>({});
  const [created, setCreated] = useState<CreateStoreResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const effectiveSlug = slugTouched ? slug : slugify(storeName);
  const selectedPlanId = planId || plans[0]?.id || "";
  const formatPrice = (amount: number) => formatMoney(amount, { whole: true });

  // Checked on blur, then live once the field has been left (01 §7.4); all of them on submit.
  const errors = useMemo(() => {
    const next: Partial<Record<Field, string>> = {};
    if (!storeName.trim()) next.name = "Enter a store name.";
    if (!effectiveSlug) next.slug = "Enter a slug.";
    else if (!SLUG_PATTERN.test(effectiveSlug)) next.slug = "Use 3 to 40 lower-case letters, digits and hyphens.";
    else if (takenSlugs.has(effectiveSlug)) next.slug = "Another store already uses this slug.";
    if (domain.trim() && !DOMAIN_PATTERN.test(domain.trim())) next.domain = "Enter a domain like kesarandkin.in.";
    if (!ownerName.trim()) next.ownerName = "Enter the owner's name.";
    if (!ownerEmail.trim()) next.ownerEmail = "Enter the owner's email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) next.ownerEmail = "Enter a valid email.";
    if (!selectedPlanId) next.planId = "Choose a plan.";
    if (!timezone.trim()) next.timezone = "Enter a time zone, like Asia/Kolkata.";
    if (!normaliseCurrency(currency)) next.currency = "Use a three-letter code, like INR.";
    return next;
  }, [currency, domain, effectiveSlug, ownerEmail, ownerName, selectedPlanId, storeName, takenSlugs, timezone]);

  const errorFor = (field: Field): string | undefined =>
    serverErrors[field] ?? (submitted || touched.has(field) ? errors[field] : undefined);
  const touch = (field: Field) => setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  const edit = (field: Field) =>
    setServerErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  const fieldProps = (field: Field) => ({
    name: field,
    isInvalid: !!errorFor(field),
    errorMessage: errorFor(field),
    onBlur: () => touch(field),
    validationBehavior: "aria" as const,
  });

  const focusFirstError = (fields: Partial<Record<Field, string>>) => {
    const first = FIELD_ORDER.find((field) => fields[field]);
    if (!first) return;
    const node = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
    node?.focus({ preventScroll: true });
  };

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (submitting) return;
    setSubmitted(true);
    if (Object.keys(errors).length) {
      focusFirstError(errors);
      return;
    }
    setSubmitting(true);
    try {
      const result = await createStore({
        name: storeName.trim(),
        slug: effectiveSlug,
        domain: domain.trim().toLowerCase() || null,
        region,
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        ownerPhone: phoneValue(ownerPhone),
        planId: selectedPlanId,
        billingCycle,
        startActive,
        timezone: timezone.trim(),
        currency: normaliseCurrency(currency) ?? DEFAULT_STORE_CURRENCY,
      });
      const name = result.client.storeName;
      if (result.client.onboarding?.status !== "READY") {
        toastError(toasts.storeProvisioningFailed(name));
      } else if (result.ownerInviteSent) {
        toast.success(`${name} added. Owner invite sent.`);
      } else if (!result.ownerTemporaryPassword) {
        toast.success(`${name} added. No owner invite was sent; resend it from the store page.`);
      }
      // A one-time password from an older server is shown once before leaving.
      if (result.ownerTemporaryPassword) setCreated(result);
      else navigate(`/stores/${result.client.id}/overview`);
    } catch (error) {
      const code = errorCodeOf(error);
      const field = (error as { graphQLErrors?: Array<{ extensions?: { field?: string } }> })?.graphQLErrors?.[0]
        ?.extensions?.field;
      if ((code === "CONFLICT" || code === "BAD_USER_INPUT") && field) {
        const next = { [field as Field]: (error as Error).message };
        setServerErrors(next);
        focusFirstError(next);
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
      <PageHeader
        type="detail"
        back={{ href: "/stores", label: "Stores" }}
        title="Add store"
        description="Create the store, invite its owner and start its plan."
      />

      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
        className="mx-auto flex w-full max-w-[var(--zc-content-max-form)] flex-col gap-4"
      >
        <Card title="Store details" description="The slug names the database and the key prefix; it can't change later.">
          <FieldGrid>
            <Input
              label="Store name"
              isRequired
              placeholder="Kesar & Kin"
              value={storeName}
              onValueChange={(value) => {
                setStoreName(value);
                edit("name");
              }}
              {...fieldProps("name")}
            />
            <Input
              label="Slug"
              isRequired
              placeholder="kesar-kin"
              value={effectiveSlug}
              onValueChange={(value) => {
                setSlugTouched(true);
                setSlug(value.toLowerCase());
                edit("slug");
              }}
              description="Database: zcom_<slug>"
              autoComplete="off"
              {...fieldProps("slug")}
            />
            <Input
              label="Storefront domain (optional)"
              placeholder="kesarandkin.in"
              value={domain}
              onValueChange={(value) => {
                setDomain(value);
                edit("domain");
              }}
              {...fieldProps("domain")}
            />
            <Select
              label="Region"
              isRequired
              validationBehavior="aria"
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
          </FieldGrid>
        </Card>

        <Card title="Owner" description="Gets the owner login for the store dashboard.">
          <FieldGrid>
            <Input
              label="Owner name"
              isRequired
              placeholder="Aarav Mehta"
              value={ownerName}
              onValueChange={(value) => {
                setOwnerName(value);
                edit("ownerName");
              }}
              {...fieldProps("ownerName")}
            />
            <Input
              label="Owner email"
              isRequired
              type="email"
              placeholder="aarav@kesarandkin.in"
              value={ownerEmail}
              onValueChange={(value) => {
                setOwnerEmail(value);
                edit("ownerEmail");
              }}
              {...fieldProps("ownerEmail")}
            />
            <Input
              label="Owner phone (optional)"
              type="tel"
              inputMode="tel"
              placeholder="98765 43210"
              startContent={<span className="text-body text-fg-subtle">{PHONE_PREFIX}</span>}
              value={ownerPhone}
              onValueChange={(value) => {
                setOwnerPhone(value);
                edit("ownerPhone");
              }}
              {...fieldProps("ownerPhone")}
            />
          </FieldGrid>
        </Card>

        <Card title="Subscription">
          <FieldGrid>
            <Select
              label="Plan"
              isRequired
              selectedKeys={selectedPlanId ? new Set([selectedPlanId]) : new Set()}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                if (typeof value === "string") setPlanId(value);
                edit("planId");
              }}
              disallowEmptySelection
              {...fieldProps("planId")}
            >
              {plans.map((plan) => {
                const label = `${planOptionLabel(plan)} · ${planPriceHint(plan, billingCycle, formatPrice)}`;
                return (
                  <SelectItem key={plan.id} textValue={label}>
                    {label}
                  </SelectItem>
                );
              })}
            </Select>
            <Select
              label="Billing cycle"
              isRequired
              validationBehavior="aria"
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
            <Input
              label="Time zone"
              isRequired
              placeholder={DEFAULT_STORE_TIMEZONE}
              value={timezone}
              onValueChange={(value) => {
                setTimezone(value);
                edit("timezone");
              }}
              {...fieldProps("timezone")}
            />
            <Input
              label="Currency"
              isRequired
              placeholder={DEFAULT_STORE_CURRENCY}
              value={currency}
              maxLength={3}
              onValueChange={(value) => {
                setCurrency(value.toUpperCase());
                edit("currency");
              }}
              {...fieldProps("currency")}
            />
            <div className={fieldSpanFull}>
              <Switch isSelected={startActive} onValueChange={setStartActive}>
                Start live (skip the 14-day trial)
              </Switch>
            </div>
          </FieldGrid>
        </Card>

        {/* Enter in any field submits. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>

      <FormFooter>
        <Button variant="secondary" onPress={() => navigate("/stores")} isDisabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" isLoading={submitting} onPress={() => void handleSubmit()}>
          Add store
        </Button>
      </FormFooter>

      {created ? (
        <OwnerCredentialsDialog
          isOpen
          storeName={created.client.storeName}
          ownerEmail={created.client.ownerEmail}
          ownerInviteSent={created.ownerInviteSent}
          temporaryPassword={created.ownerTemporaryPassword}
          onClose={() => navigate(`/stores/${created.client.id}/overview`)}
        />
      ) : null}
    </div>
  );
}
