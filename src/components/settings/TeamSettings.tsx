import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useState, type Key } from "react";
import type { PlatformList, PlatformRole, PlatformUser } from "../../types/platform-api";
import { platformRoleEnum } from "../../types/platform-api";
import { errorCodeOf } from "../../lib/apollo-client";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { nextOffset, SERVER_PAGE_LIMIT } from "../../lib/offset-paging.util";
import { PLATFORM_ROLE_LABELS } from "../../lib/display-labels.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  PLATFORM_DISABLE_USER,
  PLATFORM_INVITE_USER,
  PLATFORM_RESET_USER_MFA,
  PLATFORM_UPDATE_USER_ROLE,
  PLATFORM_USERS,
} from "../../graphql/team";
import { useAuth } from "../../providers/AuthProvider";
import { toasts } from "../../copy";
import { ConfirmModal } from "../common/ConfirmModal";
import { IconAdd, IconBlock, IconLock, IconUser } from "../ui/icons";
import {
  Card,
  Button as UiButton,
  CopyableId,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  StatusChip,
  DataTable,
  TablePagination,
  formatDateTime,
  toastError,
  useTableUrlState,
  type DataTableColumn,
  type RowMenuItem,
} from "../ui";
import { RolesMatrixCard } from "./RolesMatrixCard";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { TableCardHeader } from "./TableCardHeader";

const ROLE_LABELS = PLATFORM_ROLE_LABELS;

/** Fixed 476 → Member 208px in the 684px column (04 S-07b). */
const columns: DataTableColumn[] = [
  { key: "name", label: "Member" },
  { key: "role", label: "Role", width: 140 },
  { key: "status", label: "Status", width: 130, skeleton: "badge", mobile: "badge" },
  { key: "lastLoginAt", label: "Last login", width: 150 },
];

/**
 * Settings › Team & roles (04 S-07b, PRD-005 FR-8.2): the members table (invites with the one-time link, roles,
 * two-step resets, disabling) and the Roles card. The Invite pop-up stays as live (Check first 05 #29).
 */
