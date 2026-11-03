/**
 * Settings › Billing rules › Invoice issuer (backend PRD-030 FR-8): the
 * legal name and address printed as "From" on every interim invoice PDF.
 * Until it is saved, PDF downloads are refused in the console and the
 * store dashboard. Saving needs `settings:manage` and `billing:manage`
 * (the server checks both and audits `settings.invoice_issuer_updated`);
 * it has its own Save so it never rides along with the billing rules.
 */

import { addToast } from "@heroui/react";
import { useMemo, useState } from "react";
import { toasts } from "../../copy";
import { errorReasonOf } from "../../lib/apollo-client";
import { issuerDraftOf, issuerInputOf, type IssuerDraft } from "../../lib/invoice-pdf.util";
import { isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { Button, Card, FieldGrid, Input, Textarea, fieldSpanFull, toastError } from "../ui";

// ─── Helpers ──────────────────────────────────────────────────────────────

const MAX_ADDRESS_LINES = 4;

/** The `extensions.field` of an `INVALID_ISSUER` refusal, without the prefix. */
function issuerFieldOf(error: unknown): string | null {
  const graphQLErrors = (error as { graphQLErrors?: Array<{ extensions?: Record<string, unknown> }> })?.graphQLErrors;
  const field = graphQLErrors?.[0]?.extensions?.field;
  return typeof field === "string" ? field.replace(/^billing\.issuer\./, "") : null;
}

// ─── Component ────────────────────────────────────────────────────────────

export function InvoiceIssuerCard() {
  const { settings, loading, updateSettingsPatch } = usePlatformSettings();
  const { can } = useAuth();
  const canEdit = can(PLATFORM_PERMISSIONS.SETTINGS_MANAGE) && can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const saved = useMemo(() => issuerDraftOf(settings.billing?.issuer), [settings.billing?.issuer]);
  const [draft, setDraft] = useState<IssuerDraft>(saved);
  // A new server copy (after a save or a refetch) resets the form
  const [base, setBase] = useState(saved);
  if (base !== saved) {
    setBase(saved);
    setDraft(saved);
  }
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const changed = (Object.keys(draft) as (keyof IssuerDraft)[]).some((key) => draft[key] !== saved[key]);
  const addressLines = issuerInputOf(draft).addressLines.length;
  const localError =
    !draft.legalName.trim()
      ? { field: "legalName", message: "Enter the legal name" }
      : addressLines === 0
        ? { field: "addressLines", message: "Enter the address" }
        : addressLines > MAX_ADDRESS_LINES
          ? { field: "addressLines", message: `Use ${MAX_ADDRESS_LINES} address lines at most` }
          : null;
  const errorFor = (field: string) => (fieldError?.field === field ? fieldError.message : undefined);

  const set = (key: keyof IssuerDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldError(null);
  };

  const save = async () => {
    if (localError) {
      setFieldError(localError);
      return;
    }
    setBusy(true);
    try {
      await updateSettingsPatch({ billing: { issuer: issuerInputOf(draft) } });
      addToast({ title: toasts.changesSaved });
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message && isUserInputError(error) && errorReasonOf(error) === "INVALID_ISSUER") {
        setFieldError({ field: issuerFieldOf(error) ?? "legalName", message });
      } else if (message) {
        toastError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const disabled = !canEdit || loading;
  return (
    <Card
      id="invoice-issuer"
      data-settings-field
      title="Invoice issuer"
      description="Shown as “From” on every invoice PDF. Invoice PDFs can't be downloaded until this is saved. They are marked “not a tax invoice” until GST invoicing ships."
    >
      <FieldGrid>
        <Input
          id="issuer-legal-name"
          label="Legal name"
          isRequired
          value={draft.legalName}
          onValueChange={(value) => set("legalName", value)}
          maxLength={120}
          isDisabled={disabled}
          isInvalid={!!errorFor("legalName")}
          errorMessage={errorFor("legalName")}
        />
        <Input
          id="issuer-email"
          label="Billing email"
          type="email"
          value={draft.email}
          onValueChange={(value) => set("email", value)}
          maxLength={80}
          isDisabled={disabled}
          isInvalid={!!errorFor("email")}
          errorMessage={errorFor("email")}
        />
        <Textarea
          id="issuer-address"
          className={fieldSpanFull}
          label="Address"
          isRequired
          description="One to four lines, as printed."
          value={draft.address}
          onValueChange={(value) => set("address", value)}
          isDisabled={disabled}
          isInvalid={!!errorFor("addressLines")}
          errorMessage={errorFor("addressLines")}
        />
        <Input
          id="issuer-phone"
          label="Phone"
          value={draft.phone}
          onValueChange={(value) => set("phone", value)}
          maxLength={40}
          isDisabled={disabled}
          isInvalid={!!errorFor("phone")}
          errorMessage={errorFor("phone")}
        />
        <Input
          id="issuer-website"
          label="Website"
          value={draft.website}
          onValueChange={(value) => set("website", value)}
          maxLength={80}
          isDisabled={disabled}
          isInvalid={!!errorFor("website")}
          errorMessage={errorFor("website")}
        />
      </FieldGrid>
      {canEdit ? (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" isDisabled={!changed || busy} onPress={() => setDraft(saved)}>
            Discard
          </Button>
          <Button variant="primary" isLoading={busy} isDisabled={!changed || busy} onPress={() => void save()}>
            Save issuer
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
