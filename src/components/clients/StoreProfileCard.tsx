/**
 * Store detail › Profile (PRD-025 FR-2, FR-6.1)
 *
 * Who the store is for Zerror's own records: category and source (the
 * lists come from `platformStoreProfileOptions`), city and state, the
 * account manager (an ACTIVE platform user), free tags and the planned
 * go-live date. Edited in place: Edit turns the rows into fields, Save
 * sends `updateTenant.profile` with only the changed fields (`null`
 * clears one) and a server `INVALID_*` answer lands on its field.
 * `platform:tenants:manage` edits; every other role reads.
 */

import { addToast } from "@heroui/react";
import { useState, type ReactNode } from "react";

import { PROFILE_NONE_KEY, useStoreProfileForm, type StoreProfileForm as StoreProfileFormState } from "../../hooks/use-store-edit-forms";
import { useTenantProfile } from "../../hooks/use-tenant-profile";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  MAX_STORE_TAGS,
  removeStoreTag,
  storeProfileDraftOf,
  storeProfileOptionLabel,
  type StoreProfileDraft,
} from "../../lib/store-profile.util";
import { useAuth } from "../../providers/AuthProvider";
import type { Client } from "../../types";
import type { StoreProfile } from "../../types/platform-api";
import {
  Button as UiButton,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SelectItem,
  formatDate,
} from "../ui";
import { IconClose, IconStore } from "../ui/icons";
import { SkelButton, SkelChip, SkelLine } from "../common/SkeletonBits";
import { useUnsavedChangesGuard } from "../settings/SettingsSaveBar";

// ─── Constants ────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────

export interface StoreProfileCardProps {
  client: Client;
}

