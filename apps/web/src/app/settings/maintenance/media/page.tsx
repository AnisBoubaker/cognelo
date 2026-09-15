"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmationDialog, useNotifications } from "@cognelo/activity-ui";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MaintenanceNav } from "@/components/maintenance-nav";
import { api, type MediaGarbageCollectionResult, type MediaMaintenanceOverview } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function MediaMaintenancePage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const [overview, setOverview] = useState<MediaMaintenanceOverview | null>(null);
  const [lastCleanup, setLastCleanup] = useState<MediaGarbageCollectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [confirmingCleanup, setConfirmingCleanup] = useState(false);
  const [error, setError] = useState("");
  const isAdmin = user?.roles.includes("admin") ?? false;

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.mediaMaintenanceOverview();
      setOverview(result.overview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("settings.maintenanceMediaLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAdmin) void loadOverview();
    else setLoading(false);
  }, [isAdmin, loadOverview]);

  async function runCleanup() {
    setCleaning(true);
    setError("");
    try {
      const result = await api.runMediaMaintenance();
      setLastCleanup(result.cleanup);
      setOverview(result.overview);
      setConfirmingCleanup(false);
      notifications.success(t("settings.maintenanceMediaCleanupComplete", {
        assets: result.cleanup.removedAssets,
        blobs: result.cleanup.trashedBlobs
      }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("settings.maintenanceMediaCleanupError");
      setError(message);
      notifications.error(message);
    } finally {
      setCleaning(false);
    }
  }

  const number = new Intl.NumberFormat(locale);

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{t("settings.maintenanceEyebrow")}</p>
            <h1>{t("settings.maintenanceTitle")}</h1>
            <p className="muted">{t("settings.maintenanceSubtitle")}</p>
          </div>
        </section>

        <div className="settings-layout">
          <MaintenanceNav />
          <section className="section stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("settings.maintenanceMediaEyebrow")}</p>
                <h2>{t("settings.maintenanceMediaTitle")}</h2>
                <p className="muted">{t("settings.maintenanceMediaText")}</p>
              </div>
              {isAdmin ? (
                <button className="secondary" disabled={loading || cleaning} type="button" onClick={() => void loadOverview()}>
                  {loading ? t("common.loading") : t("settings.maintenanceRefresh")}
                </button>
              ) : null}
            </div>

            {!isAdmin ? <p className="muted">{t("settings.maintenanceAdminOnly")}</p> : null}
            {error ? <p className="error" role="alert">{error}</p> : null}
            {isAdmin && loading && !overview ? <p className="muted">{t("common.loading")}</p> : null}

            {isAdmin && overview ? (
              <>
                <div className="maintenance-metric-grid">
                  <MaintenanceMetric label={t("settings.maintenanceStoredBytes")} value={formatBytes(overview.storedBytes, locale)} />
                  <MaintenanceMetric label={t("settings.maintenanceBlobs")} value={number.format(overview.blobCount)} help={t("settings.maintenanceBlobsHelp")} />
                  <MaintenanceMetric label={t("settings.maintenanceAssets")} value={number.format(overview.assetCount)} help={t("settings.maintenanceAssetsHelp", { active: overview.activeAssetCount, staged: overview.stagedAssetCount })} />
                  <MaintenanceMetric label={t("settings.maintenanceReferences")} value={number.format(overview.referenceCount)} help={t("settings.maintenanceReferencesHelp")} />
                </div>

                <article className="card maintenance-card stack">
                  <div className="section-heading">
                    <div>
                      <h3>{t("settings.maintenanceCleanupPreview")}</h3>
                      <p className="muted">{t("settings.maintenanceCleanupPreviewText")}</p>
                    </div>
                    <button
                      className="danger"
                      disabled={cleaning || overview.garbagePreview.candidateAssets === 0
                        && overview.garbagePreview.trashDirectories === 0
                        && overview.garbagePreview.staleStagingDirectories === 0
                        && overview.garbagePreview.newlyUnreferenced === 0}
                      type="button"
                      onClick={() => setConfirmingCleanup(true)}
                    >
                      {t("settings.maintenanceRunCleanup")}
                    </button>
                  </div>
                  <dl className="maintenance-detail-grid">
                    <MaintenanceDetail label={t("settings.maintenanceExpiredStaged")} value={overview.garbagePreview.expiredStagedAssets} />
                    <MaintenanceDetail label={t("settings.maintenanceEligibleActive")} value={overview.garbagePreview.eligibleActiveAssets} />
                    <MaintenanceDetail label={t("settings.maintenanceUnreferencedActive")} value={overview.unreferencedActiveAssetCount} />
                    <MaintenanceDetail label={t("settings.maintenanceNewOrphans")} value={overview.garbagePreview.newlyUnreferenced} />
                    <MaintenanceDetail label={t("settings.maintenanceTrashDirectories")} value={overview.garbagePreview.trashDirectories} />
                    <MaintenanceDetail label={t("settings.maintenanceStagingDirectories")} value={overview.garbagePreview.staleStagingDirectories} />
                  </dl>
                  <p className="maintenance-storage-path">
                    <span>{t("settings.maintenanceStorageRoot")}</span>
                    <code>{overview.storageRoot}</code>
                  </p>
                </article>

                <article className="card maintenance-card stack">
                  <h3>{t("settings.maintenanceRetentionTitle")}</h3>
                  <ul className="maintenance-policy-list">
                    <li>{t("settings.maintenanceStagedPolicy", { hours: overview.policy.stagedUploadHours })}</li>
                    <li>{t("settings.maintenanceGracePolicy", { days: overview.policy.activeGraceDays })}</li>
                    <li>{t("settings.maintenanceTrashPolicy", { days: overview.policy.trashRetentionDays })}</li>
                    <li>{t("settings.maintenanceStagingDirectoryPolicy", { days: overview.policy.stagingDirectoryRetentionDays })}</li>
                    <li>{t("settings.maintenanceMaximumPolicy", { size: formatBytes(overview.policy.maximumImageBytes, locale) })}</li>
                  </ul>
                </article>

                {lastCleanup ? (
                  <p className="notice" role="status">
                    {t("settings.maintenanceLastCleanup", {
                      assets: lastCleanup.removedAssets,
                      blobs: lastCleanup.trashedBlobs,
                      trash: lastCleanup.purgedTrashDirectories,
                      staging: lastCleanup.purgedStagingDirectories
                    })}
                  </p>
                ) : null}
              </>
            ) : null}
          </section>
        </div>

        <ConfirmationDialog
          open={confirmingCleanup}
          eyebrow={t("settings.maintenanceMediaEyebrow")}
          title={t("settings.maintenanceCleanupConfirmTitle")}
          message={t("settings.maintenanceCleanupConfirmText", {
            candidates: overview?.garbagePreview.candidateAssets ?? 0,
            orphans: overview?.garbagePreview.newlyUnreferenced ?? 0,
            grace: overview?.policy.activeGraceDays ?? 30,
            trash: overview?.policy.trashRetentionDays ?? 7
          })}
          confirmLabel={cleaning ? t("settings.maintenanceCleaning") : t("settings.maintenanceCleanupConfirm")}
          cancelLabel={t("common.cancel")}
          confirmVariant="danger"
          isConfirming={cleaning}
          onCancel={() => setConfirmingCleanup(false)}
          onConfirm={runCleanup}
        />
      </main>
    </AppShell>
  );
}

function MaintenanceMetric({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <article className="card card-compact maintenance-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {help ? <small className="muted">{help}</small> : null}
    </article>
  );
}

function MaintenanceDetail({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number, locale: string) {
  if (bytes < 1024) return `${new Intl.NumberFormat(locale).format(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}
