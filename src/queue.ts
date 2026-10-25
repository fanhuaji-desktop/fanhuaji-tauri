import { type FileEntry, shouldResumeConversion } from "./utils";

/**
 * The file queue and the state of its batch run. The flags only change through
 * begin/stop/end, so how a stopped batch and a single-file Reconvert interact is
 * decided here, not by scattered assignments.
 */
export function createQueue() {
  let files: FileEntry[] = [];
  let converting = false;
  // Set by Stop; the batch loop exits before starting its next file.
  let stopRequested = false;
  // The last batch was stopped: keep the convert button up even with auto-convert on.
  let stopped = false;
  let wasStopped = false;

  return {
    get files(): FileEntry[] {
      return files;
    },
    set files(next: FileEntry[]) {
      files = next;
    },
    get converting(): boolean {
      return converting;
    },
    get stopRequested(): boolean {
      return stopRequested;
    },
    get stopped(): boolean {
      return stopped;
    },

    /** Update one file; a file removed meanwhile stays removed. */
    patch(id: string, patch: Partial<FileEntry>): void {
      files = files.map((f) => (f.id === id ? { ...f, ...patch } : f));
    },

    /**
     * Start a batch over the pending files, or only `only` (Reconvert), and return them;
     * null when a batch is already running or nothing is pending. A single-file batch
     * leaves a stopped queue stopped.
     */
    begin(only?: string): FileEntry[] | null {
      if (converting) return null;
      const pending = files.filter((f) => f.status === "pending" && (!only || f.id === only));
      if (pending.length === 0) return null;
      wasStopped = stopped;
      converting = true;
      if (!only) stopped = false;
      return pending;
    },

    stop(): void {
      stopRequested = true;
    },

    end(only?: string): void {
      converting = false;
      stopped = stopRequested || (only !== undefined && wasStopped);
      stopRequested = false;
    },

    /** Files added mid-batch still wait; a stopped batch leaves them pending on purpose. */
    shouldResume(autoConvert: boolean): boolean {
      return !stopped && shouldResumeConversion(files, autoConvert);
    },
  };
}

export type Queue = ReturnType<typeof createQueue>;
