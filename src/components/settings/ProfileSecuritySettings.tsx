/**
 * Settings › Profile & security (04 S-07a, PRD-024 FR-4.3, D8)
 *
 * Your account (platformMe, read-only: the API has no mutation for the name yet), two-step verification with
 * "Set up again" through /mfa, Change password (`platformChangePassword`: the server re-checks the current
 * password and signs out every other session; keeps its own button) and Sessions (`platformMySessions`, one
 * revoked at a time with `revokePlatformSession`; "Sign out everywhere" in the card header).
 */

import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { PLATFORM_CHANGE_PASSWORD, PLATFORM_MY_SESSIONS, REVOKE_PLATFORM_SESSION } from "../../graphql/auth";
import { errorReasonOf } from "../../lib/apollo-client";
import { getPlatformRoleLabel } from "../../lib/display-labels.util";
import { isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { passwordErrorReasonEnum, passwordPolicyError } from "../../lib/password-policy";
import { deviceLabel } from "../../lib/session-device.util";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformSessionInfo } from "../../types/platform-api";
import { toasts } from "../../copy";
import { ConfirmModal } from "../common/ConfirmModal";
import {
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  FieldGrid,
  Input,
  formatDateTime,
  formatRelative,
  toastError,
  type DataTableColumn,
} from "../ui";
import { IconDelete, IconLock, IconLogout } from "../ui/icons";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { TableCardHeader } from "./TableCardHeader";

/** `extensions.reason` for a wrong current password (FR-4.3). */
const INVALID_PASSWORD_REASON = "INVALID_PASSWORD";

/** Fixed 356 → Device 328px in the 684px column (04 S-07a). */
const SESSION_COLUMNS: DataTableColumn[] = [
  { key: "device", label: "Device" },
  { key: "created", label: "Signed in", width: 150 },
  { key: "lastUsed", label: "Last used", width: 150 },
];

interface PasswordErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

/** A read-only value in the field grid: label above, value below. */
function ReadOnlyField({ id, label, children }: { id?: string; label: string; children: ReactNode }) {
  return (
    <div id={id} data-settings-field className="flex min-w-0 flex-col gap-1.5">
      <span className="text-label font-medium text-fg">{label}</span>
      <div className="flex min-h-9 flex-wrap items-center gap-2 text-body text-fg">{children}</div>
    </div>
  );
}

