# Text Content Plugin Memory

- Plugin key: `text-content`.
- Content type key: `text`.
- Body content is stored in generic resource metadata as `{ body, format: "markdown" }`.
- The server plugin implements `getEmbeddingDocuments` and returns the Markdown body as a generic extracted document. Activity plugins should consume this through core dispatchers, not by reading text metadata directly.
- The server plugin implements `indexEmbeddingDocuments` and `searchEmbeddingDocuments`. The current dev index is stored in resource metadata under `embeddingIndex`; future pgvector/plugin-owned table storage should stay behind those handlers.
- No plugin-owned table is used yet; revisions/rendered variants can add plugin-owned persistence later.
- The server `duplicate` handler copies text metadata but removes `embeddingIndex` so a copied resource rebuilds derived search state under its own ID.
