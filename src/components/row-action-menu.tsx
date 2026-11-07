"use client";

import { MoreHorizontal } from "lucide-react";

export type RowAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export function RowActionMenu({
  label,
  actions,
}: {
  label: string;
  actions: RowAction[];
}) {
  if (actions.length === 0) return null;
  return (
    <details className="row-action-menu">
      <summary aria-label={`Actions for ${label}`} title="More actions">
        <MoreHorizontal aria-hidden="true" size={18} />
      </summary>
      <div className="row-action-menu-items" role="menu" aria-label={`${label} actions`}>
        {actions.map((action) => (
          <button
            type="button"
            role="menuitem"
            key={action.label}
            className={action.destructive ? "is-destructive" : undefined}
            disabled={action.disabled}
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              action.onSelect();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </details>
  );
}
