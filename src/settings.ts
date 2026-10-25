/** localStorage keys of the persisted settings. */
export const STORAGE_KEYS = {
  converter: "fanhuaji-converter",
  naming: "fanhuaji-naming",
  customSuffix: "fanhuaji-custom-suffix",
  preReplace: "fanhuaji-pre-replace",
  postReplace: "fanhuaji-post-replace",
  protectReplace: "fanhuaji-protect-replace",
  modules: "fanhuaji-modules",
  autoConvert: "fanhuaji-auto-convert",
  saveFolder: "fanhuaji-save-folder",
} as const;

export function isAutoConvert(): boolean {
  return localStorage.getItem(STORAGE_KEYS.autoConvert) !== "false";
}

export function restoreSetting(id: string, key: string) {
  const el = document.getElementById(id) as HTMLSelectElement | HTMLTextAreaElement | null;
  const saved = localStorage.getItem(key);
  if (el && saved) el.value = saved;
}

export function persistOnChange(id: string, key: string) {
  const el = document.getElementById(id) as HTMLSelectElement | HTMLTextAreaElement | null;
  el?.addEventListener("change", () => {
    localStorage.setItem(key, el.value);
  });
  // Textareas also persist on input, so a rule being typed survives closing the app.
  if (el instanceof HTMLTextAreaElement) {
    el.addEventListener("input", () => {
      localStorage.setItem(key, el.value);
    });
  }
}
