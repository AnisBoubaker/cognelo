# Installed Plugin Registry

`@cognelo/plugin-registry` is Cognelo's application composition root. It imports the concrete activity and content-type plugins shipped by this installation and registers their manifests and server contracts with the neutral SDK registries.

Core packages must never depend on this package or on a concrete plugin. The API imports `@cognelo/plugin-registry/server` during Node startup, the web renderer registries import the relevant client composition entry point, and composition scripts import only the entry point they need.

Available entry points:

- `@cognelo/plugin-registry/activity`
- `@cognelo/plugin-registry/activity-server`
- `@cognelo/plugin-registry/content`
- `@cognelo/plugin-registry/content-server`
- `@cognelo/plugin-registry/server`

Add installed plugins here, not in `activity-sdk`, `content-type-sdk`, `core`, or `db`. `npm run architecture:check` enforces the dependency direction.
