# Plugin: Link Content

`@cognelo/plugin-link-content` adds **Link** to the course Material picker. Teachers set the link text, an HTTP(S) URL, an optional plain-text description displayed below the link, and whether it opens in a new tab (enabled by default).

The plugin owns validation, settings, row presentation, open-action resolution, duplication, and the external-URL embedding descriptor. Public data stays in generic `CourseContentResource` rows. Teacher-only internal summaries and their generation preferences are stored separately in the plugin-owned `PluginLinkContentSettings` table. Course placement, section visibility, authorization, and deletion remain core-owned.

The settings form also has an editable **Internal summary**, a **Maximum words** setting defaulting to 100 (1–2,000), and a **Generate with AI** button. Generation checks the current URL for HTTP 200 before calling the teacher’s configured authoring AI agent, reads bounded public HTML/text, and uses the course Subject’s teaching language. A failed main-page check never calls AI; generated text is an unsaved draft until the teacher reviews/edits and saves it. The word cap applies to generation, not manual edits. Students never receive the internal summary or generation settings.

**Follow one level of same domain links** is off by default. When enabled, the server extracts direct links from the main page and summarizes it together with up to 20 linked pages on the same hostname. Linked pages must also pass the public-address and HTTP 200 checks. It never follows links from those pages; unreadable pages and source limits are reported without discarding successful content. The option is saved privately and copied when the material is duplicated.

Apply `npm run db:migrate:all` when upgrading an existing installation; it now applies both activity and content-type plugin manifests. Fresh activation also creates the private summary table.

Activate and enable **Link content** under Settings → Plugins → Content type plugins. Development seeding enables installed content plugins. Existing installations discover new plugins inactive and disabled until an administrator enables them.

See [reference](docs/REFERENCE.md) for persistence, validation, and integration contracts, and [project memory](PROJECT_MEMORY.md) for durable constraints.

Interface actions use the shared [button style and semantic icons](../../../docs/ACTION_BUTTONS.md), including teacher and learner controls.
