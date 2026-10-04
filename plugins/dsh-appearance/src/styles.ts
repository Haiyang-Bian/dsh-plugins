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
 * Only background-image changes: layout, hit targets, text and code stay host-owned.
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
`
