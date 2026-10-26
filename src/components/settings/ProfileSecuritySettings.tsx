/**
 * Settings › Profile & security (PRD-024 FR-4.3, D8)
 *
 * The signed-in platform user (platformMe), two-step verification status
 * with "Set up again" through the existing /mfa enrolment, Change password
 * (`platformChangePassword`: the server re-checks the current password and
 * signs out every other session) and the user's own sessions
 * (`platformMySessions`, one revoked at a time with `revokePlatformSession`).
 * Every success waits for the server.
 */

import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import {
  PLATFORM_CHANGE_PASSWORD,
  PLATFORM_MY_SESSIONS,
  REVOKE_PLATFORM_SESSION,
} from "../../graphql/auth";
import { errorReasonOf } from "../../lib/apollo-client";
import { getPlatformRoleLabel } from "../../lib/display-labels.util";
import {
  isUserInputError,
  mutationFailureCopy,
} from "../../lib/mutation-errors";
import {
  passwordErrorReasonEnum,
  passwordPolicyError,
} from "../../lib/password-policy";
import { deviceLabel } from "../../lib/session-device.util";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformSessionInfo } from "../../types/platform-api";
import { toasts } from "../../copy";
import { ConfirmModal } from "../common/ConfirmModal";
import {
  Button as UiButton,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  formatDateTime,
  toastError,
  type DataTableColumn,
} from "../ui";
import { IconLock } from "../ui/icons";

// ─── Constants ────────────────────────────────────────────────────────────

/** `extensions.reason` for a wrong current password (FR-4.3). */
const INVALID_PASSWORD_REASON = "INVALID_PASSWORD";

const SESSION_COLUMNS: DataTableColumn[] = [
  { key: "device", label: "Device" },
  { key: "ip", label: "IP address" },
  { key: "created", label: "Signed in" },
  { key: "lastUsed", label: "Last used" },
  { key: "actions", label: "Actions", align: "end", hideLabel: true },
];

// ─── Types ────────────────────────────────────────────────────────────────

interface PasswordErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

// ─── Component ────────────────────────────────────────────────────────────

export function ProfileSecuritySettings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* ----- Queries & Mutations ----- */

  const sessions = useQuery<{ platformMySessions: PlatformSessionInfo[] }>(
    PLATFORM_MY_SESSIONS,
    { fetchPolicy: "cache-and-network" },
  );
  const [changePassword] = useMutation(PLATFORM_CHANGE_PASSWORD);
  const [revokeSession] = useMutation(REVOKE_PLATFORM_SESSION);

  /* ----- State ----- */

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [revoking, setRevoking] = useState<PlatformSessionInfo | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const sessionRows = sessions.data?.platformMySessions ?? [];

  /* ----- Handlers ----- */

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    const next: PasswordErrors = {
      current: currentPassword ? undefined : "Enter your current password.",
      next: passwordPolicyError(newPassword) ?? undefined,
      confirm:
        confirmPassword === newPassword
          ? undefined
          : "The two passwords don't match.",
    };
    setErrors(next);
    if (next.current || next.next || next.confirm) return;

    setIsSaving(true);
    try {
      await changePassword({ variables: { currentPassword, newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      addToast({
        title: "Password changed. Your other sessions were signed out.",
      });
      await sessions.refetch().catch(() => undefined);
    } catch (error) {
      const reason = errorReasonOf(error);
      if (reason === INVALID_PASSWORD_REASON) {
        setErrors({ current: "That password didn't match." });
      } else if (reason === passwordErrorReasonEnum.WEAK_PASSWORD) {
        setErrors({
          next:
            isUserInputError(error) && error instanceof Error
              ? error.message
              : "Choose a stronger password.",
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
    setRevokingId(session.id);
    try {
      await revokeSession({ variables: { id: session.id } });
      addToast({ title: `Signed out ${deviceLabel(session.userAgent)}.` });
      await sessions.refetch().catch(() => undefined);
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setRevokingId(null);
    }
  };

  /* ----- Render ----- */

  const renderSessionCell = (session: PlatformSessionInfo, key: string) => {
    switch (key) {
      case "device":
        return (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-fg" title={session.userAgent ?? undefined}>
              {deviceLabel(session.userAgent)}
            </span>
            {session.current ? <Chip tone="info">This device</Chip> : null}
          </div>
        );
      case "ip":
        return <span className="num">{session.ipAddress || "—"}</span>;
      case "created":
        return <span className="num">{formatDateTime(session.createdAt)}</span>;
      case "lastUsed":
        return session.lastUsedAt ? (
          <span className="num">{formatDateTime(session.lastUsedAt)}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      case "actions":
        // This browser's own session ends with Log out or Sign out everywhere.
        return session.current ? null : (
          <UiButton
            variant="ghost"
            size="sm"
            isLoading={revokingId === session.id}
            onPress={() => setRevoking(session)}
          >
            Revoke
          </UiButton>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex max-w-content-form flex-col gap-4">
      <Card title="Your account" description="The platform account you're signed in with.">
        <dl className="grid grid-cols-1 gap-3 text-body sm:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="text-fg-muted">Name</dt>
          <dd className="text-fg">{user?.name || "—"}</dd>
          <dt className="text-fg-muted">Email</dt>
          <dd className="break-all text-fg">{user?.email ?? "—"}</dd>
          <dt className="text-fg-muted">Role</dt>
          <dd className="text-fg">{user ? getPlatformRoleLabel(user.role) : "—"}</dd>
          <dt className="text-fg-muted">Two-step verification</dt>
          <dd className="flex flex-wrap items-center gap-3">
            <Chip tone={user?.mfaEnabled ? "success" : "warning"}>
              {user?.mfaEnabled ? "On" : "Off"}
            </Chip>
            <UiButton
              variant="link"
              size="sm"
              startIcon={<IconLock aria-hidden />}
              onPress={() => navigate("/mfa")}
            >
              {user?.mfaEnabled ? "Set up again" : "Set up"}
            </UiButton>
          </dd>
        </dl>
      </Card>

      <Card
        title="Change password"
        description="Your other sessions are signed out when the password changes."
      >
        <form className="flex max-w-md flex-col gap-4" onSubmit={(event) => void submitPassword(event)} noValidate>
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onValueChange={setCurrentPassword}
            isInvalid={!!errors.current}
            errorMessage={errors.current}
          />
          <Input
            label="New password"
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
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onValueChange={setConfirmPassword}
            isInvalid={!!errors.confirm}
            errorMessage={errors.confirm}
          />
          <div>
            <UiButton type="submit" variant="primary" isLoading={isSaving}>
              Change password
            </UiButton>
          </div>
        </form>
      </Card>

      <Card
        title="Sessions"
        description="Where you're signed in to this console. Revoke a session you don't recognise; Sign out everywhere ends all of them."
      >
        {sessions.error && !sessions.data ? (
          <ErrorState
            inline
            title="Couldn't load your sessions."
            description={toasts.genericError}
            onRetry={() => void sessions.refetch()}
          />
        ) : (
          <DataTable
            aria-label="Your sessions"
            columns={SESSION_COLUMNS}
            rows={sessionRows}
            getRowKey={(session) => session.id}
            renderCell={renderSessionCell}
            isLoading={sessions.loading && !sessions.data}
            emptyContent={
              <EmptyState
                compact
                icon={IconLock}
                title="No other sessions"
                description="Sessions you start on other devices show up here."
              />
            }
          />
        )}
      </Card>

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
    </div>
  );
}

export default ProfileSecuritySettings;
