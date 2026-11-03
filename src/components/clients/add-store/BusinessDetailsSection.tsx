/**
 * Add store › Business details (optional) (backend PRD-031 FR-B1, FR-B2):
 * collapsed by default. Billing contact email, GSTIN, the business name
 * printed on invoices, and the PRD-025 profile (category, source, city,
 * state, account manager, tags, planned go-live) with the same controls
 * as the store page's Profile card. The store is created without them
 * when the section is left empty; the server validates every field.
 */

import { useQuery } from "@apollo/client";
import { useState, type KeyboardEvent } from "react";
import { PLATFORM_STORE_PROFILE_OPTIONS } from "../../../graphql/store-profile";
import { PLATFORM_USERS } from "../../../graphql/team";
import {
  MAX_STORE_TAGS,
  addStoreTag,
  removeStoreTag,
  storeProfileOptionLabel,
  type StoreProfileField,
} from "../../../lib/store-profile.util";
import {
  BUSINESS_NAME_MAX_LENGTH,
  hasBusinessDetailsErrors,
  type BusinessDetailsDraft,
  type BusinessDetailsErrors,
  type BusinessDetailsField,
} from "../../../lib/store-setup.util";
import type { PlatformList, PlatformUser, StoreProfileOptions } from "../../../types/platform-api";
import { Button as UiButton, Card, Chip, FieldGrid, Input, Select, SelectItem } from "../../ui";
import { IconClose } from "../../ui/icons";

/** HeroUI keys can't be ""; this key means "not set" in the selects. */
const NONE_KEY = "__none";

/** The users list is capped at 100 by the backend (PRD-014 FE-09). */
const USERS_PAGE = 100;

export interface BusinessDetailsSectionProps {
  value: BusinessDetailsDraft;
  onChange: (next: BusinessDetailsDraft) => void;
  errors: BusinessDetailsErrors;
  onClearError: (field: BusinessDetailsField | StoreProfileField) => void;
}

