/** Scoped General settings rows; every surface follows the host palette. */
export const settingsCSS = `
.dsx-settings-row { padding: 20px 0; border-bottom: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); font-family: inherit; }
.dsx-settings-title { margin: 0 0 12px; font-size: 14px; font-weight: 500; }
.dsx-theme-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.dsx-theme-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 6px; border: 1px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md, 10px); color: inherit; background: var(--dsw-alias-bg-layer-1); font: inherit; font-size: 13px; cursor: pointer; }
.dsx-theme-card:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsx-theme-card[aria-pressed="true"] { outline: 2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color); outline-offset: -2px; }
.dsx-theme-swatch { width: 52px; height: 28px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l4); }
.dsx-font-control { display: flex; gap: 16px; justify-content: space-between; align-items: center; flex-wrap: wrap; }
.dsx-font-control .dsx-settings-title { margin: 0; }
.dsx-font-select, .dsx-custom-input { box-sizing: border-box; min-height: 34px; max-width: 100%; padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-sm, 6px); background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; font-size: 13px; }
.dsx-font-select { width: 230px; }
.dsx-custom-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
.dsx-custom-input { flex: 1; min-width: 160px; }
.dsx-settings-button { min-height: 34px; padding: 6px 12px; border: 1px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-sm, 6px); color: inherit; background: var(--dsw-alias-bg-layer-1); font: inherit; font-size: 13px; cursor: pointer; }
.dsx-settings-button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsx-settings-button:disabled { opacity: .6; cursor: default; }
.dsx-settings-row :is(button, select, input, summary):focus-visible { outline: 2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color); outline-offset: 3px; }
.dsx-settings-note { color: var(--dsw-alias-label-secondary); font-size: 12px; margin: 8px 0 0; }
.dsx-settings-error { color: var(--dsw-alias-label-primary); font-size: 12px; margin: 8px 0 0; }
.dsx-log-summary { cursor: pointer; font-size: 13px; }
.dsx-log-content { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
`

/** DSH 0.2.0-rc.2 shell classes; conversation uses public data attributes where available.
 * Theme-scoped islands stay inside host grid tracks so drag coordinates remain host-owned.
 */
