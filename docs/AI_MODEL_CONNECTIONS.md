# AI connections and model selection

A connection stores one provider, endpoint, encrypted credential, default model, and a catalogue of model names with `generation` or `embedding` purpose. Configure it in **Settings → AI agents**. Additional model names are entered one per line; they share the saved token. Editing model names with the token field blank preserves the existing encrypted credential. Public responses contain only names, configuration and a `hasApiKey` flag.

Existing connections and API clients remain compatible: `model` is still the default; an empty legacy `models` catalogue resolves that generation model. Legacy OpenAI/Codex connections additionally offer `text-embedding-3-small`. Explicit catalogues determine the choices thereafter. Configure only models supported by the endpoint and credential; model names are not discovered remotely.

## Consumers

| Consumer | Selection |
| --- | --- |
| Activity generation, variations, reference solutions, tests, rubrics, knowledge suggestions, subject graphs, link summaries | Account question-authoring connection plus optional `questionAuthoringModel` |
| Course student support | `studentSupportAiAgentConnectionId` plus optional `studentSupportAiAgentModel` |
| Automatic formative/summative feedback and AI grading | Dedicated course `assessmentFeedbackAiAgentConnectionId` plus optional `assessmentFeedbackAiAgentModel`, gated by `automaticFeedbackEnabled` |
| Homework challenge generation and required-function AI selection | Explicit homework generation choice, otherwise the course staff authoring preference |
| Prepared material indexes and semantic queries | Separate embedding connection/model, frozen with the prepared reference snapshot |

The account and course screens use separate connection and model selectors. Omitted model overrides retain the connection default. Core resolvers return a connection with its effective model, so consumers retain the same provider transport and credential handling. Personal selection remains limited to one's own or shared enabled connections. No connection secret is copied into preferences, activity configuration, snapshots, browser responses, or audit events.

## Providers

OpenAI and Codex connections use the OpenAI-compatible Responses and embeddings endpoints. Ollama uses `/api/chat` and `/api/embed`, including an optional saved bearer token. Claude uses its Messages endpoint for generation; Anthropic has no native embedding model, so indexing requires a separate embedding-capable connection. A custom compatible endpoint must expose the requested API and model.

Prepared embedding identity includes protocol, normalized endpoint, embedding model and dimensions, excluding the question-generation model and credential. Changing a generation choice does not invalidate indexes. Endpoint changes cannot silently redirect frozen work. Removing or disabling a connection can block outstanding work; historical snapshots can retain a removed catalogue model name while continuing to enforce credential access and endpoint identity.

See [material services](MATERIAL_EMBEDDING_SERVICES.md) and the [homework workflow](CODING_HOMEWORK_SUBMISSION_WORKFLOW.md) for indexing and submission invariants.

## Migration

`202611020001_ai_connection_models` adds default-empty JSON fields `AiAgentConnection.models` and `ContentMaterialIndex.embeddingConfig`. Run `npm run db:migrate:all` and regenerate clients with the normal upgrade procedure. Existing default models, encrypted credentials, preference IDs and prepared indexes are preserved; no new environment variable is required.