export function BusinessDetailsSection({ value, onChange, errors, onClearError }: BusinessDetailsSectionProps) {
  const hasError = hasBusinessDetailsErrors(errors);
  const [open, setOpen] = useState(false);
  const expanded = open || hasError;
  const [tagInput, setTagInput] = useState("");
  const [tagError, setTagError] = useState<string | undefined>();
  const options = useQuery<{ platformStoreProfileOptions: StoreProfileOptions }>(PLATFORM_STORE_PROFILE_OPTIONS, {
    skip: !expanded,
  });
  const users = useQuery<{ platformUsers: PlatformList<PlatformUser> }>(PLATFORM_USERS, {
    variables: { limit: USERS_PAGE, offset: 0 },
    skip: !expanded,
  });
  const categories = options.data?.platformStoreProfileOptions.categories ?? [];
  const sources = options.data?.platformStoreProfileOptions.sources ?? [];
  const managers = (users.data?.platformUsers.items ?? []).filter((user) => user.status === "ACTIVE");
  const profile = value.profile;

  const setField = (field: BusinessDetailsField, next: string) => {
    onChange({ ...value, [field]: next });
    onClearError(field);
  };
  const setProfile = (field: StoreProfileField, next: string) => {
    onChange({ ...value, profile: { ...profile, [field]: next } });
    onClearError(field);
  };
  const pick = (field: "category" | "source" | "accountManagerId") => (keys: Iterable<unknown>) => {
    const key = Array.from(keys)[0];
    setProfile(field, typeof key === "string" && key !== NONE_KEY ? key : "");
  };
  const selected = (current: string) => new Set([current || NONE_KEY]);

  const addTag = () => {
    if (!tagInput.trim()) return;
    const result = addStoreTag(profile.tags, tagInput);
    onChange({ ...value, profile: { ...profile, tags: result.tags } });
    setTagError(result.error);
    onClearError("tags");
    if (!result.error) setTagInput("");
  };
  const onTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
  };

  return (
    <Card
      title="Business details (optional)"
      description="Billing contact, GSTIN, the name printed on invoices and Zerror's store profile. You can add them later on the store page."
      actions={
        hasError ? null : (
          <UiButton variant="ghost" size="sm" aria-expanded={expanded} onPress={() => setOpen((current) => !current)}>
            {expanded ? "Hide" : "Add details"}
          </UiButton>
        )
      }
    >
      {expanded ? (
        <div className="flex flex-col gap-4">
          <FieldGrid>
            <Input
              name="billingContactEmail"
              label="Billing contact email"
              type="email"
              description="Invoices and billing emails go here; else the owner's email."
              value={value.billingContactEmail}
              onValueChange={(next) => setField("billingContactEmail", next)}
              isInvalid={!!errors.billingContactEmail}
              errorMessage={errors.billingContactEmail}
            />
            <Input
              name="gstin"
              label="GSTIN"
              placeholder="27ABCDE1234F1Z5"
              value={value.gstin}
              maxLength={15}
              onValueChange={(next) => setField("gstin", next.toUpperCase())}
              isInvalid={!!errors.gstin}
              errorMessage={errors.gstin}
            />
            <Input
              name="businessName"
              label="Business name on invoices"
              description="The store's own invoices and receipts; else the store name."
              value={value.businessName}
              maxLength={BUSINESS_NAME_MAX_LENGTH}
              onValueChange={(next) => setField("businessName", next)}
              isInvalid={!!errors.businessName}
              errorMessage={errors.businessName}
            />
            <Select
              name="category"
              label="Category"
              selectedKeys={selected(profile.category)}
              onSelectionChange={pick("category")}
              isLoading={options.loading}
              isInvalid={!!errors.profile.category}
              errorMessage={errors.profile.category}
            >
              {[
                <SelectItem key={NONE_KEY}>Not set</SelectItem>,
                ...categories.map((option) => <SelectItem key={option}>{storeProfileOptionLabel(option)}</SelectItem>),
              ]}
            </Select>
            <Select
              name="source"
              label="Source"
              description="How the store came to the platform."
              selectedKeys={selected(profile.source)}
              onSelectionChange={pick("source")}
              isLoading={options.loading}
              isInvalid={!!errors.profile.source}
              errorMessage={errors.profile.source}
            >
              {[
                <SelectItem key={NONE_KEY}>Not set</SelectItem>,
                ...sources.map((option) => <SelectItem key={option}>{storeProfileOptionLabel(option)}</SelectItem>),
              ]}
            </Select>
            <Select
              name="accountManagerId"
              label="Account manager"
              description={users.error ? "Couldn't load the team; try again." : "An active member of the Zerror team."}
              selectedKeys={selected(profile.accountManagerId)}
              onSelectionChange={pick("accountManagerId")}
              isLoading={users.loading}
              isInvalid={!!errors.profile.accountManagerId}
              errorMessage={errors.profile.accountManagerId}
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
              name="city"
              label="City"
              value={profile.city}
              onValueChange={(next) => setProfile("city", next)}
              isInvalid={!!errors.profile.city}
              errorMessage={errors.profile.city}
            />
            <Input
              name="state"
              label="State"
              value={profile.state}
              onValueChange={(next) => setProfile("state", next)}
              isInvalid={!!errors.profile.state}
              errorMessage={errors.profile.state}
            />
            <Input
              name="plannedLiveAt"
              label="Planned go-live"
              type="date"
              value={profile.plannedLiveAt}
              onValueChange={(next) => setProfile("plannedLiveAt", next)}
              isInvalid={!!errors.profile.plannedLiveAt}
              errorMessage={errors.profile.plannedLiveAt}
            />
          </FieldGrid>
          <div className="flex flex-col gap-2">
            <Input
              name="tags"
              label="Tags"
              placeholder="vip, launch-2026…"
              description={`Up to ${MAX_STORE_TAGS}; letters, digits, spaces and hyphens. Enter adds one.`}
              value={tagInput}
              onValueChange={(next) => {
                setTagInput(next);
                setTagError(undefined);
              }}
              onKeyDown={onTagKeyDown}
              isInvalid={!!(tagError ?? errors.profile.tags)}
              errorMessage={tagError ?? errors.profile.tags}
              endContent={
                <UiButton variant="ghost" size="sm" onPress={addTag} isDisabled={!tagInput.trim()}>
                  Add
                </UiButton>
              }
            />
            {profile.tags.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                {profile.tags.map((tag) => (
                  <li key={tag}>
                    <Chip dot={false} className="pr-1">
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove tag ${tag}`}
                        className="ml-0.5 inline-flex rounded-sm text-fg-muted hover:text-fg"
                        onClick={() =>
                          onChange({ ...value, profile: { ...profile, tags: removeStoreTag(profile.tags, tag) } })
                        }
                      >
                        <IconClose aria-hidden className="size-3" />
                      </button>
                    </Chip>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
