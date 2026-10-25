import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAutoConvert, persistOnChange, restoreSetting, STORAGE_KEYS } from "../settings";

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = `
    <select id="naming"><option value="auto">a</option><option value="suffix">s</option></select>
    <textarea id="pre-replace"></textarea>`;
});

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("isAutoConvert", () => {
  it("is on unless turned off", () => {
    expect(isAutoConvert()).toBe(true);
    localStorage.setItem(STORAGE_KEYS.autoConvert, "false");
    expect(isAutoConvert()).toBe(false);
  });
});

describe("restoreSetting", () => {
  it("restores a saved value and ignores a missing one", () => {
    restoreSetting("naming", STORAGE_KEYS.naming);
    expect((document.getElementById("naming") as HTMLSelectElement).value).toBe("auto");
    localStorage.setItem(STORAGE_KEYS.naming, "suffix");
    restoreSetting("naming", STORAGE_KEYS.naming);
    expect((document.getElementById("naming") as HTMLSelectElement).value).toBe("suffix");
    expect(() => restoreSetting("missing", STORAGE_KEYS.naming)).not.toThrow();
  });
});

describe("persistOnChange", () => {
  it("saves a select on change", () => {
    persistOnChange("naming", STORAGE_KEYS.naming);
    const el = document.getElementById("naming") as HTMLSelectElement;
    el.value = "suffix";
    el.dispatchEvent(new Event("change"));
    expect(localStorage.getItem(STORAGE_KEYS.naming)).toBe("suffix");
  });

  it("saves a textarea while typing", () => {
    persistOnChange("pre-replace", STORAGE_KEYS.preReplace);
    const el = document.getElementById("pre-replace") as HTMLTextAreaElement;
    el.value = "a=b";
    el.dispatchEvent(new Event("input"));
    expect(localStorage.getItem(STORAGE_KEYS.preReplace)).toBe("a=b");
  });

  it("ignores a missing element", () => {
    expect(() => persistOnChange("missing", STORAGE_KEYS.naming)).not.toThrow();
  });
});
