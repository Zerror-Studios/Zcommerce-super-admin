/**
 * Store detail › Store details (PRD-017 FR-4.5)
 *
 * The store's name, owner contact, billing contact, GSTIN, timezone and
 * currency, edited through `updateTenant` with only the changed fields;
 * server field errors land on their field (`extensions.field`). The domain
 * is read-only here: since PRD-018 FR-4.4 it changes only through domain
 * verification, in the Go live section. The grace override and notes keep
 * their own controls.
 */

import { addToast } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  lifecycleFailureCopy,
  storeDetailsDraftOf,
  storeDetailsErrorsFromServer,
  storeDetailsPatch,
  validateStoreDetails,
  type StoreDetailsDraft,
  type StoreDetailsErrors,
} from "../../lib/tenant-lifecycle.util";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import type { Client } from "../../types";
import {
  Button as UiButton,
  ButtonLink,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  PopupTitle,
  toastError,
} from "../ui";
import { IconEdit } from "../ui/icons";

export interface StoreDetailsCardProps {
  client: Client;
  /** The Go live section's URL, for the domain link. */
  goLiveHref: string;
}

/** One setting row (board 66): what it is, its value under it, and an action on the right. */
function SettingRow({ label, value, mono = false, action }: { label: string; value: ReactNode; mono?: boolean; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line-subtle px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-body font-medium text-fg">{label}</p>
        <p className={mono ? "mt-0.5 font-mono text-label text-fg-muted wrap-anywhere" : "mt-0.5 text-label text-fg-muted wrap-anywhere"}>
          {value}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Joins the parts that are set ("Aarav Mehta · aarav@…"), or "Not set". */
const joined = (...parts: (string | null | undefined)[]) => parts.filter((part) => part && part.trim()).join(" · ") || "Not set";

/**
 * Store detail › Settings › Store (board 66; 04 S-03b): one row each for the web address (changed in Go live),
 * the name, the owner, the billing contact and the region; "Edit" opens the md pop-up.
 */
export function StoreDetailsCard({ client, goLiveHref }: StoreDetailsCardProps) {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const [open, setOpen] = useState(false);
  const draft = storeDetailsDraftOf(client);

  return (
    <>
      <Card
        title="Store"
        padding="none"
        actions={
          canManage ? (
            <UiButton variant="secondary" size="sm" startIcon={<IconEdit aria-hidden />} onPress={() => setOpen(true)}>
              Edit
            </UiButton>
          ) : null
        }
      >
        <SettingRow
          label="Web address"
          mono
          value={joined(client.slug, client.domain)}
          action={
            <ButtonLink to={goLiveHref} variant="secondary" size="sm">
              Change in Go live
            </ButtonLink>
          }
        />
        <SettingRow label="Store name" value={joined(draft.name)} />
        <SettingRow label="Store owner" value={joined(draft.ownerName, draft.ownerEmail, draft.ownerPhone)} />
        <SettingRow label="Billing contact" value={joined(draft.billingContactEmail, draft.gstin ? `GSTIN ${draft.gstin}` : null)} />
        <SettingRow label="Region and currency" value={joined(draft.timezone, draft.currency)} />
      </Card>

      {open ? <StoreDetailsDialog client={client} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const FIELDS: ReadonlyArray<{
  key: keyof StoreDetailsDraft;
  label: string;
  type?: string;
  placeholder?: string;
  description?: string;
}> = [
  { key: "name", label: "Store name" },
  { key: "ownerName", label: "Owner name" },
  { key: "ownerEmail", label: "Owner email", type: "email" },
  { key: "ownerPhone", label: "Owner phone", type: "tel" },
  { key: "billingContactEmail", label: "Billing email", type: "email", description: "Invoices go here when set." },
  { key: "gstin", label: "GSTIN", placeholder: "29ABCDE1234F1Z5" },
  // Check first 05 #26: a searchable IANA select and required marks wait for Rohit; free text as live.
  { key: "timezone", label: "Time zone", placeholder: "Asia/Kolkata" },
  { key: "currency", label: "Currency", placeholder: "INR" },
];

/** The live Edit pop-up (md 640); also opened from the store header's "Edit store details". */
export function StoreDetailsDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const [initial] = useState<StoreDetailsDraft>(() => storeDetailsDraftOf(client));
  const { updateStoreDetails } = useClients();
  const [draft, setDraft] = useState<StoreDetailsDraft>(initial);
  const [errors, setErrors] = useState<StoreDetailsErrors>({});
  const [saving, setSaving] = useState(false);
  const patch = storeDetailsPatch(initial, draft);
  const changed = Object.keys(patch).length > 0;

  const set = (key: keyof StoreDetailsDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const save = async () => {
    const local = validateStoreDetails(draft);
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }
    setSaving(true);
    try {
      await updateStoreDetails(client.id, patch);
      addToast({ title: `${draft.name.trim() || client.storeName} saved.` });
      onClose();
    } catch (error) {
      const fieldErrors = storeDetailsErrorsFromServer(error);
      if (fieldErrors) setErrors(fieldErrors);
      else {
        const message = lifecycleFailureCopy(error);
        if (message) toastError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !saving && onClose()} width="md">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconEdit aria-hidden />}>Edit {client.storeName}</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {errors.form ? (
              <p role="alert" className="text-label text-tone-danger-text">
                {errors.form}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  type={field.type}
                  placeholder={field.placeholder}
                  description={field.description}
                  value={draft[field.key]}
                  onValueChange={(value) => set(field.key, value)}
                  isInvalid={!!errors[field.key]}
                  errorMessage={errors[field.key]}
                />
              ))}
            </div>
            <p className="text-caption text-fg-muted">
              The domain changes only through domain verification, in Go live.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={onClose} isDisabled={saving}>
            Cancel
          </UiButton>
          <UiButton variant="primary" isLoading={saving} isDisabled={!changed} onPress={() => void save()}>
            Save changes
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
