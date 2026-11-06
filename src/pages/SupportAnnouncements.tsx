import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { PageHeader } from "../components/common/PageHeader";
import {
  Button,
  CellText,
  Chip,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  PopupTitle,
  Switch,
  formatDate,
  toast,
  toastError,
  type DataTableColumn,
} from "../components/ui";
import { IconAdd, IconRocket } from "../components/ui/icons";
import {
  CREATE_PLATFORM_RELEASE_NOTE,
  DELETE_PLATFORM_RELEASE_NOTE,
  PLATFORM_RELEASE_NOTES,
  UPDATE_PLATFORM_RELEASE_NOTE,
} from "../graphql/support";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { useAuth } from "../providers/AuthProvider";

interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  releasedAt: string;
  bullets: string[];
  screenshotUrl: string | null;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string;
}

interface Draft {
  version: string;
  title: string;
  releasedAt: string;
  bullets: [string, string, string];
  screenshotUrl: string;
  published: boolean;
}

const EMPTY_DRAFT: Draft = { version: "", title: "", releasedAt: "", bullets: ["", "", ""], screenshotUrl: "", published: false };

const COLUMNS: DataTableColumn<ReleaseNote>[] = [
  { key: "release", label: "Release", mobile: "primary" },
  { key: "date", label: "Date", width: 130, mobile: "meta" },
  { key: "status", label: "Shown to stores", width: 160, skeleton: "badge", mobile: "badge" },
];

const toDraft = (note: ReleaseNote | null): Draft =>
  note
    ? {
        version: note.version,
        title: note.title,
        releasedAt: note.releasedAt.slice(0, 10),
        bullets: [note.bullets[0] ?? "", note.bullets[1] ?? "", note.bullets[2] ?? ""],
        screenshotUrl: note.screenshotUrl ?? "",
        published: note.status === "PUBLISHED",
      }
    : { ...EMPTY_DRAFT, releasedAt: new Date().toISOString().slice(0, 10) };

/**
 * Super Admin › Support › Announcements (round 2 §4, §5.13): the release notes every store sees in Help & support ›
 * What's new (version, date, up to three bullets, a screenshot link). Drafts stay here; Published shows them to
 * every store. Writing needs platform:tenants:manage (it reaches every store); reading platform:tenants:read.
 */
