import { describe, expect, it, vi } from "vitest";
import type { editor } from "monaco-editor";
import { MonacoModelStore } from "./monaco-model-scope";

describe("ephemeral editor model ownership", () => {
  it("separates questions, files, and later editing sessions", () => {
    const first = new MonacoModelStore();
    const later = new MonacoModelStore();
    expect(first.path("question-a", "code")).toBe(first.path("question-a", "code"));
    expect(first.path("question-a", "code")).not.toBe(first.path("question-b", "code"));
    expect(first.path("question-a", "index.html")).not.toBe(first.path("question-a", "style.css"));
    expect(first.path("question-a", "code")).not.toBe(later.path("question-a", "code"));
    expect(first.path("a/b", "c")).not.toBe(first.path("a", "b/c"));
  });

  it("disposes every retained model after the owner unmounts", async () => {
    const store = new MonacoModelStore();
    const first = { dispose: vi.fn(), isDisposed: () => false };
    const second = { dispose: vi.fn(), isDisposed: () => false };
    store.remember(first as unknown as editor.ITextModel);
    store.remember(second as unknown as editor.ITextModel);
    store.release(store.retain());
    expect(first.dispose).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).toHaveBeenCalledOnce();
  });

  it("does not dispose a reactivated Strict Mode owner", async () => {
    const store = new MonacoModelStore();
    const model = { dispose: vi.fn(), isDisposed: () => false };
    store.remember(model as unknown as editor.ITextModel);
    store.release(store.retain());
    const active = store.retain();
    await Promise.resolve();
    expect(model.dispose).not.toHaveBeenCalled();
    store.release(active);
    await Promise.resolve();
    expect(model.dispose).toHaveBeenCalledOnce();
  });
});
