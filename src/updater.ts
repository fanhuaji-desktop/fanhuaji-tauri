import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { confirmDialog } from "./dialog";
import { t } from "./i18n/i18n";

function setUpdateStatus(msg: string) {
  const el = document.getElementById("update-status");
  if (el) el.textContent = msg;
}

async function isPortableBuild(): Promise<boolean> {
  try {
    return await invoke<boolean>("is_portable");
  } catch {
    return false;
  }
}

/** What an update restart would interrupt or throw away, supplied by the app. */
export interface UpdateRisk {
  converting: boolean;
  undoable: number;
}

interface UpdaterOptions {
  getRisk?: () => UpdateRisk;
  /** Called when the startup check finds an update; the app shows its own cue. */
  onAvailable?: (version: string) => void;
}

let options: UpdaterOptions = {};
let pendingUpdate: Update | null = null;

function confirmUpdate(update: Update, risk: UpdateRisk): Promise<boolean> {
  const warning = risk.converting
    ? t("update.busy")
    : risk.undoable
      ? t("update.undoWarning", { count: String(risk.undoable) })
      : "";
  return confirmDialog({
    title: t("update.found", { version: update.version }),
    body: t("update.prompt"),
    warning,
    notes: update.body,
    confirmLabel: t("update.install"),
    cancelLabel: t("update.later"),
    blocked: risk.converting,
  });
}

const noRisk: UpdateRisk = { converting: false, undoable: 0 };

/** Resolves once no batch is running, polling while one is. */
async function waitForIdle(): Promise<void> {
  if (!options.getRisk?.().converting) return;
  setUpdateStatus(t("update.waiting"));
  while (options.getRisk?.().converting) await new Promise((r) => setTimeout(r, 500));
  setUpdateStatus(t("update.restarting"));
}

/**
 * Ask, then download, install and relaunch. A running batch blocks the restart. The
 * download takes a while, so the risk is checked again before installing: a batch started
 * meanwhile is waited out, and newly overwritten files are confirmed again. Download and
 * install are separate because installing on Windows quits the app right away.
 */
async function promptInstall(update: Update): Promise<void> {
  const risk = options.getRisk?.() ?? noRisk;
  if (!(await confirmUpdate(update, risk))) return;

  setUpdateStatus(t("update.downloading"));
  await update.download((event) => {
    if (event.event === "Finished") {
      setUpdateStatus(t("update.restarting"));
    }
  });
  let warned = risk.undoable;
  for (;;) {
    await waitForIdle();
    const now = options.getRisk?.() ?? noRisk;
    if (now.undoable <= warned) break;
    if (!(await confirmUpdate(update, now))) return;
    warned = now.undoable;
  }
  // shortcut: a batch started during install() itself (about a second) is still cut off by
  // the relaunch; block convertPending while installing if that ever shows up.
  await update.install();
  await relaunch();
}

/** Open the install prompt for the update the startup check found. */
export async function installPendingUpdate(): Promise<void> {
  if (!pendingUpdate) return;
  try {
    await promptInstall(pendingUpdate);
  } catch (err) {
    setUpdateStatus(t("update.failed", { error: String(err) }));
  }
}

export async function checkForUpdates(silent = false): Promise<void> {
  if (!silent) setUpdateStatus(t("update.checking"));

  try {
    const update = await check();
    if (!update) {
      setUpdateStatus(silent ? "" : t("update.upToDate"));
      return;
    }

    // Portable Windows builds cannot self-update in place (the updater would
    // run an installer that installs a separate copy), so only notify the user.
    if (await isPortableBuild()) {
      setUpdateStatus(t("update.portableAvailable", { version: update.version }));
      return;
    }

    setUpdateStatus(t("update.found", { version: update.version }));
    // The startup check never opens a modal over the user's work; it leaves a cue.
    if (silent) {
      pendingUpdate = update;
      options.onAvailable?.(update.version);
      return;
    }
    await promptInstall(update);
  } catch (err) {
    if (!silent) {
      setUpdateStatus(t("update.failed", { error: String(err) }));
    }
    // Update check failed — status already shown in UI if not silent
  }
}

export function initUpdater(opts: UpdaterOptions = {}) {
  options = opts;
  const btn = document.getElementById("btn-check-update");
  btn?.addEventListener("click", () => checkForUpdates(false));

  // Silent check on startup
  void checkForUpdates(true);
}
