# Tasks

## 1. Visual foundation

- [x] 1.1 Replace the webview token layer in `src/webview/styles.css` with semantic canvas, panel, card, inset, border, muted-text, radius, shadow and priority tokens derived from VS Code theme variables, including fallbacks; verify the webview builds and the board still renders in dark, light and high-contrast themes.
- [x] 1.2 Restyle shared base classes for buttons, icon buttons, inputs, priority badges, tag chips, focus rings, empty states and reduced-motion behavior, and verify existing component tests still pass without changing accessible names.

## 2. Board and columns

- [x] 2.1 Restyle `BoardHeader` as a compact toolbar with board identity and summary on the left and grouped actions on the right, and verify all existing action labels and keyboard paths remain intact.
- [x] 2.2 Restyle `BoardColumn` with the colored status dot, title and count pill in the header, a full-width add-task row at the top of the list, quiet reorder/edit/delete actions on hover or focus, and a calm empty state; verify drag-and-drop and column action tests still pass.
- [x] 2.3 Adjust the board layout in `App.tsx` for consistent 16px padding, 16px column gaps and 18rem columns with horizontal scrolling, and verify narrow layouts do not clip card content.

## 3. Task cards

- [x] 3.1 Restructure `TaskCard` into a priority meta row, prominent title, description preview, neutral tag chips with colored icons and a footer for checklist progress plus last-updated metadata; verify long text truncation and cards without optional data.
- [x] 3.2 Add restrained hover, focus-within and drag treatments that do not change card dimensions, keep the drag handle accessible and verify the card component tests.

## 4. Task dialog

- [x] 4.1 Restyle `Modal` with the shared panel surface, wider layout, layered shadow, quiet border, compact header and sticky footer; verify focus trapping, Escape handling and scrolling behavior.
- [x] 4.2 Restructure `TaskDialog` into header context, created/last-updated metadata strip, grouped Details, Organization and Checklists sections, shared priority badges and tag chips, and the shared input/button styles; verify the dialog component tests and accessible labels.
- [x] 4.3 Restyle `ChecklistEditor` groups as small cards with header progress pills and quiet item rows, preserving all checklist interactions and accessible names.

## 5. Validate and ship

- [x] 5.1 Run `npm run check` and verify type checks, lint and all unit/component tests pass.
- [x] 5.2 Run `npm run test:integration` on VS Code 1.147.0 and verify all Extension Host tests pass.
- [x] 5.3 Build and review the board and dialog in dark, light and high-contrast themes at wide and narrow widths, checking focus indicators, contrast and drag states; record any follow-up tweaks.
- [x] 5.4 Run `npm run package`, install the VSIX on VS Code 1.147.0 and verify the redesigned board and dialog render correctly, then update the CHANGELOG and README feature notes.