export function StoreProfileCard({ client }: StoreProfileCardProps) {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const read = useTenantProfile(client.id);
  const [editing, setEditing] = useState(false);
  const profile = read.tenant?.profile ?? null;

  if (read.error && !read.tenant) {
    return (
      <Card title="Profile">
        <ErrorState inline title="Couldn't load the profile." onRetry={() => void read.refetch()} />
      </Card>
    );
  }

  if (read.loading) {
    return (
      // Loading pass: the loaded card's description and field labels, the values as placeholders.
      <Card
        title="Profile"
        description="Who this store is, for Zerror's records."
        actions={canManage ? <SkelButton size="sm" className="w-12" /> : null}
        aria-busy
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {["Category", "Source", "City", "State", "Account manager", "Planned go-live"].map((label) => (
            <Row key={label} label={label}>
              <SkelLine className="w-1/2" />
            </Row>
          ))}
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-label text-fg-muted">Tags</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              <SkelChip className="w-14" />
              <SkelChip className="w-20" />
            </dd>
          </div>
        </dl>
      </Card>
    );
  }

  if (editing) {
    return (
      <StoreProfileForm
        client={client}
        initial={storeProfileDraftOf(profile)}
        onDone={() => setEditing(false)}
      />
    );
  }

  const isEmpty = !hasAnyProfileValue(profile);

  return (
    <Card
      title="Profile"
      description="Who this store is, for Zerror's records."
      actions={
        canManage ? (
          <UiButton variant="ghost" size="sm" onPress={() => setEditing(true)}>
            Edit
          </UiButton>
        ) : null
      }
    >
      {isEmpty ? (
        <EmptyState
          compact
          icon={IconStore}
          title="No profile yet"
          description={
            canManage
              ? "Add the category, source, location, account manager and tags."
              : "Nothing recorded for this store yet."
          }
        />
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label="Category">{show(profile?.category ? storeProfileOptionLabel(profile.category) : "")}</Row>
          <Row label="Source">{show(profile?.source ? storeProfileOptionLabel(profile.source) : "")}</Row>
          <Row label="City">{show(profile?.city ?? "")}</Row>
          <Row label="State">{show(profile?.state ?? "")}</Row>
          <Row label="Account manager">
            {profile?.accountManager ? (
              <span className="flex flex-col">
                <span>{profile.accountManager.name}</span>
                <span className="text-caption text-fg-muted">{profile.accountManager.email}</span>
              </span>
            ) : (
              show("")
            )}
          </Row>
          <Row label="Planned go-live">
            {profile?.plannedLiveAt ? formatDate(profile.plannedLiveAt) : show("")}
          </Row>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-label text-fg-muted">Tags</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {profile && profile.tags.length > 0 ? (
                profile.tags.map((tag) => (
                  <Chip key={tag} dot={false}>
                    {tag}
                  </Chip>
                ))
              ) : (
                show("")
              )}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────

interface StoreProfileFormProps {
  client: Client;
  initial: StoreProfileDraft;
  onDone: () => void;
}

function StoreProfileForm({ client, initial, onDone }: StoreProfileFormProps) {
  const form = useStoreProfileForm(client, initial);
  const [saving, setSaving] = useState(false);
  // Leaving the page (or closing the tab) with unsaved profile edits asks first.
  const { dialog: discardDialog } = useUnsavedChangesGuard(form.changed);

  const save = async () => {
    setSaving(true);
    const saved = await form.save();
    setSaving(false);
    if (!saved) return;
    addToast({ title: `${client.storeName} profile saved.` });
    onDone();
  };

  return (
    <>
      {discardDialog}
      <Card
        title="Profile"
        description="Who this store is, for Zerror's records."
        actions={
          <>
            <UiButton variant="ghost" size="sm" onPress={onDone} isDisabled={saving}>
              Cancel
            </UiButton>
            <UiButton variant="primary" size="sm" isLoading={saving} isDisabled={!form.changed} onPress={() => void save()}>
              Save
            </UiButton>
          </>
        }
      >
        <StoreProfileFields form={form} />
      </Card>
    </>
  );
}

/** The profile fields (category, source, city, state, account manager, planned go-live, tags); also in the
 * Overview's Edit pop-up. */
export function StoreProfileFields({ form }: { form: StoreProfileFormState }) {
  const { draft, errors } = form;
  const selected = (value: string) => new Set([value || PROFILE_NONE_KEY]);
  return (
    <div className="flex flex-col gap-4">
      {errors.form ? (
        <p role="alert" className="text-label text-tone-danger-text">
          {errors.form}
        </p>
      ) : null}
      {form.optionsError ? (
        <ErrorState inline title="Couldn't load the category and source lists." onRetry={form.retryOptions} />
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Category"
          selectedKeys={selected(draft.category)}
          onSelectionChange={form.pick("category")}
          isLoading={form.optionsLoading}
          isInvalid={!!errors.category}
          errorMessage={errors.category}
        >
          {[
            <SelectItem key={PROFILE_NONE_KEY}>Not set</SelectItem>,
            ...form.categories.map((value) => <SelectItem key={value}>{storeProfileOptionLabel(value)}</SelectItem>),
          ]}
        </Select>
        <Select
          label="Source"
          description="How the store came to the platform."
          selectedKeys={selected(draft.source)}
          onSelectionChange={form.pick("source")}
          isLoading={form.optionsLoading}
          isInvalid={!!errors.source}
          errorMessage={errors.source}
        >
          {[
            <SelectItem key={PROFILE_NONE_KEY}>Not set</SelectItem>,
            ...form.sources.map((value) => <SelectItem key={value}>{storeProfileOptionLabel(value)}</SelectItem>),
          ]}
        </Select>
        <Input
          label="City"
          value={draft.city}
          onValueChange={(value) => form.set("city", value)}
          isInvalid={!!errors.city}
          errorMessage={errors.city}
        />
        <Input
          label="State"
          value={draft.state}
          onValueChange={(value) => form.set("state", value)}
          isInvalid={!!errors.state}
          errorMessage={errors.state}
        />
        <Select
          label="Account manager"
          description={form.usersError ? "Couldn't load the team; try again." : "An active member of the Zerror team."}
          selectedKeys={selected(draft.accountManagerId)}
          onSelectionChange={form.pick("accountManagerId")}
          isLoading={form.usersLoading}
          isInvalid={!!errors.accountManagerId}
          errorMessage={errors.accountManagerId}
        >
          {[
            <SelectItem key={PROFILE_NONE_KEY}>Not set</SelectItem>,
            ...form.managers.map((user) => (
              <SelectItem key={user.id} textValue={user.name}>
                {user.name} <span className="text-fg-muted">· {user.email}</span>
              </SelectItem>
            )),
          ]}
        </Select>
        <Input
          label="Planned go-live"
          type="date"
          value={draft.plannedLiveAt}
          onValueChange={(value) => form.set("plannedLiveAt", value)}
          isInvalid={!!errors.plannedLiveAt}
          errorMessage={errors.plannedLiveAt}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Input
          label="Tags"
          placeholder="vip, launch-2026…"
          description={`Up to ${MAX_STORE_TAGS}; letters, digits, spaces and hyphens. Enter adds one.`}
          value={form.tagInput}
          onValueChange={(value) => {
            form.setTagInput(value);
            form.clearTagError();
          }}
          onKeyDown={form.onTagKeyDown}
          isInvalid={!!errors.tags}
          errorMessage={errors.tags}
          endContent={
            <UiButton variant="ghost" size="sm" onPress={form.addTag} isDisabled={!form.tagInput.trim()}>
              Add
            </UiButton>
          }
        />
        {draft.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {draft.tags.map((tag) => (
              <li key={tag}>
                <Chip dot={false} className="pr-1">
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    className="ml-0.5 inline-flex rounded-sm text-fg-muted hover:text-fg"
                    onClick={() => form.removeTag(removeStoreTag(draft.tags, tag))}
                  >
                    <IconClose aria-hidden className="size-3" />
                  </button>
                </Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-fg-subtle">No tags yet.</p>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function hasAnyProfileValue(profile: StoreProfile | null): boolean {
  if (!profile) return false;
  return !!(
    profile.category ||
    profile.source ||
    profile.city ||
    profile.state ||
    profile.accountManager ||
    profile.plannedLiveAt ||
    profile.tags.length > 0
  );
}

function show(value: string): ReactNode {
  return value || <span className="text-fg-subtle">—</span>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-fg-muted">{label}</dt>
      <dd className="break-words text-body text-fg">{children}</dd>
    </div>
  );
}

export default StoreProfileCard;
