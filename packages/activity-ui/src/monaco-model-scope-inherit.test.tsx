import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MonacoModelScope, MonacoModelGroup, useMonacoModelStore, type MonacoModelStore } from "./monaco-model-scope";

describe("optional workspace editor ownership", () => {
  it("inherits an existing Test model owner and question group", () => {
    const seen: Array<{ store: MonacoModelStore; group: string }> = [];
    function Probe() { seen.push(useMonacoModelStore()); return null; }
    renderToStaticMarkup(<MonacoModelScope><MonacoModelGroup id="question-a"><Probe />
      <MonacoModelScope inherit><Probe /></MonacoModelScope></MonacoModelGroup></MonacoModelScope>);
    expect(seen[0].store).toBe(seen[1].store);
    expect(seen[0].group).toBe(seen[1].group);
  });
  it("owns standalone files together while leaving default nested scopes independent", () => {
    const owners: MonacoModelStore[] = [];
    function Probe() { owners.push(useMonacoModelStore().store); return null; }
    renderToStaticMarkup(<MonacoModelScope inherit><Probe /><Probe /><MonacoModelScope><Probe /></MonacoModelScope></MonacoModelScope>);
    expect(owners[0]).toBe(owners[1]);
    expect(owners[0]).not.toBe(owners[2]);
  });
});
