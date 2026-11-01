# Prepared material embedding services

Material plugins own extraction and embedding preparation/refresh through `ServerContentTypePlugin.indexing`. Consumers call core's `getMaterialIndexStatus` and `prepareMaterialIndex`; core resolves the authorized resource and dispatches to its owning plugin. The plugin supplies its source revision/freshness policy and invokes a core-provided `store` callback after extracting teaching content. No consumer imports another plugin.

The core store uses OpenAI `text-embedding-3-small` with 1536 dimensions, a separate retained embedding connection, bounded 2000-character chunks with overlap, and batches of 32 inputs. The question-generation model is excluded from embedding compatibility. Compatible identical text reuses shared vector records. Changed material produces an immutable index; snapshots retain exact index IDs. Ordinary resource metadata and learner responses contain no extracted source corpus, vectors, or credentials.

Vectors are stored as Float32 bytes in PostgreSQL and searched with bounded exact cosine similarity (at most 10,000 reference chunks per search context; 2,000 per resource). This first delivery does not require changing the PostgreSQL image or installing pgvector. The service boundary permits a later approximate/vector-database implementation. Content indexes are course-scoped and access-checked; shared vector records contain hashes and numeric vectors only. Per-resource leases with heartbeats prevent simultaneous rebuilds; cancellation may leave reusable vectors but cannot publish an incomplete index.

## Owning plugin extraction

- Text: the saved Markdown body.
- File: bounded textual/code files and text-based PDFs. PDFs use Poppler `pdftotext` with bounded input/output/time and private temporary files. Install `poppler-utils` on Ubuntu, or Poppler through the local package manager. Empty, scanned, encrypted or unextractable PDFs fail explicitly; OCR is not performed.
- Link: public HTML, Markdown/plain text and linked PDFs. Reveal.js inline template Markdown and same-origin `data-markdown` files are included without executing JavaScript. The page must expose its teaching text statically. Private internal link summaries are not an indexing source.
- GitHub: public repository root URLs, default-branch content pinned to one commit. Includes common source/text formats, skips symlinks, submodules and generated/dependency directories, and limits extraction to 200 files, 512 KB each, 4 MB total. No checkout or source execution occurs. Public GitHub API rate-limit errors fail visibly and can be retried.

External fetches validate and pin public DNS addresses, reject credentials/private addresses, bound redirects, time, downloaded and decompressed sizes, and never send application cookies. Teacher solution files are independent private activity records and are never automatically embedded as course materials.

GitHub owns `embeddingFreshnessHours`: default 48, configurable from 1 to 8760 per repository in material settings. Freshness measures the last successful check, even when unchanged vectors were reused. Other material types become stale when their saved source changes; a teacher can request an explicit forced refresh through core. Homework checks freshness before enabling submissions and then uses its pinned prepared snapshot. Student generation never refreshes reference materials.
