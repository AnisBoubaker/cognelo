# Link content reference

The shared manifest registers `link` with the link icon, shell creation, external-URL embedding source, `link-content-settings`, and `link-content-presentation`. The application composition root registers its shared/server manifests; the frontend composition registry registers its settings form and presentation resolver.

Resource `title` stores link text (1–180 trimmed characters). Metadata stores `url` (absolute HTTP(S), at most 4,000 characters, no username/password), `description` (optional plain text, at most 2,000 trimmed characters), and `openInNewTab` (boolean, default true). The browser form and server enforce validation; query strings and fragments survive normalization. HTML entered in a description remains text.

Shell creation without a URL stores `setupStatus: "draft"`; its presentation has no href and its server open action is `none`. Saving a valid URL clears the draft status. Partial updates preserve omitted fields; clearing description or setting `openInNewTab` to false is supported. Invalid updates do not mutate the resource. Duplicate retains only the supported source fields under the new resource title.

The optional SDK row-presentation key resolves safe `{ href, target, description }` data through the frontend registry. Teacher course rows, section staff rows, student content, and teacher Student view use it for both title and open-icon navigation. Target is `_blank` by default and `_self` when unchecked; new-tab anchors use `noopener noreferrer`. The server `resolveOpenAction` returns the same URL and target. All authorization and effective folder/section visibility checks remain in the existing content-resource services.

Embedding hooks expose the validated URL and a bounded external-reference document containing title, description, and URL. They do not crawl the target website. The plugin declares no database tables or migrations.
