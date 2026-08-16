"use client";

import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { activityDefinitionBelongsToCategory, activityDefinitionCreatesCategory, listActivityCategories, type ActivityCategoryId } from "@cognelo/activity-sdk/categories";
import { type ActivityBank, type ActivityDefinition, type ActivityType, type BankActivity } from "@/lib/api";
import { type Locale, useI18n } from "@/lib/i18n";
import { ActivityTypeIcon, AppIcon } from "@/components/app-icon";

type PickerTabId = "activity-banks" | ActivityCategoryId | "material";

export type ExtraActivityPickerChoice = {
  definition: ActivityDefinition;
  onSelect: () => void | Promise<void>;
};

export type ActivityPickerDialogProps = {
  activityTypes: ActivityType[];
  activityDefinitions: ActivityDefinition[];
  activityBanks: ActivityBank[];
  disabled?: boolean;
  excludedBankActivityIds?: ReadonlySet<string>;
  extraLocalChoices?: ExtraActivityPickerChoice[];
  placement?: ReactNode;
  materialPanel?: ReactNode;
  onClose: () => void;
  onSelectActivityType: (activityType: ActivityType) => void | Promise<void>;
  onSelectBankActivity: (activity: BankActivity) => void | Promise<void>;
  title?: string;
  eyebrow?: string;
};

const activityCategories = listActivityCategories();

