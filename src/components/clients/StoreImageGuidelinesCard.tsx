/**
 * Store detail › Settings › Image guidelines (PRD-045 D7, §5.6)
 *
 * The recommended upload size of each image slot the store's dashboard
 * shows beside its upload fields: the platform defaults with this store's
 * overrides, because Zerror designs each storefront. Edited in place:
 * Edit turns the rows into fields, Save sends every custom row that
 * differs from its default (`updateTenant.imageGuidelines` replaces all
 * overrides) and a server `INVALID_IMAGE_GUIDELINE` lands on its slot.
 * `platform:tenants:manage` edits; every other role reads.
 */

import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useState } from "react";

import {
  PLATFORM_TENANT_IMAGE_GUIDELINES,
  UPDATE_TENANT_IMAGE_GUIDELINES,
} from "../../graphql/image-guidelines";
import {
  editImageGuidelineRow,
  hasImageGuidelineDefault,
  IMAGE_GUIDELINE_NOTE_MAX_LENGTH,
  imageGuidelineDraftOf,
  imageGuidelineErrorsFromServer,
  imageGuidelineLabel,
  imageGuidelineOverrides,
  imageGuidelinesChanged,
  imageRatioLabel,
  imageSizeLabel,
  resetImageGuidelineRow,
  validateImageGuidelines,
  type ImageGuidelineDraftField,
  type ImageGuidelineDraftRow,
  type ImageGuidelineErrors,
} from "../../lib/image-guidelines.util";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import type { Client } from "../../types";
import type { PlatformImageGuideline } from "../../types/platform-api";
import {
  Button as UiButton,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  toastError,
} from "../ui";
import { IconUploadImage } from "../ui/icons";
import { SkelButton, SkelLine } from "../common/SkeletonBits";
import { useUnsavedChangesGuard } from "../settings/SettingsSaveBar";

// ─── Constants ────────────────────────────────────────────────────────────

const CARD_TITLE = "Image guidelines";
const CARD_DESCRIPTION =
  "Recommended upload sizes the store's dashboard shows, in pixels.";

/** Rows the loading pass draws. */
const SKELETON_ROWS = 6;

// ─── Types ────────────────────────────────────────────────────────────────

interface ImageGuidelinesData {
  platformTenant: {
    id: string;
    imageGuidelines: PlatformImageGuideline[];
  } | null;
}

export interface StoreImageGuidelinesCardProps {
  client: Client;
}

// ─── Component ────────────────────────────────────────────────────────────

