/**
 * Synchronisation automatique (shared/spec/vault-sync.md) : l'ordonnanceur
 * seul, puis le motif d'échec montré à l'écran.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncScheduler } from "@/syncScheduler";
import { syncFailureCode } from "@/autoSync";
import { SyncError } from "@/sync";

/** Promesse résolue à la main : une synchronisation qui dure. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("ordonnanceur de synchronisation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function scheduler(options: Partial<Parameters<typeof createSyncScheduler<string>>[0]> = {}) {
    const run = vi.fn(async () => "fait");
    const onResult = vi.fn();
    const s = createSyncScheduler<string>({ run, onResult, ...options });
    return { s, run: (options.run as typeof run) ?? run, onResult };
  }

  it("attend 2 s de calme et fusionne les déclencheurs rapprochés", async () => {
    const { s, run } = scheduler();

    s.trigger();
    await vi.advanceTimersByTimeAsync(1500);
    s.trigger();
    await vi.advanceTimersByTimeAsync(1500);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("ne double jamais une synchronisation en cours et n'en relance qu'une", async () => {
    const gate = deferred<string>();
    const run = vi.fn(async () => "fait");
    run.mockImplementationOnce(() => gate.promise);
    const { s } = scheduler({ run });

    s.trigger();
    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(1);

    s.trigger();
    await vi.advanceTimersByTimeAsync(2000);
    s.trigger();
    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(1);

    gate.resolve("fait");
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("espace les ouvertures de 30 s", async () => {
    const { s, run } = scheduler();

    expect(s.triggerOpen()).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.triggerOpen()).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(26000);
    expect(s.triggerOpen()).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("ne lance rien sans session ou sans clef", async () => {
    const { s, run, onResult } = scheduler({ canSync: () => false });

    s.trigger();
    await vi.advanceTimersByTimeAsync(2000);

    expect(run).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(await s.runNow()).toStrictEqual({ skipped: true });
  });

  it("rend un échec comme résultat, sans le lever", async () => {
    const failure = new SyncError("Service injoignable : coupure");
    const { s, onResult } = scheduler({
      run: vi.fn(async () => {
        throw failure;
      }),
    });

    s.trigger();
    await vi.advanceTimersByTimeAsync(2000);

    expect(onResult).toHaveBeenCalledWith({ ok: false, error: failure });
  });

  it("synchronise tout de suite sur demande, après celle en cours", async () => {
    const gate = deferred<string>();
    const run = vi.fn(async () => "à jour");
    run.mockImplementationOnce(() => gate.promise);
    const { s } = scheduler({ run });

    s.trigger();
    await vi.advanceTimersByTimeAsync(2000);
    s.trigger();
    const now = s.runNow();
    expect(s.pending).toBe(false);

    gate.resolve("fait");
    expect(await now).toStrictEqual({ ok: true, value: "à jour" });
    await vi.advanceTimersByTimeAsync(10000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("oublie ce qui attend sur demande", async () => {
    const { s, run } = scheduler();
    s.trigger();
    s.cancel();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("motif d'échec", () => {
  it("se réduit à ce que la page sait traduire", () => {
    expect(syncFailureCode(new SyncError("Service injoignable : coupure"))).toBe("network");
    expect(syncFailureCode(new SyncError("401 : expired", 401))).toBe("auth");
    expect(syncFailureCode(new SyncError("402 : plan", 402))).toBe("plan");
    expect(syncFailureCode(new SyncError("403 : devices", 403))).toBe("forbidden");
    expect(syncFailureCode(new SyncError("500 : boom", 500))).toBe("other");
    expect(syncFailureCode(new Error("autre"))).toBe("other");
  });
});
