# Link Content Plugin Memory

- Plugin key: `link-content`; content type key: `link`.
- Link text is the resource title. Metadata owns `url`, `description`, and `openInNewTab`; the latter defaults to true and must preserve an explicit false.
- Accept only absolute HTTP(S) URLs without embedded credentials. Preserve query strings and fragments. Opening a URL is a browser action; the server never fetches arbitrary link targets.
- New picker shells may lack a URL and resolve to no action until configured. The settings form requires a URL; explicitly blank or unsafe URLs are rejected by server updates.
- Row presentation and server open actions use the same validated metadata projection. Descriptions are plain text, rendered by the host as text rather than HTML.
- Duplicate copies URL, description, and target independently; it never copies derived embedding indexes.
- Host pages dispatch through the presentation/settings registries. Do not introduce concrete link-type branches into course pages or core.
