/**
 * The feature request drawer's pop-ups (backend PRD-049 step A3, FR-A29):
 * - Change status: the status, a note the stores see (required for Not
 *   planned) and, for Released, the https link to the article. Planned,
 *   In progress, Released and Not planned tell every store that posted or
 *   voted, so the dialog says so.
 * - Merge into…: pick another request by search; votes move there, one per
 *   store (the target's vote wins).
 * - Edit: title, type, area and the problem.
 * All need platform:feedback:manage; the server checks again.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  PopupTitle,
  SearchInput,
  Select,
  SelectItem,
  Spinner,
  Textarea,
  cx,
  toastError,
} from "../ui";
import { IconEdit, IconFlag, IconInfo, IconLayers } from "../ui/icons";
import {
  EDIT_FEATURE_REQUEST,
  MERGE_FEATURE_REQUESTS,
  PLATFORM_FEATURE_REQUESTS,
  SET_FEATURE_REQUEST_STATUS,
} from "../../graphql/feature-requests";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import {
  FEATURE_AREA_OPTIONS,
  FEATURE_PROBLEM_MAX_CHARS,
  FEATURE_SETTABLE_STATUSES,
  FEATURE_STATUS_LABEL,
  FEATURE_STATUS_NOTE_MAX_CHARS,
  FEATURE_STATUS_TONE,
  FEATURE_TITLE_MAX_CHARS,
  FEATURE_TYPE_OPTIONS,
  editDraftOf,
  editInputOf,
  featureFailureCopy,
  featureFieldErrorsFromServer,
  mergeCandidates,
  scoreLabel,
  shouldReloadAfter,
  statusDraftChanged,
  statusDraftOf,
  statusInputOf,
  statusNotifiesStores,
  validateEditDraft,
  validateStatusDraft,
  type FeatureEditDraft,
  type FeatureEditErrors,
  type FeatureRequest,
  type FeatureStatus,
  type FeatureStatusDraft,
  type FeatureStatusErrors,
  type FeatureType,
} from "./feature-requests.util";

const MERGE_SEARCH_LIMIT = 10;

function fail(error: unknown) {
  const message = featureFailureCopy(error);
  if (message) toastError(message);
}

// ─── Change status ────────────────────────────────────────────────────────

export interface FeatureStatusDialogProps {
  request: FeatureRequest;
  isOpen: boolean;
  onClose: () => void;
  refetchQueries: string[];
}

export function FeatureStatusDialog({ request, isOpen, onClose, refetchQueries }: FeatureStatusDialogProps) {
  const [draft, setDraft] = useState<FeatureStatusDraft>(() => statusDraftOf(request));
  const [errors, setErrors] = useState<FeatureStatusErrors>({});
  const [save, { loading }] = useMutation(SET_FEATURE_REQUEST_STATUS, { refetchQueries });
  // Each opening starts from the request as it is now.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDraft(statusDraftOf(request));
      setErrors({});
    }
  }

  const change = (patch: Partial<FeatureStatusDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => ({ ...current, ...Object.fromEntries(Object.keys(patch).map((key) => [key, undefined])), form: undefined }));
  };

  const submit = async () => {
    const found = validateStatusDraft(draft);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    if (!statusDraftChanged(draft, request)) {
      onClose();
      return;
    }
    try {
      await save({ variables: { id: request.id, input: statusInputOf(draft) } });
      onClose();
    } catch (error) {
      const fields = featureFieldErrorsFromServer(error);
      if (fields) {
        setErrors(fields);
        return;
      }
      fail(error);
      if (shouldReloadAfter(error)) onClose();
    }
  };

  const notifies = statusNotifiesStores(draft.status) && draft.status !== request.status;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconFlag aria-hidden />}>Change status</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-label text-fg-muted">
              <span className="font-mono">{request.ref}</span> · {request.title}
            </p>
            <Select
              label="Status"
              isRequired
              selectedKeys={new Set([draft.status])}
              disallowEmptySelection
              onSelectionChange={(keys) => change({ status: String(Array.from(keys)[0]) as FeatureStatus })}
              isInvalid={!!errors.status}
              errorMessage={errors.status}
            >
              {FEATURE_SETTABLE_STATUSES.map((status) => (
                <SelectItem key={status}>{FEATURE_STATUS_LABEL[status]}</SelectItem>
              ))}
            </Select>
            <Textarea
              label={draft.status === "NOT_PLANNED" ? "Why it isn't planned" : "Note to the stores (optional)"}
              isRequired={draft.status === "NOT_PLANNED"}
              minRows={3}
              maxLength={FEATURE_STATUS_NOTE_MAX_CHARS}
              placeholder="Shown on the request to every store"
              value={draft.note}
              onValueChange={(note) => change({ note })}
              isInvalid={!!errors.note}
              errorMessage={errors.note}
            />
            {draft.status === "RELEASED" ? (
              <Input
                label="Help article or release note (optional)"
                type="url"
                placeholder="https://"
                value={draft.releaseUrl}
                onValueChange={(releaseUrl) => change({ releaseUrl })}
                isInvalid={!!errors.releaseUrl}
                errorMessage={errors.releaseUrl}
              />
            ) : null}
            {notifies ? (
              <p className="flex gap-2 rounded-xl bg-tone-info-soft px-3 py-2 text-label text-fg">
                <IconInfo aria-hidden className="mt-0.5 size-4 shrink-0" />
                Every store that posted or voted on this request is told it's {FEATURE_STATUS_LABEL[draft.status].toLowerCase()}
                {draft.note.trim() ? ", with your note" : ""}.
              </p>
            ) : null}
            {errors.form ? <p className="text-label text-tone-danger-text">{errors.form}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={loading} onPress={() => void submit()}>
            Save status
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Merge into… ──────────────────────────────────────────────────────────

export interface FeatureMergeDialogProps {
  request: FeatureRequest;
  isOpen: boolean;
  onClose: () => void;
  /** After a merge: open the target (the source is now MERGED). */
  onMerged: (targetId: string) => void;
  refetchQueries: string[];
}

