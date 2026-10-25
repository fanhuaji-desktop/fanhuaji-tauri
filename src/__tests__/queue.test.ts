import { describe, expect, it } from "vitest";
import { createQueue } from "../queue";
import type { FileEntry } from "../utils";

const file = (id: string, status: FileEntry["status"] = "pending"): FileEntry => ({
  id,
  inputPath: "/tmp",
  inputName: `${id}.srt`,
  status,
  outputName: "",
  outputPath: "",
});

describe("queue batches", () => {
  it("runs the pending files and refuses a second batch meanwhile", () => {
    const q = createQueue();
    q.files = [file("a"), file("b", "success"), file("c")];
    expect(q.begin()?.map((f) => f.id)).toEqual(["a", "c"]);
    expect(q.converting).toBe(true);
    expect(q.begin()).toBeNull();
    q.end();
    expect(q.converting).toBe(false);
  });

  it("returns null when nothing is pending", () => {
    const q = createQueue();
    q.files = [file("a", "success")];
    expect(q.begin()).toBeNull();
    expect(q.converting).toBe(false);
  });

  it("does not resume a stopped batch", () => {
    const q = createQueue();
    q.files = [file("a"), file("b")];
    q.begin();
    q.stop();
    q.end();
    expect(q.stopped).toBe(true);
    expect(q.stopRequested).toBe(false);
    expect(q.shouldResume(true)).toBe(false);
  });

  it("keeps a stopped queue stopped after reconverting one file", () => {
    const q = createQueue();
    q.files = [file("a"), file("b")];
    q.begin();
    q.stop();
    q.end();
    expect(q.begin("a")?.map((f) => f.id)).toEqual(["a"]);
    q.end("a");
    expect(q.stopped).toBe(true);
    expect(q.shouldResume(true)).toBe(false);
  });

  it("picks up files added mid-batch when auto-convert is on", () => {
    const q = createQueue();
    q.files = [file("a")];
    q.begin();
    q.patch("a", { status: "success" });
    q.files = [...q.files, file("b")];
    q.end();
    expect(q.shouldResume(true)).toBe(true);
    expect(q.shouldResume(false)).toBe(false);
  });

  it("a full batch clears the stopped state", () => {
    const q = createQueue();
    q.files = [file("a"), file("b")];
    q.begin();
    q.stop();
    q.end();
    q.begin();
    q.end();
    expect(q.stopped).toBe(false);
  });

  it("patches only the matching file", () => {
    const q = createQueue();
    q.files = [file("a"), file("b")];
    q.patch("b", { status: "error", error: "X" });
    expect(q.files.map((f) => f.status)).toEqual(["pending", "error"]);
    q.patch("gone", { status: "success" });
    expect(q.files.map((f) => f.status)).toEqual(["pending", "error"]);
  });
});
