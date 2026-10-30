/**
 * Settings › Team & roles › Roles (04 S-07b change 3): areas as rows (200px), the five roles as columns (at least
 * 96px; the description is a tooltip on the name). Below 680px the card scrolls sideways with the area column
 * sticky.
 */
import { PLATFORM_ROLE_LABELS } from "../../lib/display-labels.util";
import { Card, Tooltip, cx } from "../ui";
import { MATRIX_ROLES, ROLE_ACCESS_LABELS, ROLE_AREAS, ROLE_DESCRIPTIONS, roleAccess } from "./roles-matrix.util";

export function RolesMatrixCard() {
  return (
    <Card id="roles" data-settings-field title="Roles" description="What each role can do in each area." padding="none">
      <div className="overflow-x-auto border-t border-line-subtle">
        <table className="w-full min-w-170 table-fixed border-collapse text-left">
          <caption className="sr-only">What each role can do</caption>
          <thead>
            <tr className="h-13 bg-table-head">
              <th scope="col" className="sticky left-0 z-10 w-50 bg-table-head px-4 text-label font-medium text-table-head-fg">
                Area
              </th>
              {MATRIX_ROLES.map((role) => (
                <th key={role} scope="col" className="min-w-24 px-3 text-label font-medium text-table-head-fg">
                  <Tooltip content={ROLE_DESCRIPTIONS[role]} placement="top">
                    <span tabIndex={0} className="cursor-default rounded-sm underline decoration-dotted underline-offset-2">
                      {PLATFORM_ROLE_LABELS[role]}
                    </span>
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_AREAS.map((area) => (
              <tr key={area.key} className="h-13 border-t border-line-subtle">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 text-body font-medium text-fg">
                  {area.label}
                </th>
                {MATRIX_ROLES.map((role) => {
                  const access = roleAccess(role, area);
                  return (
                    <td key={role} className={cx("px-3 text-label", access === "none" ? "text-fg-muted" : "text-fg")}>
                      {ROLE_ACCESS_LABELS[access]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
