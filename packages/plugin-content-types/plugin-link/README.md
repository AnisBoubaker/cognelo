# Plugin: Link Content

`@cognelo/plugin-link-content` adds **Link** to the course Material picker. Teachers set the link text, an HTTP(S) URL, an optional plain-text description displayed below the link, and whether it opens in a new tab (enabled by default).

The plugin owns validation, settings, row presentation, open-action resolution, duplication, and the external-URL embedding descriptor. Data stays in generic `CourseContentResource` rows; no private tables or database migrations are needed. Course placement, section visibility, authorization, and deletion remain core-owned.

Activate and enable **Link content** under Settings → Plugins → Content type plugins. Development seeding enables installed content plugins. Existing installations discover new plugins inactive and disabled until an administrator enables them.

See [reference](docs/REFERENCE.md) for persistence, validation, and integration contracts, and [project memory](PROJECT_MEMORY.md) for durable constraints.