export function ProfileSecuritySettings() {
  const navigate = useNavigate();
  const { user, signOutEverywhere } = useAuth();

  const sessions = useQuery<{ platformMySessions: PlatformSessionInfo[] }>(PLATFORM_MY_SESSIONS, {
    fetchPolicy: "cache-and-network",
  });
  const [changePassword] = useMutation(PLATFORM_CHANGE_PASSWORD);
  const [revokeSession] = useMutation(REVOKE_PLATFORM_SESSION);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [revoking, setRevoking] = useState<PlatformSessionInfo | null>(null);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);

  const sessionRows = sessions.data?.platformMySessions ?? [];
  const passwordReady =
    currentPassword !== "" && passwordPolicyError(newPassword) == null && confirmPassword === newPassword;

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    const next: PasswordErrors = {
      current: currentPassword ? undefined : "Enter your current password.",
      next: passwordPolicyError(newPassword) ?? undefined,
      confirm: confirmPassword === newPassword ? undefined : "The two passwords don't match.",
    };
    setErrors(next);
    if (next.current || next.next || next.confirm) return;

    setIsSaving(true);
    try {
      await changePassword({ variables: { currentPassword, newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      addToast({ title: "Password changed. Your other sessions were signed out." });
      await sessions.refetch().catch(() => undefined);
    } catch (error) {
      const reason = errorReasonOf(error);
      if (reason === INVALID_PASSWORD_REASON) {
        setErrors({ current: "That password didn't match." });
      } else if (reason === passwordErrorReasonEnum.WEAK_PASSWORD) {
        setErrors({
          next: isUserInputError(error) && error instanceof Error ? error.message : "Choose a stronger password.",
        });
      } else {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRevoke = async (session: PlatformSessionInfo) => {
    try {
      await revokeSession({ variables: { id: session.id } });
      addToast({ title: `Signed out ${deviceLabel(session.userAgent)}.` });
      await sessions.refetch().catch(() => undefined);
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    }
  };

  const confirmLogoutAll = () => {
    signOutEverywhere().catch((error) => {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    });
  };

  const signOutEverywhereButton = (
    <Button
      id="sign-out-everywhere"
      variant="destructive-secondary"
      size="sm"
      startIcon={<IconLogout aria-hidden />}
      onPress={() => setLogoutAllOpen(true)}
    >
      Sign out everywhere
    </Button>
  );

  const renderSessionCell = (session: PlatformSessionInfo, key: string) => {
    switch (key) {
      case "device":
        return (
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-body text-fg" title={session.userAgent ?? undefined}>
                {deviceLabel(session.userAgent)}
              </span>
              {session.current ? <Chip tone="info">This device</Chip> : null}
            </div>
            <span className="block truncate text-label text-fg-muted num">{session.ipAddress || "—"}</span>
          </div>
        );
      case "created":
        return <span className="num">{formatDateTime(session.createdAt)}</span>;
      case "lastUsed":
        return session.lastUsedAt ? <span className="num">{formatRelative(session.lastUsedAt)}</span> : <span className="text-fg-subtle">—</span>;
      default:
        return null;
    }
  };

  return (
    <div>
      <SettingsSectionHeader section="profile" />
      <div className="flex flex-col gap-4">
        <Card id="account" data-settings-field title="Your account" description="The platform account you're signed in with.">
          <FieldGrid>
            <ReadOnlyField label="Name">{user?.name || "—"}</ReadOnlyField>
            <ReadOnlyField label="Email">
              <span className="break-all">{user?.email ?? "—"}</span>
            </ReadOnlyField>
            <ReadOnlyField label="Role">{user ? <Chip tone="neutral">{getPlatformRoleLabel(user.role)}</Chip> : "—"}</ReadOnlyField>
            <ReadOnlyField id="two-step" label="Two-step verification">
              <Chip tone={user?.mfaEnabled ? "success" : "warning"}>{user?.mfaEnabled ? "On" : "Off"}</Chip>
              <Button variant="tertiary" size="sm" startIcon={<IconLock aria-hidden />} onPress={() => navigate("/mfa")}>
                {user?.mfaEnabled ? "Set up again" : "Set up"}
              </Button>
            </ReadOnlyField>
          </FieldGrid>
        </Card>

        <Card title="Change password" description="Your other sessions are signed out when the password changes.">
          <form className="flex flex-col gap-4" onSubmit={(event) => void submitPassword(event)} noValidate>
            <FieldGrid>
              <Input
                id="password-current"
                label="Current password"
                isRequired
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onValueChange={setCurrentPassword}
                isInvalid={!!errors.current}
                errorMessage={errors.current}
              />
              <Input
                label="New password"
                isRequired
                type="password"
                autoComplete="new-password"
                description="At least 8 characters."
                value={newPassword}
                onValueChange={setNewPassword}
                isInvalid={!!errors.next}
                errorMessage={errors.next}
              />
              <Input
                label="Confirm new password"
                isRequired
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onValueChange={setConfirmPassword}
                isInvalid={!!errors.confirm}
                errorMessage={errors.confirm}
              />
            </FieldGrid>
            <div>
              <Button type="submit" variant="primary" size="sm" isLoading={isSaving} isDisabled={!passwordReady}>
                Change password
              </Button>
            </div>
          </form>
        </Card>

        <div id="sessions" data-settings-field>
          {sessions.error && !sessions.data ? (
            <Card title="Sessions" actions={signOutEverywhereButton}>
              <ErrorState inline title="Couldn't load your sessions." description={toasts.genericError} onRetry={() => void sessions.refetch()} />
            </Card>
          ) : (
            <DataTable
              aria-label="Your sessions"
              toolbar={
                <TableCardHeader
                  title="Sessions"
                  description="Where you're signed in to this console. Revoke a session you don't recognise."
                  actions={signOutEverywhereButton}
                />
              }
              columns={SESSION_COLUMNS}
              rows={sessionRows}
              getRowKey={(session) => session.id}
              renderCell={renderSessionCell}
              rowHeight="tall"
              isLoading={sessions.loading && !sessions.data}
              rowActions={(session) =>
                // This browser's own session ends with Sign out or Sign out everywhere.
                session.current
                  ? []
                  : [{ key: "revoke", label: "Revoke", icon: IconDelete, destructive: true, onSelect: () => setRevoking(session) }]
              }
              rowActionsLabel={(session) => `Actions for ${deviceLabel(session.userAgent)}`}
              mobileRow={(session) => (
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-body font-medium text-fg">{deviceLabel(session.userAgent)}</span>
                    {session.current ? <Chip tone="info">This device</Chip> : null}
                  </div>
                  <p className="truncate text-label text-fg-muted num">
                    Signed in {formatDateTime(session.createdAt)}
                    {session.lastUsedAt ? ` · last used ${formatRelative(session.lastUsedAt)}` : ""}
                  </p>
                </div>
              )}
              emptyContent={
                <EmptyState compact icon={IconLock} title="No other sessions" description="Sessions you start on other devices show up here." />
              }
            />
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={revoking != null}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking) void confirmRevoke(revoking);
        }}
        title="Revoke this session?"
        description={
          revoking
            ? `${deviceLabel(revoking.userAgent)}${revoking.ipAddress ? ` (${revoking.ipAddress})` : ""} is signed out. Its access ends within 15 minutes.`
            : ""
        }
        confirmLabel="Revoke session"
        confirmColor="danger"
      />
      <ConfirmModal
        isOpen={logoutAllOpen}
        onClose={() => setLogoutAllOpen(false)}
        onConfirm={confirmLogoutAll}
        title="Sign out everywhere?"
        description="Every session, including this one, ends. You'll sign in again."
        confirmLabel="Sign out everywhere"
        confirmColor="danger"
      />
    </div>
  );
}

export default ProfileSecuritySettings;