export function SupportAnnouncements() {
  const { can } = useAuth();
  const canWrite = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const { data, loading, error, refetch } = useQuery(PLATFORM_RELEASE_NOTES, { fetchPolicy: "cache-and-network" });
  const notes: ReleaseNote[] = data?.platformReleaseNotes ?? [];
  const [create, { loading: creating }] = useMutation(CREATE_PLATFORM_RELEASE_NOTE, { refetchQueries: ["PlatformReleaseNotes"] });
  const [update, { loading: updating }] = useMutation(UPDATE_PLATFORM_RELEASE_NOTE, { refetchQueries: ["PlatformReleaseNotes"] });
  const [remove, { loading: removing }] = useMutation(DELETE_PLATFORM_RELEASE_NOTE, { refetchQueries: ["PlatformReleaseNotes"] });
  const [editing, setEditing] = useState<ReleaseNote | "new" | null>(null);
  const [deleting, setDeleting] = useState<ReleaseNote | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const openEditor = (note: ReleaseNote | "new") => {
    setDraft(toDraft(note === "new" ? null : note));
    setEditing(note);
  };

  const fail = (failure: unknown) => {
    const message = mutationFailureCopy(failure);
    if (message) toastError(message);
  };

  const save = async () => {
    const input = {
      version: draft.version.trim(),
      title: draft.title.trim(),
      releasedAt: draft.releasedAt,
      bullets: draft.bullets.map((bullet) => bullet.trim()).filter(Boolean),
      screenshotUrl: draft.screenshotUrl.trim() || null,
      published: draft.published,
    };
    try {
      if (editing === "new") await create({ variables: { input } });
      else if (editing) await update({ variables: { id: editing.id, input } });
      toast(draft.published ? "Saved. Stores see it in What's new." : "Saved as a draft");
      setEditing(null);
    } catch (failure) {
      fail(failure);
    }
  };

  const renderCell = (note: ReleaseNote, key: string) => {
    switch (key) {
      case "release":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{note.title}</p>
            <p className="font-mono text-label text-fg-muted">v{note.version.replace(/^v/i, "")} · {note.bullets.length} bullets</p>
          </div>
        );
      case "date":
        return <CellText>{formatDate(note.releasedAt)}</CellText>;
      case "status":
        return <Chip tone={note.status === "PUBLISHED" ? "success" : "neutral"}>{note.status === "PUBLISHED" ? "Published" : "Draft"}</Chip>;
      default:
        return null;
    }
  };

  const setBullet = (index: number, value: string) =>
    setDraft((previous) => {
      const bullets = [...previous.bullets] as Draft["bullets"];
      bullets[index] = value;
      return { ...previous, bullets };
    });

  return (
    <>
      <PageHeader
        title="Announcements"
        eyebrow="Support"
        description="Release notes every store sees in Help & support › What's new"
        primaryAction={
          canWrite ? (
            <Button variant="primary" startIcon={<IconAdd aria-hidden className="size-4" />} onPress={() => openEditor("new")}>
              New release note
            </Button>
          ) : undefined
        }
      />

      {error && !notes.length ? (
        <ErrorState title="Couldn't load release notes." onRetry={() => void refetch()} />
      ) : (
        <DataTable<ReleaseNote>
          aria-label="Release notes"
          columns={COLUMNS}
          rows={notes}
          getRowKey={(note) => note.id}
          renderCell={renderCell}
          isLoading={loading && !data}
          onRowAction={canWrite ? (note) => openEditor(note) : undefined}
          rowActions={canWrite ? (note) => [{ key: "delete", label: "Delete", destructive: true, onSelect: () => setDeleting(note) }] : undefined}
          rowActionsLabel={(note) => `Actions for ${note.title}`}
          emptyContent={
            <EmptyState
              icon={IconRocket}
              title="No release notes yet"
              description="Write one when a release ships. Stores see published notes in What's new."
            />
          }
        />
      )}

      <Modal isOpen={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} size="md">
        <ModalContent>
          <ModalHeader>
            <PopupTitle icon={<IconRocket aria-hidden />}>{editing === "new" ? "New release note" : "Edit release note"}</PopupTitle>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Version" placeholder="2.4" isRequired maxLength={20} value={draft.version} onValueChange={(version) => setDraft((d) => ({ ...d, version }))} />
                <Input label="Release date" type="date" isRequired value={draft.releasedAt} onValueChange={(releasedAt) => setDraft((d) => ({ ...d, releasedAt }))} />
              </div>
              <Input label="Title" placeholder="One inbox for every message" isRequired maxLength={120} value={draft.title} onValueChange={(title) => setDraft((d) => ({ ...d, title }))} />
              {draft.bullets.map((bullet, index) => (
                <Input
                  key={index}
                  label={`Bullet ${index + 1}`}
                  placeholder={index === 0 ? "What changed, in one line" : "Optional"}
                  maxLength={200}
                  value={bullet}
                  onValueChange={(value) => setBullet(index, value)}
                />
              ))}
              <Input
                label="Screenshot link"
                placeholder="https://…"
                type="url"
                value={draft.screenshotUrl}
                onValueChange={(screenshotUrl) => setDraft((d) => ({ ...d, screenshotUrl }))}
              />
              <Switch isSelected={draft.published} onValueChange={(published) => setDraft((d) => ({ ...d, published }))}>
                Show it to every store now
              </Switch>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onPress={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={creating || updating}
              isDisabled={!draft.version.trim() || !draft.title.trim() || !draft.releasedAt}
              onPress={() => void save()}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          void remove({ variables: { id: deleting?.id } })
            .then(() => setDeleting(null))
            .catch(fail)
        }
        title={`Delete release note ${deleting?.version ?? ""}?`}
        description="Stores stop seeing it in What's new."
        confirmLabel="Delete release note"
        isLoading={removing}
      />
    </>
  );
}
