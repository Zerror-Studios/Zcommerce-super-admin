/**
 * Store detail › the two store edit forms, as hooks (owner, 2026-11-26: the Overview's Store details card edits both
 * in one pop-up, so the logic lives here and each form only draws fields).
 *
 * - `useStoreDetailsForm`: name, owner contact, billing contact, GSTIN, time zone and currency (PRD-017 FR-4.5),
 *   saved through `updateTenant` with only the changed fields; server field errors land on their field.
 * - `useStoreProfileForm`: category, source, city, state, account manager, planned go-live and tags (PRD-025
 *   FR-2, FR-6.1), saved through `updateTenant.profile` with only the changed fields.
 *
 * `save()` resolves true once the server has the change (or there was nothing to save); errors stay on the form
 * (field errors) or go to a toast (anything else). The caller shows the "saved" toast.
 */
import { useMutation, useQuery } from "@apollo/client";
import { useState, type KeyboardEvent } from "react";
import { PLATFORM_STORE_PROFILE_OPTIONS, UPDATE_TENANT_PROFILE } from "../graphql/store-profile";
import { PLATFORM_USERS } from "../graphql/team";
import { mutationFailureCopy } from "../lib/mutation-errors";
import {
  addStoreTag,
  storeProfileErrorsFromServer,
  storeProfilePatch,
  validateStoreProfile,
  type StoreProfileDraft,
  type StoreProfileErrors,
  type StoreProfileField,
} from "../lib/store-profile.util";
import {
  lifecycleFailureCopy,
  storeDetailsDraftOf,
  storeDetailsErrorsFromServer,
  storeDetailsPatch,
  validateStoreDetails,
  type StoreDetailsDraft,
  type StoreDetailsErrors,
} from "../lib/tenant-lifecycle.util";
import { useClients } from "../providers/ClientsProvider";
import type { Client } from "../types";
import type { PlatformList, PlatformUser, StoreProfileOptions } from "../types/platform-api";
import { toastError } from "../components/ui";

/** HeroUI keys can't be ""; this key means "not set" in the profile selects. */
export const PROFILE_NONE_KEY = "__none";

/** The users list is capped at 100 by the backend (PRD-014 FE-09). */
const USERS_PAGE = 100;

// ─── Store details ─────────────────────────────────────────────────────────

export interface StoreDetailsForm {
  draft: StoreDetailsDraft;
  set: (key: keyof StoreDetailsDraft, value: string) => void;
  errors: StoreDetailsErrors;
  changed: boolean;
  /** Checks the fields locally and shows the errors; true when they pass. */
  validate: () => boolean;
  save: () => Promise<boolean>;
}

export function useStoreDetailsForm(client: Client): StoreDetailsForm {
  const [initial] = useState<StoreDetailsDraft>(() => storeDetailsDraftOf(client));
  const { updateStoreDetails } = useClients();
  const [draft, setDraft] = useState<StoreDetailsDraft>(initial);
  const [errors, setErrors] = useState<StoreDetailsErrors>({});
  const patch = storeDetailsPatch(initial, draft);
  const changed = Object.keys(patch).length > 0;

  const set = (key: keyof StoreDetailsDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const validate = () => {
    const local = validateStoreDetails(draft, initial);
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!changed) return true;
    if (!validate()) return false;
    try {
      await updateStoreDetails(client.id, patch);
      return true;
    } catch (error) {
      const fieldErrors = storeDetailsErrorsFromServer(error);
      if (fieldErrors) setErrors(fieldErrors);
      else {
        const message = lifecycleFailureCopy(error);
        if (message) toastError(message);
      }
      return false;
    }
  };

  return { draft, set, errors, changed, validate, save };
}

// ─── Store profile ─────────────────────────────────────────────────────────

export interface StoreProfileForm {
  initial: StoreProfileDraft;
  draft: StoreProfileDraft;
  set: (key: StoreProfileField, value: string) => void;
  pick: (key: "category" | "source" | "accountManagerId") => (keys: Iterable<unknown>) => void;
  removeTag: (next: string[]) => void;
  errors: StoreProfileErrors;
  clearTagError: () => void;
  tagInput: string;
  setTagInput: (value: string) => void;
  addTag: () => void;
  onTagKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  categories: string[];
  sources: string[];
  optionsLoading: boolean;
  optionsError: boolean;
  retryOptions: () => void;
  managers: PlatformUser[];
  usersLoading: boolean;
  usersError: boolean;
  changed: boolean;
  validate: () => boolean;
  save: () => Promise<boolean>;
}

export function useStoreProfileForm(client: Client, initial: StoreProfileDraft): StoreProfileForm {
  const [draft, setDraft] = useState<StoreProfileDraft>(initial);
  const [errors, setErrors] = useState<StoreProfileErrors>({});
  const [tagInput, setTagInput] = useState("");
  const options = useQuery<{ platformStoreProfileOptions: StoreProfileOptions }>(PLATFORM_STORE_PROFILE_OPTIONS);
  const users = useQuery<{ platformUsers: PlatformList<PlatformUser> }>(PLATFORM_USERS, {
    variables: { limit: USERS_PAGE, offset: 0 },
  });
  const [updateProfile] = useMutation(UPDATE_TENANT_PROFILE);

  // FR-2.4: only an ACTIVE platform user can look after a store; the current manager stays listed even if since
  // disabled, so the row reads.
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
    set(key, typeof value === "string" && value !== PROFILE_NONE_KEY ? value : "");
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

  const validate = () => {
    const local = validateStoreProfile(draft);
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!changed) return true;
    if (!validate()) return false;
    try {
      await updateProfile({ variables: { id: client.id, input: { profile: patch } } });
      return true;
    } catch (error) {
      const fieldErrors = storeProfileErrorsFromServer(error);
      if (fieldErrors) setErrors(fieldErrors);
      else {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      }
      return false;
    }
  };

  return {
    initial,
    draft,
    set,
    pick,
    removeTag: (next) => setDraft((current) => ({ ...current, tags: next })),
    errors,
    clearTagError: () => setErrors((current) => ({ ...current, tags: undefined })),
    tagInput,
    setTagInput,
    addTag,
    onTagKeyDown,
    categories: options.data?.platformStoreProfileOptions.categories ?? [],
    sources: options.data?.platformStoreProfileOptions.sources ?? [],
    optionsLoading: options.loading,
    optionsError: !!options.error,
    retryOptions: () => void options.refetch(),
    managers,
    usersLoading: users.loading,
    usersError: !!users.error,
    changed,
    validate,
    save,
  };
}