export function TeamSettings() {
  const [createOpen, onCreateOpenChange] = useState(false);
  const { user: me, can } = useAuth();
  const canManageUsers = can(PLATFORM_PERMISSIONS.USERS_MANAGE);
  // PRD-014 UX-27: `platformUsers` needs users:manage; other roles get an
  // explanation instead of a FORBIDDEN error. Pages of 100 (FE-09).
  const query = useQuery<{ platformUsers: PlatformList<PlatformUser> }>(PLATFORM_USERS, {
    variables: { limit: SERVER_PAGE_LIMIT, offset: 0 },
    fetchPolicy: "cache-and-network",
    skip: !canManageUsers,
  });
  const usersPage = query.data?.platformUsers;
  const { fetchMore, loading: usersLoading } = query;
  const [lastPageSize, setLastPageSize] = useState<number | null>(null);
  useEffect(() => {
    const offset = nextOffset(usersPage, SERVER_PAGE_LIMIT, lastPageSize);
    if (offset === null || usersLoading) return;
    void fetchMore({ variables: { offset } })
      .then((result) => setLastPageSize(result.data.platformUsers.items.length))
      .catch(() => setLastPageSize(0));
  }, [fetchMore, lastPageSize, usersLoading, usersPage]);
  const [invite, { loading: inviting }] = useMutation<{ platformInviteUser: { user: PlatformUser; setupUrl: string } }>(PLATFORM_INVITE_USER);
  const [updateRole] = useMutation(PLATFORM_UPDATE_USER_ROLE);
  const [disable] = useMutation(PLATFORM_DISABLE_USER);
  const [resetMfa] = useMutation(PLATFORM_RESET_USER_MFA);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<PlatformRole>(platformRoleEnum.SUPPORT_AGENT);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<PlatformUser | null>(null);
  const [nextRole, setNextRole] = useState<PlatformRole>(platformRoleEnum.READ_ONLY);
  // PRD-014 UX-39: resetting two-step and disabling ask first.
  const [confirmTarget, setConfirmTarget] = useState<{ user: PlatformUser; action: "mfa" | "disable" } | null>(null);

  const users = query.data?.platformUsers.items ?? [];
  // 50 per page with the page in the URL (docs/design/09-settings-and-scale.md §3.1).
  const table = useTableUrlState();
  const filtered = users;
  const pageCount = Math.max(1, Math.ceil(filtered.length / table.pageSize));
  const page = Math.min(table.page, pageCount);
  const pageRows = filtered.slice((page - 1) * table.pageSize, page * table.pageSize);
  const isOwner = me?.role === platformRoleEnum.PLATFORM_OWNER;
  const roleOptions = (Object.keys(ROLE_LABELS) as PlatformRole[]).filter((key) => isOwner || key !== platformRoleEnum.PLATFORM_OWNER);

  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      await query.refetch();
      addToast({ title: done });
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    }
  };

  const sendInvite = async () => {
    setInviteError(null);
    try {
      const { data } = await invite({ variables: { email: email.trim(), name: name.trim(), role } });
      await query.refetch();
      setSetupUrl(data?.platformInviteUser.setupUrl ?? null);
      setEmail("");
      setName("");
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === "CONFLICT" || code === "BAD_USER_INPUT") setInviteError((error as Error).message);
      else {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      }
    }
  };

  const onAction = (user: PlatformUser, key: Key) => {
    if (key === "role") {
      setRoleTarget(user);
      setNextRole(user.role);
    } else if (key === "mfa" || key === "disable") {
      setConfirmTarget({ user, action: key });
    }
  };

  const confirmAction = () => {
    if (!confirmTarget) return;
    const { user, action } = confirmTarget;
    if (action === "mfa") {
      void run(() => resetMfa({ variables: { id: user.id } }), toasts.mfaReset(user.email));
    } else {
      void run(() => disable({ variables: { id: user.id } }), toasts.memberDisabled(user.email));
    }
  };

  const renderCell = (user: PlatformUser, key: string) => {
    switch (key) {
      case "name":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{user.name}{user.id === me?.id ? " (you)" : ""}</p>
            <p className="truncate text-label text-fg-muted">{user.email}</p>
          </div>
        );
      case "role":
        return <span className="block truncate">{ROLE_LABELS[user.role]}</span>;
      case "status":
        return (
          <div className="min-w-0">
            <StatusChip domain="user" status={user.status.toLowerCase()} />
            <p className="mt-0.5 truncate text-label text-fg-muted">Two-step {user.mfaEnabled ? "on" : "off"}</p>
          </div>
        );
      case "lastLoginAt":
        return user.lastLoginAt ? <span className="num">{formatDateTime(user.lastLoginAt)}</span> : <span className="text-fg-subtle">—</span>;
      default:
        return null;
    }
  };

  // Role changes, two-step resets and disabling need users:manage; your own row has no menu (review C-M5).
  const rowActions = (user: PlatformUser): RowMenuItem[] =>
    user.id === me?.id
      ? []
      : [
          { key: "role", label: "Change role", icon: IconUser, onSelect: () => onAction(user, "role") },
          { key: "mfa", label: "Reset two-step", icon: IconLock, onSelect: () => onAction(user, "mfa") },
          {
            key: "disable",
            label: "Disable member",
            icon: IconBlock,
            destructive: true,
            disabled: user.status === "DISABLED",
            onSelect: () => onAction(user, "disable"),
          },
        ];

  const header = (
    <SettingsSectionHeader
      section="team"
      actions={
        canManageUsers ? (
          <UiButton variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => onCreateOpenChange(true)}>
            Invite member
          </UiButton>
        ) : undefined
      }
    />
  );

  if (!canManageUsers) {
    return (
      <div>
        {header}
        <div className="flex flex-col gap-4">
          <Card>
            <EmptyState
              icon={IconLock}
              title="Only the platform owner manages the team"
              description="Ask the owner to invite someone, change a role or reset two-step verification."
            />
          </Card>
          <RolesMatrixCard />
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <div className="flex flex-col gap-4">
        {query.error ? (
          <ErrorState title="Couldn't load the team." description={toasts.genericError} onRetry={() => void query.refetch()} />
        ) : (
          <div id="members" data-settings-field>
            <DataTable
              aria-label="Platform team"
              toolbar={<TableCardHeader title="Members" description="Pending invites show as Invited until the link is used." />}
              columns={columns}
              rows={pageRows}
              getRowKey={(user) => user.id}
              renderCell={renderCell}
              isLoading={query.loading && !query.data}
              rowHeight="tall"
              rowActions={rowActions}
              rowActionsLabel={(user) => `Actions for ${user.email}`}
              stickyFirstColumn
              footer={
                <TablePagination
                  page={page}
                  pageSize={table.pageSize}
                  total={filtered.length}
                  onPageChange={table.setPage}
                  onPageSizeChange={table.setPageSize}
                />
              }
              emptyContent={
                <EmptyState
                  icon={IconUser}
                  title="No team members yet"
                  description="Invite the Zerror team here."
                  action={
                    <UiButton variant="primary" size="sm" startIcon={<IconAdd aria-hidden />} onPress={() => onCreateOpenChange(true)}>
                      Invite member
                    </UiButton>
                  }
                />
              }
            />
          </div>
        )}
        <RolesMatrixCard />
      </div>

      <Modal isOpen={createOpen} onClose={() => { onCreateOpenChange(false); setSetupUrl(null); }} width="sm">
        <ModalContent>
          <ModalHeader>{setupUrl ? "Invite link" : "Invite a team member"}</ModalHeader>
          <ModalBody>
            {setupUrl ? (
              <div className="flex flex-col gap-3">
                <p className="text-body text-fg-muted">Send this link to the new member. It sets their password and works for 48 hours.</p>
                <CopyableId value={setupUrl} className="max-w-full break-all text-left text-label" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Input label="Name" value={name} onValueChange={setName} />
                <Input label="Email" type="email" value={email} onValueChange={setEmail} isInvalid={!!inviteError} errorMessage={inviteError ?? undefined} />
                <Select label="Role" selectedKeys={new Set([role])} onSelectionChange={(keys) => { const value = Array.from(keys)[0]; if (typeof value === "string") setRole(value as PlatformRole); }} disallowEmptySelection>
                  {roleOptions.map((key) => (
                    <SelectItem key={key}>{ROLE_LABELS[key]}</SelectItem>
                  ))}
                </Select>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={() => { onCreateOpenChange(false); setSetupUrl(null); }}>{setupUrl ? "Done" : "Cancel"}</UiButton>
            {setupUrl ? null : (
              <UiButton variant="primary" isLoading={inviting} onPress={() => void sendInvite()}>Send invite</UiButton>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmModal
        isOpen={confirmTarget != null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={confirmAction}
        title={
          confirmTarget?.action === "disable"
            ? `Disable ${confirmTarget.user.email}?`
            : `Reset two-step verification for ${confirmTarget?.user.email ?? ""}?`
        }
        description={
          confirmTarget?.action === "disable"
            ? "They are signed out everywhere and can't log in again. Store sessions they opened with Log in end too."
            : "Their authenticator and recovery codes stop working. They set up two-step verification again at their next login."
        }
        confirmLabel={confirmTarget?.action === "disable" ? "Disable member" : "Reset two-step"}
        confirmColor="danger"
      />

      <Modal isOpen={roleTarget != null} onClose={() => setRoleTarget(null)} width="sm">
        <ModalContent>
          <ModalHeader>Change role for {roleTarget?.email}</ModalHeader>
          <ModalBody>
            <Select label="Role" selectedKeys={new Set([nextRole])} onSelectionChange={(keys) => { const value = Array.from(keys)[0]; if (typeof value === "string") setNextRole(value as PlatformRole); }} disallowEmptySelection>
              {roleOptions.map((key) => (
                <SelectItem key={key}>{ROLE_LABELS[key]}</SelectItem>
              ))}
            </Select>
            <p className="mt-2 text-caption text-fg-muted">Their open sessions end; they sign in again with the new role.</p>
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={() => setRoleTarget(null)}>Cancel</UiButton>
            <UiButton variant="primary" onPress={() => { const target = roleTarget; setRoleTarget(null); if (target) void run(() => updateRole({ variables: { id: target.id, role: nextRole } }), toasts.roleChanged); }}>Change role</UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