export function StoreImageGuidelinesCard({
  client,
}: StoreImageGuidelinesCardProps) {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const [editing, setEditing] = useState(false);

  /* ----- Queries & Mutations ----- */
  const query = useQuery<ImageGuidelinesData>(
    PLATFORM_TENANT_IMAGE_GUIDELINES,
    { variables: { id: client.id }, fetchPolicy: "cache-and-network" },
  );
  const data = query.data ?? query.previousData;
  const rows = data?.platformTenant?.imageGuidelines ?? null;

  if (query.error && !rows) {
    return (
      <Card title={CARD_TITLE}>
        <ErrorState
          inline
          title="Couldn't load the image guidelines."
          onRetry={() => void query.refetch()}
        />
      </Card>
    );
  }

  if (!rows) {
    return (
      <Card
        title={CARD_TITLE}
        description={CARD_DESCRIPTION}
        actions={canManage ? <SkelButton size="sm" className="w-12" /> : null}
        aria-busy
      >
        <ul className="flex flex-col gap-3">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className="grid grid-cols-2 gap-4">
              <SkelLine className="w-3/4" />
              <SkelLine className="w-1/2" />
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (editing) {
    return (
      <ImageGuidelinesForm
        client={client}
        initial={imageGuidelineDraftOf(rows)}
        onDone={() => setEditing(false)}
      />
    );
  }

  const customCount = rows.filter((row) => row.isCustom).length;

  return (
    <Card
      title={CARD_TITLE}
      description={
        customCount > 0
          ? `${CARD_DESCRIPTION} ${customCount} set for this store.`
          : `${CARD_DESCRIPTION} All platform defaults.`
      }
      actions={
        canManage && rows.length > 0 ? (
          <UiButton variant="ghost" size="sm" onPress={() => setEditing(true)}>
            Edit
          </UiButton>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={IconUploadImage}
          title="No image slots"
          description="The server sent no image guidelines for this store."
        />
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[34rem] text-left text-body">
            <thead>
              <tr className="border-b border-line-subtle text-label text-fg-muted">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Image
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Size
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Ratio
                </th>
                <th scope="col" className="py-2 font-medium">
                  Minimum
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.map((row) => (
                <tr key={row.slot} className="align-top">
                  <td className="py-2.5 pr-4">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-fg">
                        {imageGuidelineLabel(row.slot)}
                      </span>
                      {row.isCustom ? <Chip tone="info">Custom</Chip> : null}
                    </span>
                    {row.note ? (
                      <span className="mt-0.5 block text-caption text-fg-muted">
                        {row.note}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {imageSizeLabel(row.width, row.height)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {row.ratio ?? <span className="text-fg-subtle">Any</span>}
                  </td>
                  <td className="py-2.5 tabular-nums text-fg-muted">
                    {imageSizeLabel(row.minWidth, row.minHeight)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────

interface ImageGuidelinesFormProps {
  client: Client;
  initial: ImageGuidelineDraftRow[];
  onDone: () => void;
}

function ImageGuidelinesForm({
  client,
  initial,
  onDone,
}: ImageGuidelinesFormProps) {
  const [draft, setDraft] = useState<ImageGuidelineDraftRow[]>(initial);
  const [errors, setErrors] = useState<ImageGuidelineErrors>({});
  const [saving, setSaving] = useState(false);

  /* ----- Queries & Mutations ----- */
  const [updateGuidelines] = useMutation(UPDATE_TENANT_IMAGE_GUIDELINES);

  const changed = imageGuidelinesChanged(initial, draft);
  // Leaving the page (or closing the tab) with unsaved edits asks first.
  const { dialog: discardDialog } = useUnsavedChangesGuard(changed);

  /* ----- Handlers ----- */
  const replaceRow = (
    slot: string,
    update: (row: ImageGuidelineDraftRow) => ImageGuidelineDraftRow,
  ) => {
    setDraft((current) =>
      current.map((row) => (row.slot === slot ? update(row) : row)),
    );
    setErrors((current) => ({
      ...current,
      [slot]: undefined,
      form: undefined,
    }));
  };

  const handleEdit =
    (slot: string, field: ImageGuidelineDraftField) => (value: string) =>
      replaceRow(slot, (row) => editImageGuidelineRow(row, field, value));

  const handleSave = async () => {
    const local = validateImageGuidelines(draft);
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }
    setSaving(true);
    try {
      await updateGuidelines({
        variables: {
          id: client.id,
          input: { imageGuidelines: imageGuidelineOverrides(draft) },
        },
      });
      addToast({ title: `${client.storeName} image guidelines saved.` });
      onDone();
    } catch (error) {
      const slotErrors = imageGuidelineErrorsFromServer(
        error,
        draft.map((row) => row.slot),
      );
      if (slotErrors) {
        setErrors(slotErrors);
      } else {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {discardDialog}
      <Card
        title={CARD_TITLE}
        description="Blank minimums use the size. Leave the height blank for any height."
        actions={
          <>
            <UiButton
              variant="ghost"
              size="sm"
              onPress={onDone}
              isDisabled={saving}
            >
              Cancel
            </UiButton>
            <UiButton
              variant="primary"
              size="sm"
              isLoading={saving}
              isDisabled={!changed}
              onPress={() => void handleSave()}
            >
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
          <ul className="flex flex-col divide-y divide-line-subtle">
            {draft.map((row) => (
              <li key={row.slot} className="py-3 first:pt-0 last:pb-0">
                <GuidelineFields
                  row={row}
                  error={errors[row.slot]}
                  isDisabled={saving}
                  onEdit={(field) => handleEdit(row.slot, field)}
                  onReset={() => replaceRow(row.slot, resetImageGuidelineRow)}
                />
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────

interface GuidelineFieldsProps {
  row: ImageGuidelineDraftRow;
  error: string | undefined;
  isDisabled: boolean;
  onEdit: (field: ImageGuidelineDraftField) => (value: string) => void;
  onReset: () => void;
}

function GuidelineFields({
  row,
  error,
  isDisabled,
  onEdit,
  onReset,
}: GuidelineFieldsProps) {
  const label = imageGuidelineLabel(row.slot);
  const ratio = imageRatioLabel(Number(row.width), Number(row.height) || null);
  const errorId = `image-guideline-error-${row.slot}`;
  const labelId = `image-guideline-label-${row.slot}`;
  const pxField = (field: ImageGuidelineDraftField, fieldLabel: string) => (
    <Input
      label={fieldLabel}
      aria-label={`${label}: ${fieldLabel.toLowerCase()}`}
      inputMode="numeric"
      value={row[field]}
      onValueChange={onEdit(field)}
      isDisabled={isDisabled}
      isInvalid={!!error}
      aria-describedby={error ? errorId : undefined}
    />
  );

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span id={labelId} className="text-body text-fg">
            {label}
          </span>
          {row.custom ? <Chip tone="info">Custom</Chip> : null}
          <span className="text-caption text-fg-muted">
            {ratio ? `Ratio ${ratio}` : "Any height"}
          </span>
        </div>
        {hasImageGuidelineDefault(row.slot) ? (
          <UiButton
            variant="ghost"
            size="sm"
            aria-label={`Reset ${label} to the platform default`}
            isDisabled={isDisabled || !row.custom}
            onPress={onReset}
          >
            Reset
          </UiButton>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {pxField("width", "Width")}
        {pxField("height", "Height")}
        {pxField("minWidth", "Min width")}
        {pxField("minHeight", "Min height")}
      </div>
      <Input
        label="Note"
        aria-label={`${label}: note`}
        placeholder="Shown beside the upload field (optional)"
        maxLength={IMAGE_GUIDELINE_NOTE_MAX_LENGTH}
        value={row.note}
        onValueChange={onEdit("note")}
        isDisabled={isDisabled}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-label text-tone-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default StoreImageGuidelinesCard;
