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
import { Link } from "react-router-dom";
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
  Card,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  toastError,
} from "../ui";

export interface StoreDetailsCardProps {
  client: Client;
  /** The Go live section's URL, for the domain link. */
  goLiveHref: string;
}

export function StoreDetailsCard({ client, goLiveHref }: StoreDetailsCardProps) {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const [open, setOpen] = useState(false);
  const draft = storeDetailsDraftOf(client);
  const show = (value: string) => value || <span className="text-fg-subtle">—</span>;

  return (
    <>
      <Card
        title="Store details"
        actions={
          canManage ? (
            <UiButton variant="ghost" size="sm" onPress={() => setOpen(true)}>
              Edit
            </UiButton>
          ) : null
        }
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label="Store name">{show(draft.name)}</Row>
          <Row label="Slug">{show(client.slug ?? "")}</Row>
          <Row label="Domain">
            <span className="flex flex-wrap items-center gap-2">
              {client.domain ? <span className="font-mono">{client.domain}</span> : show("")}
              <Link to={goLiveHref} className="text-label text-brand hover:underline">
                Change in Go live
              </Link>
            </span>
          </Row>
          <Row label="Owner">{show(draft.ownerName)}</Row>
          <Row label="Owner email">{show(draft.ownerEmail)}</Row>
          <Row label="Owner phone">{show(draft.ownerPhone)}</Row>
          <Row label="Billing email">{show(draft.billingContactEmail)}</Row>
          <Row label="GSTIN">{show(draft.gstin)}</Row>
          <Row label="Timezone">{show(draft.timezone)}</Row>
          <Row label="Currency">{show(draft.currency)}</Row>
        </dl>
      </Card>

      {open ? <StoreDetailsDialog client={client} initial={draft} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-fg-muted">{label}</dt>
      <dd className="break-words text-body text-fg">{children}</dd>
    </div>
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
  { key: "timezone", label: "Timezone", placeholder: "Asia/Kolkata" },
  { key: "currency", label: "Currency", placeholder: "INR" },
];

function StoreDetailsDialog({
  client,
  initial,
  onClose,
}: {
  client: Client;
  initial: StoreDetailsDraft;
  onClose: () => void;
}) {
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
        <ModalHeader>Edit {client.storeName}</ModalHeader>
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
          <UiButton variant="ghost" onPress={onClose} isDisabled={saving}>
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