export function ActivityPickerDialog({
  activityTypes,
  activityDefinitions,
  activityBanks,
  disabled = false,
  excludedBankActivityIds,
  extraLocalChoices = [],
  placement,
  materialPanel,
  onClose,
  onSelectActivityType,
  onSelectBankActivity,
  title,
  eyebrow
}: ActivityPickerDialogProps) {
  const { locale, t } = useI18n();
  const titleId = useId();
  const [selectedTab, setSelectedTab] = useState<PickerTabId>("activity-banks");
  const [selectedBankId, setSelectedBankId] = useState("");
  const pluginActivityTypes = useMemo(
    () => activityTypes.filter((type) => {
      const definition = findDefinition(activityDefinitions, type.key);
      return definition?.provider?.kind !== "core" && (!definition?.creationScopes || definition.creationScopes.includes("course"));
    }),
    [activityDefinitions, activityTypes]
  );

  const visibleCategories = useMemo(
    () => activityCategories.filter((category) =>
      pluginActivityTypes.some((type) => activityDefinitionCreatesCategory(findDefinition(activityDefinitions, type.key), category.id)) ||
      extraLocalChoices.some((choice) => activityDefinitionCreatesCategory(choice.definition, category.id))
    ),
    [activityDefinitions, extraLocalChoices, pluginActivityTypes]
  );

  useEffect(() => {
    setSelectedBankId((current) => activityBanks.some((bank) => bank.id === current) ? current : activityBanks[0]?.id ?? "");
  }, [activityBanks]);

  useEffect(() => {
    if (selectedTab === "activity-banks" || (selectedTab === "material" && materialPanel)) {
      return;
    }
    if (visibleCategories.some((category) => category.id === selectedTab)) {
      return;
    }
    setSelectedTab(visibleCategories[0]?.id ?? "activity-banks");
  }, [materialPanel, selectedTab, visibleCategories]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disabled) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClose]);

  const selectedBank = activityBanks.find((bank) => bank.id === selectedBankId) ?? activityBanks[0];
  const availableBankActivities = (selectedBank?.activities ?? []).filter((activity) =>
    activity.lifecycle === "published" &&
    activity.currentVersionId &&
    activity.currentVersion?.lifecycle === "published" &&
    !excludedBankActivityIds?.has(activity.id)
  );
  const visibleActivityTypes = selectedTab === "activity-banks" || selectedTab === "material"
    ? []
    : pluginActivityTypes.filter((type) => activityDefinitionBelongsToCategory(findDefinition(activityDefinitions, type.key), selectedTab));
  const visibleExtraChoices = selectedTab === "activity-banks" || selectedTab === "material"
    ? []
    : extraLocalChoices.filter((choice) => activityDefinitionBelongsToCategory(choice.definition, selectedTab));

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="dialog-panel activity-picker-dialog" role="dialog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{eyebrow ?? t("courseDetail.chooseActivityEyebrow")}</p>
            <h2 id={titleId}>{title ?? t("courseDetail.chooseActivityTitle")}</h2>
          </div>
          <button className="secondary icon-button" disabled={disabled} onClick={onClose} title={t("common.cancel")} type="button">
            <CloseIcon />
          </button>
        </div>
        <div className="activity-picker-layout">
          <div className="activity-category-tabs" role="tablist" aria-label={t("activityBankDetail.categoryTabsLabel")}>
            <button
              aria-selected={selectedTab === "activity-banks"}
              className={selectedTab === "activity-banks" ? "activity-category-tab is-active" : "activity-category-tab"}
              onClick={() => setSelectedTab("activity-banks")}
              role="tab"
              type="button"
            >
              {t("courseDetail.activityBanksPickerTab")}
            </button>
            {materialPanel ? (
              <button
                aria-selected={selectedTab === "material"}
                className={selectedTab === "material" ? "activity-category-tab is-active" : "activity-category-tab"}
                onClick={() => setSelectedTab("material")}
                role="tab"
                type="button"
              >
                {t("courseDetail.materialPickerTab")}
              </button>
            ) : null}
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                aria-selected={selectedTab === category.id}
                className={selectedTab === category.id ? "activity-category-tab is-active" : "activity-category-tab"}
                onClick={() => setSelectedTab(category.id)}
                role="tab"
                type="button"
              >
                {t(category.labelKey)}
              </button>
            ))}
          </div>
          <div className="activity-type-options" role="tabpanel">
            {placement}
            {selectedTab === "activity-banks" ? (
              <div className="activity-bank-picker-panel">
                <div className="field">
                  <label htmlFor={`${titleId}-bank`}>{t("courseDetail.activityBankPickerLabel")}</label>
                  <select
                    id={`${titleId}-bank`}
                    value={selectedBank?.id ?? ""}
                    onChange={(event) => setSelectedBankId(event.target.value)}
                    disabled={disabled || !activityBanks.length}
                  >
                    {activityBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.title}</option>)}
                  </select>
                </div>
                {availableBankActivities.length ? availableBankActivities.map((activity) => (
                  <button key={activity.id} className="activity-type-option" disabled={disabled} onClick={() => void onSelectBankActivity(activity)} type="button">
                    <ActivityTypeIcon iconName={iconFor(activityDefinitions, activity.activityType.key)} />
                    <span>
                      <strong>{activity.title}</strong>
                      <small>v{activity.currentVersion?.versionNumber ?? 1} · {localizedDefinition(activityDefinitions, activity.activityType.key, locale).name}</small>
                    </span>
                  </button>
                )) : <p className="muted">{t("courseDetail.noAvailableBankActivities")}</p>}
              </div>
            ) : selectedTab === "material" ? materialPanel : (
              <>
                {visibleExtraChoices.map((choice) => {
                  const copy = localizedDefinition(activityDefinitions, choice.definition.key, locale, choice.definition);
                  return (
                    <button key={choice.definition.key} className="activity-type-option" disabled={disabled} onClick={() => void choice.onSelect()} type="button">
                      <ActivityTypeIcon iconName={choice.definition.icon ?? "placeholder"} />
                      <span><strong>{copy.name}</strong><small>{copy.description}</small></span>
                    </button>
                  );
                })}
                {visibleActivityTypes.map((type) => {
                  const copy = localizedDefinition(activityDefinitions, type.key, locale);
                  return (
                    <button key={type.id} className="activity-type-option" disabled={disabled} onClick={() => void onSelectActivityType(type)} type="button">
                      <ActivityTypeIcon iconName={iconFor(activityDefinitions, type.key)} />
                      <span><strong>{copy.name}</strong><small>{copy.description}</small></span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function findDefinition(definitions: ActivityDefinition[], key: string) {
  return definitions.find((definition) => definition.key === key);
}

function localizedDefinition(
  definitions: ActivityDefinition[],
  key: string,
  locale: Locale,
  fallback?: ActivityDefinition
) {
  const definition = findDefinition(definitions, key) ?? fallback;
  const localized = definition?.i18n?.[locale];
  return {
    name: localized?.name ?? definition?.name ?? key,
    description: localized?.description ?? definition?.description ?? ""
  };
}

function iconFor(definitions: ActivityDefinition[], key: string): NonNullable<ActivityDefinition["icon"]> {
  return findDefinition(definitions, key)?.icon ?? "placeholder";
}

function CloseIcon() {
  return <AppIcon name="close" />;
}
