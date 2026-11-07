# AI model selection implementation checkpoint

User requested November 2, 2026: choose configured models directly in homework, allow providers beyond OpenAI, and reuse one saved credential across multiple models. Reasonable implementation choices and incremental commits are authorized. Do not deploy or test production; do not expose/copy stored tokens.

The [November 6 shared-reference update](ACTIVITY_MATERIAL_REFERENCES.md) supersedes the original per-homework embedding picker/lock: new preparation uses one course-wide choice, while enabled activities and submitted work retain their pinned model. The generation-model and connection contracts below remain in effect.

## Plan and current state

- Added additive schema fields: connection model catalog (`models` JSON) and prepared-index embedding configuration (`embeddingConfig` JSON). Existing default model/credentials remain intact; empty legacy catalogs retain compatibility defaults.
- Added shared model-purpose/selection contracts. Generation and embedding choices are separate; generation-model changes must not invalidate indexes.
- Implemented core authorized model resolution, account/course overrides, shared picker and connection catalogue editor. Foundation regression tests cover legacy defaults, credential retention/redaction, course/authoring selection, access grants, endpoint pinning and all four text transports.
- Implemented provider-specific embeddings (OpenAI-compatible including Codex and Ollama), pinned index/query model identity, homework selectors and immutable per-submission generation selection. Documentation and integration checks cover both current and legacy paths.
- Local provider-boundary tests cover one token/multiple model requests, Codex/Ollama embeddings, Claude generation, dimension validation, index reuse/invalidation, authorization/secret redaction, rubric authoring and atomic compound grading.
- Completed commits: `251bbb4` shared model catalogues/preferences and `5d1549e` embedding adapters/compatibility. Homework integration and cross-feature regression coverage form the completed final slice.

## Provider evidence

Official OpenAI embeddings API accepts a model identifier and optional dimensions. Ollama exposes `/api/embed` with array inputs and vector arrays. Anthropic documents that it has no native embedding model, so Claude remains available for question generation and needs a separate embedding-capable connection for retrieval.

- https://developers.openai.com/api/reference/resources/embeddings/methods/create
- https://docs.ollama.com/api/embed
- https://platform.claude.com/docs/en/build-with-claude/embeddings

## Assumptions and compatibility

- Model names are entered manually per connection, one per line; no provider discovery or paid verification calls are made merely by saving settings.
- Generation and embedding are separate capabilities. Existing provider types remain supported; no new provider/token format is invented. Claude generation uses another embedding-capable connection for references.
- Old defaults remain valid, including legacy OpenAI embedding configuration. Editing a catalogue does not rewrite the encrypted token. New homework hand-ins retain their selected question model, while prepared references retain their embedding configuration and endpoint.
- Embedding choice is locked while submissions are enabled; next-submission generation choices can change without rebuilding indexes. Material plugins continue to own extraction/refresh via core.

## Validation and handoff

The full unit suite passed (1,800 tests), all workspace typechecks passed, and the production build passed. Fifteen targeted local E2E scenarios passed across AI model configuration, rubric generation, atomic compound/standalone grading, material reuse, homework editor tabs, solution management, PDF viewing, SEB, the 30-student bounded FIFO queue, and the complete hand-in/answering/cancellation workflow. The existing upload test now waits for the disabled-until-loaded file control before setting files. Mobile screenshots were inspected; browser assertions cover the desktop controls as well. Tests use local disposable data and simulated provider endpoints; real credentials, generated clients, screenshots and logs are excluded from Git. No production testing or deployment is authorized by this change.

The root README, architecture, project memory, platform reference, AI/material canonical references, deployment migration notes, homework README/memory/reference and approved workflow/implementation plan were reviewed and updated. Other AI consumers retain their documented core resolver contracts; material-plugin extraction contracts remain unchanged. No documentation verification gap remains.
