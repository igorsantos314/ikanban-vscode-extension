# Tasks

## 1. Sidebar state model and detection

- [x] 1.1 Add a home state module (`src/vscode/homeState.ts`) defining `HomeViewState` with workspace availability, trust, board state (`initialized`, `missing`, `needs-repair`, `error`) and skill state (`missing`, `current`, `outdated`, `error`), plus detection functions that stat `.ikanban/board.yaml` and compare `skills/ikanban/SKILL.md` with the bundled asset; cover each state and read failure in `homeState.test.ts`.
- [x] 1.2 Add a non-prompting `peek()` path to `WorkspaceResolver` (single folder or remembered match, no dialog) and an explicit always-pick path for multi-root selection; verify with unit tests for single-root, remembered multi-root, unremembered multi-root and no-folder cases.
- [x] 1.3 Rewrite `buildHomeHtml` to accept `HomeViewState` and render board status, skill status and only the applicable actions (`Open board`, `Initialize board`, `Validate board`, `Install AI skill`, `Update AI skill`, `Select workspace folder`, `Refresh`), keeping the script-free CSP; update `homeHtml.test.ts` to assert each state's actions and absence of the inapplicable ones.
- [x] 1.4 Update `HomeViewProvider` to remove automatic board redirection, own state detection/rendering, expose `refresh()`, and re-detect on visibility, workspace-folder changes and debounced board/skill watcher events while ignoring overlapping refreshes; update `homeView.test.ts` to cover no redirect, re-render on visibility and disposal of listeners/watchers.
- [x] 1.5 Register the internal `ikanban.home.refresh` and `ikanban.home.selectFolder` commands (not contributed to the Command Palette), wire the provider into `src/extension.ts`, and call `refresh()` after successful initialize and skill install/update; verify the actions work from the view and the public command list is unchanged.
- [x] 1.6 Add extension-host coverage that the home view shows Initialize for a fixture without a board, shows Open after initialization, and reports skill status without writing files, running `npm run test:integration`.

## 2. Card density preference

- [x] 2.1 Add a guarded card-layout preference helper (`readCardLayout`/`writeCardLayout`) using a workspace-scoped `localStorage` key and an `expanded` fallback; verify default, round-trip and storage-failure behavior in unit tests.
- [x] 2.2 Add an accessible segmented density control (`Expanded` / `Compact` with `aria-pressed`) to `BoardHeader` and matching styles; verify with a React test that each button reports and changes the selected layout.
- [x] 2.3 Thread `cardLayout` from `App` through `BoardColumn` to `TaskCard`, persist changes, and add compact-mode rendering that hides the description, tag text and updated timestamp while keeping priority, checklist progress, tag icons and actions; verify expanded default content and compact omissions in `TaskCard`/`App` tests.
- [x] 2.4 Confirm compact cards keep edit, delete and move actions reachable by pointer and keyboard, and that icon-only priority and tags expose accessible names; add assertions to the webview tests.

## 3. Priority and checklist visuals

- [x] 3.1 Add a shared priority visual map with icons for low, medium and high; render icon + label in expanded cards and an icon-only badge with `aria-label`/`title` in compact cards; verify every priority renders its distinct icon and accessible name in tests.
- [x] 3.2 Add a `ChecklistProgress` presentation with checklist icon, `completed/total` count and a proportional bar exposing `role="progressbar"` and value attributes; render it only when the task has items; verify partial, complete and no-checklist cases in tests.
- [x] 3.3 Add styles for the compact card, icon-only priority/tag treatments and checklist bar that use existing theme tokens and remain readable in light, dark and high-contrast themes; verify via `npm run check:types` and a visual pass in the Extension Host.

## 4. Fluid drag-and-drop

- [x] 4.1 Extract presentational task-card content from the sortable wrapper so the same content can render inside a `DragOverlay` without registering a second sortable node; verify existing card tests still pass and the overlay renders title, priority, tags and progress in both densities.
- [x] 4.2 Add pure preview-order helpers that move a task ID between per-column ordered lists and resolve the target column/index from a column or task `over` id, using rect direction for insertion side; verify cross-column, same-column, empty-column and no-op cases in `boardState` tests.
- [x] 4.3 Implement drag preview in `App` with `onDragStart`, `onDragOver`, `onDragEnd` and `onDragCancel`, `closestCorners` collision detection and `MeasuringStrategy.Always`; render columns from the preview order and keep the active card as an invisible placeholder; verify with tests that preview updates on `onDragOver`, sends one move on drop, and clears on cancel.
- [x] 4.4 Render the dragged card through `DragOverlay` with a short drop animation, add transitions that respect `prefers-reduced-motion`, and hide the drag handle's default transform behavior for the active placeholder; verify the overlay appears during drag and that a failed move restores the prior order and shows an error in tests.
- [x] 4.5 Smoke-test cross-column and same-column drags in the Extension Host, including keyboard drag, rapid moves, empty columns and reduced-motion mode, and confirm only the drop persists a move.

## 5. Verification and documentation

- [x] 5.1 Run `npm run check` (type checks, lint and unit tests) and fix all failures.
- [x] 5.2 Run `npm run test:integration` against the fixture workspace and confirm the extension flow, sidebar states and board still work end to end.
- [x] 5.3 Update `README.md` and `CHANGELOG.md` for the launcher behavior, board/skill status detection, explicit skill updates, card density control, priority icons and checklist progress bars.
- [ ] 5.4 Perform a final manual pass in a packaged VS Code Extension Host: no auto-redirect on sidebar open, initialize only when missing, install/update skill states after changing the bundled skill, density persistence after reopening, and smooth animated moves between columns.
