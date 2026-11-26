/**
 * Store detail › Overview › Store details › Edit (owner, 2026-11-26): one pop-up for everything the card shows,
 * instead of sending the operator to Settings. Two groups: Store (name, owner contact, billing contact, GSTIN, time
 * zone, currency: `updateTenant`) and Profile (category, source, location, account manager, planned go-live, tags:
 * `updateTenant.profile`). Save checks both, then sends only the group(s) that changed; a group's field errors stay
 * on its fields and the pop-up stays open. The domain changes only through domain verification, in Go live.
 */
import { addToast } from "@heroui/react";
import { useState } from "react";
import { useStoreDetailsForm, useStoreProfileForm } from "../../hooks/use-store-edit-forms";
import { useTenantProfile } from "../../hooks/use-tenant-profile";
import { storeProfileDraftOf, type StoreProfileDraft } from "../../lib/store-profile.util";
import type { Client } from "../../types";
import {
  Button as UiButton,
  ErrorState,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  PopupTitle,
} from "../ui";
import { IconEdit } from "../ui/icons";
import { SkelLine } from "../common/SkeletonBits";
import { StoreDetailsFields } from "./StoreDetailsCard";
import { StoreProfileFields } from "./StoreProfileCard";

export function StoreEditDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const read = useTenantProfile(client.id);
  // The profile form starts from the saved profile, so it mounts once the profile has loaded.
  const ready = !read.loading && !!read.tenant;

  return (
    <Modal isOpen onClose={onClose} size="lg" scrollBehavior="inside">
      {ready ? (
        <StoreEditForm client={client} profile={storeProfileDraftOf(read.tenant?.profile ?? null)} onClose={onClose} />
      ) : (
        <ModalContent>
          <ModalHeader>
            <PopupTitle icon={<IconEdit aria-hidden />}>Edit {client.storeName}</PopupTitle>
          </ModalHeader>
          <ModalBody>
            {read.error ? (
              <ErrorState inline title="Couldn't load the store's profile." onRetry={() => void read.refetch()} />
            ) : (
              <div className="flex flex-col gap-3" aria-busy>
                <SkelLine className="w-1/2" />
                <SkelLine className="w-2/3" />
                <SkelLine className="w-1/3" />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={onClose}>
              Cancel
            </UiButton>
          </ModalFooter>
        </ModalContent>
      )}
    </Modal>
  );
}

function StoreEditForm({ client, profile, onClose }: { client: Client; profile: StoreProfileDraft; onClose: () => void }) {
  const details = useStoreDetailsForm(client);
  const profileForm = useStoreProfileForm(client, profile);
  const [saving, setSaving] = useState(false);
  const changed = details.changed || profileForm.changed;

  const save = async () => {
    // Show every local error at once before sending anything.
    const detailsOk = !details.changed || details.validate();
    const profileOk = !profileForm.changed || profileForm.validate();
    if (!detailsOk || !profileOk) return;
    setSaving(true);
    const savedDetails = await details.save();
    const savedProfile = savedDetails ? await profileForm.save() : false;
    setSaving(false);
    if (!savedDetails || !savedProfile) return;
    addToast({ title: `${details.draft.name.trim() || client.storeName} saved.` });
    onClose();
  };

  return (
    <ModalContent>
      <ModalHeader>
        <PopupTitle icon={<IconEdit aria-hidden />}>Edit {client.storeName}</PopupTitle>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-6">
          <section aria-labelledby="store-edit-store" className="flex flex-col gap-3">
            <h3 id="store-edit-store" className="text-title-3 text-fg">
              Store
            </h3>
            <StoreDetailsFields form={details} />
            <p className="text-caption text-fg-muted">The domain changes only through domain verification, in Go live.</p>
          </section>
          <section aria-labelledby="store-edit-profile" className="flex flex-col gap-3 border-t border-line-subtle pt-5">
            <h3 id="store-edit-profile" className="text-title-3 text-fg">
              Profile
            </h3>
            <StoreProfileFields form={profileForm} />
          </section>
        </div>
      </ModalBody>
      <ModalFooter>
        <UiButton variant="secondary" onPress={onClose} isDisabled={saving}>
          Cancel
        </UiButton>
        <UiButton variant="primary" isLoading={saving} isDisabled={!changed || saving} onPress={() => void save()}>
          Save changes
        </UiButton>
      </ModalFooter>
    </ModalContent>
  );
}
