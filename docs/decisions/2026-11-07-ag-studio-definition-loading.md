# AG Studio: saved dashboard definition, theme and license entry points

## Context

Task D6 ships the provider dashboard on `ag-studio-react@3.1.0` with four preconfigured widgets. The plan asked D6 to confirm, against the installed package, how a saved dashboard is loaded, how the product theme is applied and where the trial license key goes, and to record what it found.

## Decision

Verified in `node_modules/ag-studio-react/dist/types/src/*.d.ts` and `node_modules/ag-studio/dist/types/api/*.d.ts` on 2026-11-07, and confirmed on screen in fixtures mode:

- **Saved definition:** `<AgStudio initialState={AgReportState}>`, read once at creation. The state shape was captured from `onStateUpdated(event.state)` after adding a widget in the editor: `{ version, selectedPageId, pages: [{ id, widgets, widgetLayout, filter }] }`. Field ids are `<sourceId>.<fieldId>` (`createFieldIdentifier` in `ag-studio`), e.g. `lines.amountUsd`; date parts are `<field>.<unit>`; widget-level filters live under `filter.widget[<widgetId>]` with `{ field: { id }, model: { operator, value } }`; the canvas is 24 columns of 16 px rows. The definition is hand-written from that shape in `apps/web/src/dashboard/studio-config.ts`, not pasted from the editor, so it stays readable and diffable.
- **Theme:** `studioTheme.withParams({...})` from `ag-studio`, passed as `theme`. `createStudioTheme()` returns a theme without the icon set, button and input parts (icons render as black squares), so the product theme extends `studioTheme`.
- **License:** `<AgStudioProvider licenseKey>` from `ag-studio-react`, which calls `AgStudioLicenseManager.setLicenseKey` once before the first instance. The prop is omitted when `VITE_AG_STUDIO_LICENSE` is empty. Without a key Studio renders in trial mode with a watermark and prints a license notice to the console; nothing is blocked, so the pivot of spec section 5 is not triggered.
- **Data:** `{ sources: [{ id, name, fields, data: Row[] }] }`; rows are the contracts' dashboard rows plus `amountUsd`/`totalUsd` and `day` columns for charting (`src/dashboard/sources.ts`). `fields` is declared explicitly (`AgFieldDefinition[]` with `textFormat`, `integerFormat`, `decimalFormat`, `dateFormat`, `dateTimeFormat`) instead of inferred from the rows: right after "Reset demo data" every source is empty, inference yields no fields, and the saved definition fails validation with "Invalid configuration" on every widget (seen against the real backend on 2026-11-07).

## Alternatives considered

- Paste the editor's exported JSON verbatim: works, but carries selection and panel state and opaque widget ids; a hand-written definition with named widget ids is easier to review and extend.
- `ag-grid-community` + `ag-charts-react` fallback: not needed, Studio renders without a key.

## Consequences

The dashboard loads with its four widgets on first paint and stays editable. Chart series keep Studio's default palette (no palette theme param in 3.1.0; per-widget series styling can follow). When the trial key arrives it is a single environment variable. Changing the dashboard means editing one TypeScript object; `window.__dwStudioState` (dev builds only) exposes the live state to copy from the editor.
