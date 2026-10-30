import { useMemo, useState, useSyncExternalStore, type ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { AiSettings } from "../components/settings/AiSettings";
import { AuditLogSettings } from "../components/settings/AuditLogSettings";
import { BillingRulesSettings } from "../components/settings/BillingRulesSettings";
import { DiscountsSettings } from "../components/settings/DiscountsSettings";
import { GeneralSettings } from "../components/settings/GeneralSettings";
import { PlansSettings } from "../components/settings/PlansSettings";
import { ProfileSecuritySettings } from "../components/settings/ProfileSecuritySettings";
import { TeamSettings } from "../components/settings/TeamSettings";
import {
  DEFAULT_SETTINGS_SECTION,
  isSettingsSection,
  settingsRedirect,
  type SettingsSectionKey,
} from "../components/settings/settings-routes";
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  settingsHref,
  settingsSearchEntries,
} from "../components/settings/settings-sections";
import { SettingsSearch, SettingsShell, type SettingsMenuGroup } from "../components/ui";
import { IconLogout, IconSettings } from "../components/ui/icons";
import { useAuth } from "../providers/AuthProvider";

const PHONE_QUERY = "(max-width: 767px)";

function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Below 768px `/settings` is the section list; from 768px up it opens the first section (01 §6.2). */
function useIsPhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}

const SECTION_CONTENT: Record<SettingsSectionKey, ComponentType> = {
  profile: ProfileSecuritySettings,
  team: TeamSettings,
  general: GeneralSettings,
  plans: PlansSettings,
  discounts: DiscountsSettings,
  billing: BillingRulesSettings,
  ai: AiSettings,
  audit: AuditLogSettings,
};

/**
 * Settings (04 S-07): slate header with "Search settings" (sections and field labels), then the shared
 * SettingsShell — a 260px menu card (Your account · Platform · Records, Sign out last after a divider) and a
 * full-width content column. Each section keeps its URL (/settings/:section); old section URLs redirect.
 */
export function Settings() {
  const { section } = useParams<{ section: string }>();
  const { signOut } = useAuth();
  const isPhone = useIsPhone();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const groups = useMemo<SettingsMenuGroup[]>(
    () =>
      SETTINGS_GROUPS.map((group) => ({
        label: group.label,
        items: group.keys.map((key) => ({
          key,
          label: SETTINGS_SECTIONS[key].label,
          href: settingsHref(key),
          icon: SETTINGS_SECTIONS[key].icon,
        })),
      })),
    [],
  );
  const searchEntries = useMemo(() => settingsSearchEntries(), []);

  const redirect = settingsRedirect(section);
  if (redirect) return <Navigate to={redirect} replace />;

  const active = isSettingsSection(section) ? section : undefined;
  const Content = active ? SECTION_CONTENT[active] : null;

  return (
    <div>
      {/* On phone a section opens full screen with its own back button. */}
      <div className={active ? "max-md:hidden" : undefined}>
        <PageHeader
          type="page"
          icon={<IconSettings aria-hidden />}
          section="slate"
          title="Settings"
          description="Your account, team, plans, billing rules, AI and the audit trail."
          actions={<SettingsSearch entries={searchEntries} />}
        />
      </div>

      <SettingsShell
        aria-label="Settings sections"
        groups={groups}
        activeKey={active}
        footer={[{ key: "sign-out", label: "Sign out", icon: IconLogout, onSelect: () => setSignOutOpen(true) }]}
        showList={!active}
        back={{ href: "/settings", label: "Settings" }}
      >
        {Content ? <Content key={active} /> : isPhone ? null : <Navigate to={settingsHref(DEFAULT_SETTINGS_SECTION)} replace />}
      </SettingsShell>

      <ConfirmModal
        isOpen={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => void signOut()}
        title="Sign out?"
        description="You'll need to sign in again to use the console."
        confirmLabel="Sign out"
        confirmColor="primary"
      />
    </div>
  );
}
