import { useMutation, useQuery } from "@apollo/client";
import { DropdownItem, DropdownTrigger, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, addToast } from "@heroui/react";
import { useState, type Key } from "react";
import type { PlatformList, PlatformRole, PlatformUser } from "../../types/platform-api";
import { platformRoleEnum } from "../../types/platform-api";
import { errorCodeOf } from "../../lib/apollo-client";
import { mutationFailureCopy } from "../../lib/mutation-errors";
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
import { dataTableClassNames } from "../common/dataTableStyles";
import { IconAdd, IconMore } from "../ui/icons";
import {
  Button as UiButton,
  Card,
  Chip,
  CopyableId,
  Dropdown,
  DropdownMenu,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Skeleton,
  StatusChip,
  formatDateTime,
  menuItemDangerClasses,
  tableRowClasses,
  toastError,
} from "../ui";

const ROLE_LABELS: Record<PlatformRole, string> = {
  PLATFORM_OWNER: "Owner",
  PLATFORM_ADMIN: "Admin",
  BILLING_MANAGER: "Billing manager",
  SUPPORT_AGENT: "Support agent",
  READ_ONLY: "Read-only",
};

const columns = [
  { key: "name", label: "Member" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "mfa", label: "Two-step" },
  { key: "lastLoginAt", label: "Last login" },
  { key: "actions", label: "" },
];

/** Settings › Team (PRD-005 FR-8.2): platform users, invites with the one-time link, roles, MFA resets. */
export function TeamSettings({ createOpen, onCreateOpenChange }: { createOpen: boolean; onCreateOpenChange: (open: boolean) => void }) {
  const { user: me, can } = useAuth();
  const canManageUsers = can(PLATFORM_PERMISSIONS.USERS_MANAGE);
  const query = useQuery<{ platformUsers: PlatformList<PlatformUser> }>(PLATFORM_USERS, {
    variables: { limit: 200, offset: 0 },
    fetchPolicy: "cache-and-network",
  });
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

  const users = query.data?.platformUsers.items ?? [];
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
    } else if (key === "mfa") {
      void run(() => resetMfa({ variables: { id: user.id } }), `Two-step verification reset for ${user.email}.`);
    } else if (key === "disable") {
      void run(() => disable({ variables: { id: user.id } }), `${user.email} disabled.`);
    }
  };

  const renderCell = (user: PlatformUser, key: string) => {
    switch (key) {
      case "name":
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{user.name}{user.id === me?.id ? " (you)" : ""}</p>
            <p className="truncate text-caption text-fg-subtle">{user.email}</p>
          </div>
        );
      case "role":
        return ROLE_LABELS[user.role];
      case "status":
        return <StatusChip domain="user" status={user.status.toLowerCase()} />;
      case "mfa":
        return <Chip tone={user.mfaEnabled ? "success" : "neutral"}>{user.mfaEnabled ? "On" : "Off"}</Chip>;
      case "lastLoginAt":
        return user.lastLoginAt ? <span className="num">{formatDateTime(user.lastLoginAt)}</span> : <span className="text-fg-subtle">—</span>;
      case "actions":
        // Role changes, MFA resets and disabling need users:manage (review C-M5).
        return user.id === me?.id || !canManageUsers ? null : (
          <div className="flex justify-end">
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <IconButton aria-label={`Actions for ${user.email}`} showTooltip={false} size="sm">
                  <IconMore aria-hidden className="size-4" />
                </IconButton>
              </DropdownTrigger>
              <DropdownMenu aria-label="Member actions" onAction={(key) => onAction(user, key)} disabledKeys={user.status === "DISABLED" ? ["disable"] : []}>
                <DropdownItem key="role">Change role</DropdownItem>
                <DropdownItem key="mfa">Reset two-step verification</DropdownItem>
                <DropdownItem key="disable" className={menuItemDangerClasses}>Disable</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        );
      default:
        return null;
    }
  };

  if (query.error) {
    return <ErrorState title="Couldn't load the team" description={toasts.genericError} onRetry={() => void query.refetch()} />;
  }

  return (
    <>
      <Card padding="none">
        {query.loading && !query.data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Table aria-label="Platform team" removeWrapper classNames={{ ...dataTableClassNames, tr: tableRowClasses }}>
            <TableHeader columns={columns}>
              {(column) => <TableColumn key={column.key} align={column.key === "actions" ? "end" : "start"}>{column.label}</TableColumn>}
            </TableHeader>
            <TableBody items={users} emptyContent={<EmptyState title="No team members yet" description="Invite the Zerror team here." action={canManageUsers ? <UiButton variant="primary" size="sm" startIcon={<IconAdd aria-hidden />} onPress={() => onCreateOpenChange(true)}>Invite member</UiButton> : undefined} />}>
              {(user) => (
                <TableRow key={user.id}>
                  {(columnKey) => <TableCell>{renderCell(user, String(columnKey))}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal isOpen={createOpen} onClose={() => { onCreateOpenChange(false); setSetupUrl(null); }} width="sm">
        <ModalContent>
          <ModalHeader>{setupUrl ? "Invite link" : "Invite a team member"}</ModalHeader>
          <ModalBody>
            {setupUrl ? (
              <div className="flex flex-col gap-3">
                <p className="text-body text-fg-muted">Send this link to the new member. It sets their password and works for 48 hours.</p>
                <CopyableId value={setupUrl} />
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
            <UiButton variant="ghost" onPress={() => { onCreateOpenChange(false); setSetupUrl(null); }}>{setupUrl ? "Done" : "Cancel"}</UiButton>
            {setupUrl ? null : (
              <UiButton variant="primary" isLoading={inviting} onPress={() => void sendInvite()}>Send invite</UiButton>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

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
            <UiButton variant="ghost" onPress={() => setRoleTarget(null)}>Cancel</UiButton>
            <UiButton variant="primary" onPress={() => { const target = roleTarget; setRoleTarget(null); if (target) void run(() => updateRole({ variables: { id: target.id, role: nextRole } }), "Role changed."); }}>Change role</UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