export const decorationCSS = `
body[data-dsx-surface-theme] {
  background-image: var(--dsh-appearance-canvas-image);
  background-attachment: fixed;
  background-repeat: no-repeat;
}
body[data-dsx-surface-theme] :is(.BynINW_frame, .BynINW_centerCol, .Dc7zOa_root, [data-conversation-content]) {
  background-image: var(--dsh-appearance-canvas-image);
}
body[data-dsx-surface-theme] :is(.BynINW_sidebarCol, ._2H3hWW_root) {
  background-image: var(--dsh-appearance-sidebar-image);
}
body[data-dsx-surface-theme] .dsx-theme-card[aria-pressed="true"] {
  background-image: var(--dsh-appearance-canvas-image);
}
@media (forced-colors: active) {
  body[data-dsx-surface-theme],
  body[data-dsx-surface-theme] :is(.BynINW_frame, .BynINW_centerCol, .Dc7zOa_root, [data-conversation-content], .BynINW_sidebarCol, ._2H3hWW_root, .dsx-theme-card) {
    background-image: none;
  }
}
/* Floating surfaces are scoped to the plugin's three custom themes. No frame
 * padding/grid gap: the host's inline tracks and absolute resize handles agree.
 * Avoid transforms/backdrop-filter on columns: they contain fixed-position UI. */
body[data-dsh-appearance-layout="island"] {
  --dsh-appearance-island-radius: 24px;
  --dsh-appearance-island-shadow: 0 6px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
  --dsh-appearance-card-shadow: 0 2px 8px color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);
}
body[data-dsh-appearance-layout="island"] .BynINW_frame > :is(.BynINW_sidebarCol, .BynINW_centerCol) {
  box-sizing: border-box;
  min-height: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsh-appearance-island-radius);
  box-shadow: var(--dsh-appearance-island-shadow);
}
body[data-dsh-appearance-layout="island"] .BynINW_frame > .BynINW_sidebarCol { margin: 10px 5px 10px 10px; }
body[data-dsh-appearance-layout="island"] .BynINW_frame > .BynINW_centerCol {
  margin: 10px 10px 10px 5px;
  background-color: var(--dsw-alias-bg-layer-1);
}
body[data-dsh-appearance-layout="island"][data-dsx-surface-theme] .BynINW_frame > .BynINW_centerCol {
  background-image: linear-gradient(color-mix(in srgb, var(--dsw-alias-bg-layer-1) 82%, transparent), color-mix(in srgb, var(--dsw-alias-bg-layer-1) 82%, transparent)), var(--dsh-appearance-canvas-image);
}
body[data-dsh-appearance-layout="island"] :is(.BynINW_sidebarCol > ._2H3hWW_root, .BynINW_centerCol .Dc7zOa_root, .BynINW_centerCol [data-conversation-content]) {
  background-color: transparent;
  background-image: none;
}
/* SidebarRoot carries an inline pixel width for the original track. Clamp it
 * to the inset column so buttons, rows and the scrollbar retain host padding. */
body[data-dsh-appearance-layout="island"] .BynINW_sidebarCol > ._2H3hWW_root {
  max-width: 100%;
  min-width: 0;
}
/* The right column may have zero width. Inset the anchored panel itself, keeping
 * its inline width, slide transform and resize track under host control. Do not
 * clip the wrapper: detached panes and drag targets can extend outside it. */
body[data-dsh-appearance-layout="island"] [data-sidebar-right-panel] {
  box-sizing: border-box;
  padding: 10px 10px 10px 5px;
}
body[data-dsh-appearance-layout="island"] [data-sidebar-right-panel] [data-dockkit-empty] {
  background: transparent;
}
body[data-dsh-appearance-layout="island"] [data-rightbar-col] [data-sidebar-right-panel] :is([data-dockkit-host="dock"], [data-dockkit-empty]) > [data-dockkit-pane] {
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsh-appearance-island-radius);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsh-appearance-island-shadow);
}
/* Windows collapses the sidebar track to zero and moves its controls into the
 * titlebar. Margins/borders would otherwise leave a phantom sidebar surface. */
html[data-windows-titlebar] body[data-dsh-appearance-layout="island"] .BynINW_frame[data-sidebar-collapsed] > .BynINW_sidebarCol {
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: none;
}
body[data-dsh-appearance-layout="island"] ._2H3hWW_root:not(._2H3hWW_collapsed) ._2H3hWW_newSession {
  border-radius: 14px;
  box-shadow: var(--dsh-appearance-card-shadow);
}
body[data-dsh-appearance-layout="island"] [data-composer-card] {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsh-appearance-island-radius);
  box-shadow: var(--dsh-appearance-island-shadow);
}
body[data-dsh-appearance-layout="island"] [data-shortcut-modal="settings"] {
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsh-appearance-island-radius);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsh-appearance-island-shadow);
}
body[data-dsh-appearance-layout="island"] [data-shortcut-modal="settings"] .wCInkW_nav {
  margin: 10px;
  padding: 12px 8px;
  border-radius: 18px;
  background: var(--dsw-alias-bg-layer-2);
}
body[data-dsh-appearance-layout="island"] :is(.dsx-settings-row, [data-slot="settings.general.item"] > *) {
  box-sizing: border-box;
  margin-bottom: 12px;
  padding: 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 18px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsh-appearance-card-shadow);
}
body[data-dsh-appearance-layout="island"] .dsx-theme-card {
  border-radius: 14px;
  box-shadow: var(--dsh-appearance-card-shadow);
}
body[data-dsh-appearance-layout="island"] .dsx-theme-card[aria-pressed="true"] {
  background-color: color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 8%, var(--dsw-alias-bg-layer-1));
}
body[data-dsh-appearance-layout="island"] :is(.dsx-font-select, .dsx-custom-input, .dsx-settings-button) { border-radius: 12px; }
@media (max-width: 640px) {
  body[data-dsh-appearance-layout="island"] { --dsh-appearance-island-radius: 18px; }
  body[data-dsh-appearance-layout="island"] .BynINW_frame > .BynINW_sidebarCol { margin: 6px 3px 6px 6px; }
  body[data-dsh-appearance-layout="island"] .BynINW_frame > .BynINW_centerCol { margin: 6px 6px 6px 3px; }
  body[data-dsh-appearance-layout="island"] [data-sidebar-right-panel] { padding: 6px 6px 6px 3px; }
  body[data-dsh-appearance-layout="island"] :is(.dsx-settings-row, [data-slot="settings.general.item"] > *) { padding: 12px; }
}
@media (forced-colors: active) {
  body[data-dsh-appearance-layout="island"] { --dsh-appearance-island-shadow: none; --dsh-appearance-card-shadow: none; }
  body[data-dsh-appearance-layout="island"][data-dsx-surface-theme] .BynINW_frame > :is(.BynINW_sidebarCol, .BynINW_centerCol) { background-image: none; }
}
`
