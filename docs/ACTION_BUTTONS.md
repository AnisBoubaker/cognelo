# Action buttons and icons

All ordinary actions use the compact outlined button style in `apps/web/src/app/globals.css`: white surface, dark text, subtle blue border, 10px corners, 14px text, and no raised shadow or movement on hover. The shared `--button-*` tokens control dimensions, spacing, icons, and interaction colors. The minimum height is 38px, increased to 44px for coarse pointers. Plain buttons and `.button` links share this recipe; legacy `primary` and `secondary` class names do not create competing visual styles.

Destructive actions keep the same shape with red text/border and a red hover tint. Disabled actions retain their label and icon, reduce opacity, and do not acquire hover emphasis. Keyboard focus remains clearly outlined. Login explicitly paints a solid surface and dark text in every state, including disabled, to avoid native Safari/autofill appearance problems.

Tabs, sidebar navigation, accordion rows, menu items, editor keys, and floating status controls have their own semantic layouts. Keep their selection/disclosure states; do not turn a clickable row into an action-button rectangle. Small editor controls may retain their compact dimensions. Ordinary actions within these surfaces still use the shared recipe.

## Semantic icons

`ActionIcon` from `@cognelo/activity-ui` owns the Tabler action-icon registry for core and plugin UI. The web app re-exports it as `AppIcon` from its existing icon layer, which continues to own activity/file-type icons. Pages and plugins must not draw their own interface SVGs or use emoji/text glyphs for common actions.

| Action | Icon name |
| --- | --- |
| Add / Create | `add` |
| Edit | `edit` |
| Save | `save` |
| Cancel / Close | `close` |
| Delete / Remove | `remove` |
| Export / Download | `download` |
| Back / Previous | `back` |
| Next | `next` |
| Retry / Reset / Regrade | `refresh` |
| Generate / AI assessment | `generate` |
| Run / Start | `run` |
| Submit / Send | `submit` |
| Settings | `settings` |

Choose icons explicitly from action semantics, never by inspecting translated labels. A toggle such as Add/Cancel changes its icon together with its label. Preserve visible labels; icon-only controls require a localized accessible label or title. Icons are decorative (`aria-hidden`, non-focusable) and normally 18px with an 8px gap. Shared save bars, confirmations, rich-text toolbars, and plugin controls reuse this registry. Generic confirmation uses a check or danger alert, and informational-dialog dismissal uses Close.

Dialog dismissal is intentionally icon-only: use the shared persistent [dialog header](DIALOGS.md) with a close cross, localized accessible name, and tooltip. Informational alerts use that cross instead of a second labelled Close button. Review navigation and messaging keep visible labels where space allows and use named icons on narrow screens. Decision actions such as Cancel and Save retain their labels.

## Verification

`tests/e2e/action-buttons.spec.ts` checks matching computed appearance and semantic icons across core/admin/plugin actions, disabled and keyboard-focus behavior, actual save/cancel flows, and login legibility. `workspace-layout.spec.ts` covers desktop/mobile page layout, while rich-text and activity regressions exercise toolbar, dialog, and learner controls.
