import { describe, expect, it } from "vitest";
import { acquireBodyScrollLock } from "./body-scroll-lock";

describe("body scroll locks", () => {
  it.each([false, true])("restores scrolling when overlapping dialogs close in either order (inner first: %s)", (innerFirst) => {
    const body = { style: { overflow: "" } } as HTMLElement;
    const releasePicker = acquireBodyScrollLock(body);
    const releaseProgress = acquireBodyScrollLock(body);
    const [first, last] = innerFirst ? [releaseProgress, releasePicker] : [releasePicker, releaseProgress];
    first();
    expect(body.style.overflow).toBe("hidden");
    last();
    expect(body.style.overflow).toBe("");
  });

  it("preserves pre-existing overflow and makes cleanup idempotent across later dialogs", () => {
    const body = { style: { overflow: "auto" } } as HTMLElement;
    const releaseFirst = acquireBodyScrollLock(body);
    const releaseSecond = acquireBodyScrollLock(body);
    releaseFirst();
    releaseFirst();
    expect(body.style.overflow).toBe("hidden");
    releaseSecond();
    expect(body.style.overflow).toBe("auto");
    const releaseNext = acquireBodyScrollLock(body);
    releaseSecond();
    expect(body.style.overflow).toBe("hidden");
    releaseNext();
    expect(body.style.overflow).toBe("auto");
  });

  it("keeps separate documents independent", () => {
    const firstBody = { style: { overflow: "scroll" } } as HTMLElement;
    const secondBody = { style: { overflow: "hidden" } } as HTMLElement;
    const releaseFirst = acquireBodyScrollLock(firstBody);
    const releaseSecond = acquireBodyScrollLock(secondBody);
    releaseFirst();
    expect(firstBody.style.overflow).toBe("scroll");
    expect(secondBody.style.overflow).toBe("hidden");
    releaseSecond();
    expect(secondBody.style.overflow).toBe("hidden");
  });
});