export function FeatureMergeDialog({ request, isOpen, onClose, onMerged, refetchQueries }: FeatureMergeDialogProps) {
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebouncedValue(search.trim());
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setSearch("");
      setTargetId(null);
      setError(null);
    }
  }
  const { data, loading, error: loadError } = useQuery(PLATFORM_FEATURE_REQUESTS, {
    variables: { sort: "TOP", search: debounced || null, includeHidden: true, limit: MERGE_SEARCH_LIMIT, offset: 0 },
    skip: !isOpen,
    fetchPolicy: "cache-and-network",
  });
  const candidates: FeatureRequest[] = mergeCandidates(data?.platformFeatureRequests?.items ?? [], request.id);
  const [merge, { loading: merging }] = useMutation(MERGE_FEATURE_REQUESTS, { refetchQueries });

  const submit = async () => {
    if (!targetId) {
      setError("Pick the request to merge into.");
      return;
    }
    try {
      await merge({ variables: { sourceId: request.id, targetId } });
      onMerged(targetId);
    } catch (failure) {
      const fields = featureFieldErrorsFromServer(failure);
      if (fields) {
        setError(Object.values(fields)[0] ?? null);
        return;
      }
      fail(failure);
      if (shouldReloadAfter(failure)) onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconLayers aria-hidden />}>Merge into another request</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <p className="text-label text-fg-muted">
              <span className="font-mono">{request.ref}</span> becomes Merged and its votes move to the request you pick,
              one per store. When a store voted on both, its vote on the other request is kept.
            </p>
            <SearchInput
              aria-label="Find a request"
              placeholder="Title, FR number or store"
              value={search}
              onValueChange={(value) => {
                setSearch(value);
                setError(null);
              }}
            />
            <div role="radiogroup" aria-label="Request to merge into" className="max-h-72 space-y-1 overflow-auto">
              {loading && !data ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : loadError && !data ? (
                <p className="py-4 text-label text-tone-danger-text">Couldn't load requests. Close and try again.</p>
              ) : candidates.length ? (
                candidates.map((item) => {
                  const selected = item.id === targetId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setTargetId(item.id);
                        setError(null);
                      }}
                      className={cx(
                        "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left",
                        selected ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-muted",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-fg">{item.title}</span>
                        <span className="block font-mono text-label text-fg-muted">
                          {item.ref} · score {scoreLabel(item.score)}
                          {item.hidden ? " · hidden" : ""}
                        </span>
                      </span>
                      <Chip tone={FEATURE_STATUS_TONE[item.status]}>{FEATURE_STATUS_LABEL[item.status]}</Chip>
                    </button>
                  );
                })
              ) : (
                <p className="py-4 text-label text-fg-muted">
                  {debounced ? `No other request matches "${debounced}".` : "No other requests yet."}
                </p>
              )}
            </div>
            {error ? <p className="text-label text-tone-danger-text">{error}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={merging} isDisabled={!targetId} onPress={() => void submit()}>
            Merge
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Edit ─────────────────────────────────────────────────────────────────

export interface FeatureEditDialogProps {
  request: FeatureRequest;
  isOpen: boolean;
  onClose: () => void;
  refetchQueries: string[];
}

export function FeatureEditDialog({ request, isOpen, onClose, refetchQueries }: FeatureEditDialogProps) {
  const [draft, setDraft] = useState<FeatureEditDraft>(() => editDraftOf(request));
  const [errors, setErrors] = useState<FeatureEditErrors>({});
  const [save, { loading }] = useMutation(EDIT_FEATURE_REQUEST, { refetchQueries });
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDraft(editDraftOf(request));
      setErrors({});
    }
  }

  const change = (patch: Partial<FeatureEditDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => ({ ...current, ...Object.fromEntries(Object.keys(patch).map((key) => [key, undefined])), form: undefined }));
  };

  const submit = async () => {
    const found = validateEditDraft(draft);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    const input = editInputOf(draft, request);
    if (!input) {
      onClose();
      return;
    }
    try {
      await save({ variables: { id: request.id, input } });
      onClose();
    } catch (error) {
      const fields = featureFieldErrorsFromServer(error);
      if (fields) {
        setErrors(fields);
        return;
      }
      fail(error);
      if (shouldReloadAfter(error)) onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconEdit aria-hidden />}>Edit request</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-label text-fg-muted">Every store sees the edited request.</p>
            <Input
              label="Title"
              isRequired
              maxLength={FEATURE_TITLE_MAX_CHARS}
              value={draft.title}
              onValueChange={(title) => change({ title })}
              isInvalid={!!errors.title}
              errorMessage={errors.title}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Type"
                isRequired
                selectedKeys={new Set([draft.type])}
                disallowEmptySelection
                onSelectionChange={(keys) => change({ type: String(Array.from(keys)[0]) as FeatureType })}
                isInvalid={!!errors.type}
                errorMessage={errors.type}
              >
                {FEATURE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Area"
                isRequired
                selectedKeys={new Set([draft.area])}
                disallowEmptySelection
                onSelectionChange={(keys) => change({ area: String(Array.from(keys)[0]) })}
                isInvalid={!!errors.area}
                errorMessage={errors.area}
              >
                {FEATURE_AREA_OPTIONS.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>
            </div>
            <Textarea
              label="What problem would this solve?"
              isRequired
              minRows={5}
              maxLength={FEATURE_PROBLEM_MAX_CHARS}
              value={draft.problem}
              onValueChange={(problem) => change({ problem })}
              isInvalid={!!errors.problem}
              errorMessage={errors.problem}
            />
            {errors.form ? <p className="text-label text-tone-danger-text">{errors.form}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={loading} onPress={() => void submit()}>
            Save changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
