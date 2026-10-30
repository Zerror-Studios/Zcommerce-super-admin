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

import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useState, type KeyboardEvent, type ReactNode } from "react";

import { PLATFORM_STORE_PROFILE_OPTIONS, UPDATE_TENANT_PROFILE } from "../../graphql/store-profile";
import { PLATFORM_USERS } from "../../graphql/team";
import { useTenantProfile } from "../../hooks/use-tenant-profile";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  addStoreTag,
  MAX_STORE_TAGS,
  removeStoreTag,
  storeProfileDraftOf,
  storeProfileErrorsFromServer,
  storeProfileOptionLabel,
  storeProfilePatch,
  validateStoreProfile,
  type StoreProfileDraft,
  type StoreProfileErrors,
  type StoreProfileField,
} from "../../lib/store-profile.util";
import { useAuth } from "../../providers/AuthProvider";
import type { Client } from "../../types";
import type {
  PlatformList,
  PlatformUser,
  StoreProfile,
  StoreProfileOptions,
} from "../../types/platform-api";
import {
  Button as UiButton,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SelectItem,
  Skeleton,
  formatDate,
  toastError,
} from "../ui";
import { IconClose, IconStore } from "../ui/icons";

// ─── Constants ────────────────────────────────────────────────────────────

/** HeroUI keys can't be ""; this key means "not set" in the selects. */
const NONE_KEY = "__none";

/** The users list is capped at 100 by the backend (PRD-014 FE-09). */
const USERS_PAGE = 100;

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
      <Card title="Profile">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-full rounded-lg" />
          ))}
        </div>
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
  const [draft, setDraft] = useState<StoreProfileDraft>(initial);
  const [errors, setErrors] = useState<StoreProfileErrors>({});
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const options = useQuery<{ platformStoreProfileOptions: StoreProfileOptions }>(
    PLATFORM_STORE_PROFILE_OPTIONS,
  );
  const users = useQuery<{ platformUsers: PlatformList<PlatformUser> }>(PLATFORM_USERS, {
    variables: { limit: USERS_PAGE, offset: 0 },
  });
  const [updateProfile] = useMutation(UPDATE_TENANT_PROFILE);

  const categories = options.data?.platformStoreProfileOptions.categories ?? [];
  const sources = options.data?.platformStoreProfileOptions.sources ?? [];
  // FR-2.4: only an ACTIVE platform user can look after a store; the
  // current manager stays listed even if since disabled, so the row reads.
  const managers = (users.data?.platformUsers.items ?? []).filter(
    (user) => user.status === "ACTIVE" || user.id === initial.accountManagerId,
  );
  const patch = storeProfilePatch(initial, draft);
  const changed = Object.keys(patch).length > 0;

  const set = (key: StoreProfileField, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const pick = (key: "category" | "source" | "accountManagerId") => (keys: Iterable<unknown>) => {
    const value = Array.from(keys)[0];
    set(key, typeof value === "string" && value !== NONE_KEY ? value : "");
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    const result = addStoreTag(draft.tags, tagInput);
    setDraft((current) => ({ ...current, tags: result.tags }));
    setErrors((current) => ({ ...current, tags: result.error, form: undefined }));
    if (!result.error) setTagInput("");
  };

  const onTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
  };

  const save = async () => {
    const local = validateStoreProfile(draft);
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ variables: { id: client.id, input: { profile: patch } } });
      addToast({ title: `${client.storeName} profile saved.` });
      onDone();
    } catch (error) {
      const fieldErrors = storeProfileErrorsFromServer(error);
      if (fieldErrors) setErrors(fieldErrors);
      else {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const selected = (value: string) => new Set([value || NONE_KEY]);

  return (
    <Card
      title="Profile"
      description="Who this store is, for Zerror's records."
      actions={
        <>
          <UiButton variant="ghost" size="sm" onPress={onDone} isDisabled={saving}>
            Cancel
          </UiButton>
          <UiButton variant="primary" size="sm" isLoading={saving} isDisabled={!changed} onPress={() => void save()}>
            Save
          </UiButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {errors.form ? (
          <p role="alert" className="text-label text-tone-danger-text">
            {errors.form}
          </p>
        ) : null}
        {options.error ? (
          <ErrorState
            inline
            title="Couldn't load the category and source lists."
            onRetry={() => void options.refetch()}
          />
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            selectedKeys={selected(draft.category)}
            onSelectionChange={pick("category")}
            isLoading={options.loading}
            isInvalid={!!errors.category}
            errorMessage={errors.category}
          >
            {[
              <SelectItem key={NONE_KEY}>Not set</SelectItem>,
              ...categories.map((value) => <SelectItem key={value}>{storeProfileOptionLabel(value)}</SelectItem>),
            ]}
          </Select>
          <Select
            label="Source"
            description="How the store came to the platform."
            selectedKeys={selected(draft.source)}
            onSelectionChange={pick("source")}
            isLoading={options.loading}
            isInvalid={!!errors.source}
            errorMessage={errors.source}
          >
            {[
              <SelectItem key={NONE_KEY}>Not set</SelectItem>,
              ...sources.map((value) => <SelectItem key={value}>{storeProfileOptionLabel(value)}</SelectItem>),
            ]}
          </Select>
          <Input
            label="City"
            value={draft.city}
            onValueChange={(value) => set("city", value)}
            isInvalid={!!errors.city}
            errorMessage={errors.city}
          />
          <Input
            label="State"
            value={draft.state}
            onValueChange={(value) => set("state", value)}
            isInvalid={!!errors.state}
            errorMessage={errors.state}
          />
          <Select
            label="Account manager"
            description={users.error ? "Couldn't load the team; try again." : "An active member of the Zerror team."}
            selectedKeys={selected(draft.accountManagerId)}
            onSelectionChange={pick("accountManagerId")}
            isLoading={users.loading}
            isInvalid={!!errors.accountManagerId}
            errorMessage={errors.accountManagerId}
          >
            {[
              <SelectItem key={NONE_KEY}>Not set</SelectItem>,
              ...managers.map((user) => (
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
            onValueChange={(value) => set("plannedLiveAt", value)}
            isInvalid={!!errors.plannedLiveAt}
            errorMessage={errors.plannedLiveAt}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Input
            label="Tags"
            placeholder="vip, launch-2026…"
            description={`Up to ${MAX_STORE_TAGS}; letters, digits, spaces and hyphens. Enter adds one.`}
            value={tagInput}
            onValueChange={(value) => {
              setTagInput(value);
              setErrors((current) => ({ ...current, tags: undefined }));
            }}
            onKeyDown={onTagKeyDown}
            isInvalid={!!errors.tags}
            errorMessage={errors.tags}
            endContent={
              <UiButton variant="ghost" size="sm" onPress={addTag} isDisabled={!tagInput.trim()}>
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
                      onClick={() => setDraft((current) => ({ ...current, tags: removeStoreTag(current.tags, tag) }))}
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
    </Card>
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
