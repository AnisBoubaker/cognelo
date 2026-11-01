import { describe, expect, it } from "vitest";
import { chunkMaterialDocuments, encodeVector, decodeVector, vectorCosine, contentIndexRevision } from "./material-embeddings";
describe("prepared semantic material indexes", () => {
  it("chunks the entire text with overlap and preserves source provenance", () => {
    const chunks = chunkMaterialDocuments([{ id: "chapter", sourceId: "material", title: "Pointers", text: "a".repeat(5000), kind: "plain_text" }]);
    expect(chunks.map(chunk => chunk.text.length)).toEqual([2000, 2000, 1320]);
    expect(chunks.every(chunk => chunk.sourceId === "material")).toBe(true);
    expect(new Set(chunks.map(chunk => chunk.id)).size).toBe(3);
  });
  it("stores finite float vectors and ranks semantic similarity using cosine", () => {
    const values = decodeVector(encodeVector([1, 0, 0]));
    expect(vectorCosine(values, [5, 0, 0])).toBe(1);
    expect(vectorCosine(values, [0, 1, 0])).toBe(0);
    expect(vectorCosine(values, [-1, 0, 0])).toBe(-1);
    expect(contentIndexRevision({ text: "unchanged" })).toBe(contentIndexRevision({ text: "unchanged" }));
    expect(contentIndexRevision({ text: "changed" })).not.toBe(contentIndexRevision({ text: "unchanged" }));
  });
});
