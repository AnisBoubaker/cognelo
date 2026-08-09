"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useId, useState } from "react";

export type WorkspaceTabDefinition<T extends string> = {
  href?: string;
  id: T;
  label: string;
  render: () => ReactNode;
};

type WorkspaceTabsProps<T extends string> = {
  ariaLabel: string;
  initialTab: T;
  tabs: Array<WorkspaceTabDefinition<T>>;
};

export function WorkspaceTabs<T extends string>({ ariaLabel, initialTab, tabs }: WorkspaceTabsProps<T>) {
  const [activeTab, setActiveTab] = useState<T>(initialTab);
  const instanceId = useId();
  const activeDefinition = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!activeDefinition) {
    return null;
  }

  return (
    <section className="section stack">
      <div className="tab-strip" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const tabId = `${instanceId}-${tab.id}-tab`;
          const panelId = `${instanceId}-${tab.id}-panel`;
          const isActive = tab.id === activeDefinition.id;

          const tabProps = {
            "aria-controls": panelId,
            "aria-selected": isActive,
            className: `tab-button ${isActive ? "is-active" : ""}`,
            id: tabId,
            role: "tab" as const
          };
          return tab.href ? (
            <Link key={tab.id} {...tabProps} href={tab.href}>{tab.label}</Link>
          ) : (
            <button key={tab.id} {...tabProps} type="button" onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
          );
        })}
      </div>

      <div
        id={`${instanceId}-${activeDefinition.id}-panel`}
        role="tabpanel"
        aria-labelledby={`${instanceId}-${activeDefinition.id}-tab`}
      >
        {activeDefinition.render()}
      </div>
    </section>
  );
}
