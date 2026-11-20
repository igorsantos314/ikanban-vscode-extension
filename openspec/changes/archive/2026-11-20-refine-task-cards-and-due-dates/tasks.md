# Tasks

## 1. Deadline data model and persistence

- [x] 1.1 Add an optional `dueAt` to the domain task and create a pure deadline helper for local `DD/MM/AAAA` + `HH:MM` ↔ UTC ISO conversion, validation of real calendar dates/times and overdue comparison; verify valid conversion, empty input, impossible dates such as `31/02/2026`, partial input and a DST-adjacent case in unit tests.
- [x] 1.2 Extend `taskSchema` with an optional ISO 8601 `dueAt`, map it through `parseTaskDocument`, `toPersistedTask` and `toTaskUpdates`, and extend `updateDocument` to delete a key whose update value is `undefined`; verify schema acceptance/rejection, serialization omission, clear-on-update key removal and preservation of unknown fields/comments in codec/serializer tests.
- [x] 1.3 Accept `dueAt` in `TaskDraft`, `createTask` and `updateTask`, including clearing it on update, and add `dueAt` to `taskDraftShape` in the protocol; verify create with/without deadline, update with new deadline, clear and invalid input through service and protocol tests.
- [x] 1.4 Confirm the deadline survives move and reorder operations without mutation and that a task file without `dueAt` still loads; verify with repository/service tests covering move, reorder and reload.

## 2. Deadline editor and dialog actions

- [x] 2.1 Build a `DeadlineInput` component with separate `DD/MM/AAAA` and `HH:MM` masked fields, digit-only input, automatic separators, focus advance and an explicit clear action; verify typing `251120261430`, backspace editing, clear and invalid partial values in component tests.
- [x] 2.2 Wire the deadline into `TaskDialog` state and payload, populate it from the persisted `dueAt` in local time, validate partial/invalid values next to the field and keep the typed values after a failed save; verify with existing-task, create, clear and validation tests.
- [x] 2.3 Add the **Delete task** action to the dialog for existing tasks, connect it to `App` so the dialog closes and the existing confirmation dialog opens, and keep creation free of delete; verify delete-through-dialog, cancel and unsaved-change behavior in App/TaskDialog tests.
- [x] 2.4 Add check/X/trash icons and distinct Save/Cancel/Delete styling to the dialog footer, keeping text labels and accessible names; verify the buttons are distinguishable by icon, class and color-token usage in component tests.

## 3. Two-line compact card

- [x] 3.1 Add a compact variant of `ChecklistProgress` that renders only icon and count, and create a deadline formatter that outputs full local date/time for expanded and `DD/MM HH:mm` for compact with an overdue state; verify partial/complete/no-checklist and overdue/future/no-deadline cases in tests.
- [x] 3.2 Rework `TaskCardContent` so compact renders exactly two lines—truncated title and a single metadata line with priority, checklist count, tag icons and deadline—while expanded keeps description, tag labels, timestamp, checklist bar and deadline; verify compact omissions, long-title truncation and expanded parity in React tests.
- [x] 3.3 Add compact styles that enforce two lines, single-line metadata with the deadline at the end, icon-only tags/priority and overflow handling using existing theme tokens; verify with type checks and a visual pass in light, dark and high-contrast themes.

## 4. Whole-card click and drag

- [x] 4.1 Remove the drag handle and the card `←`, `→` and `×` buttons and their props from `TaskCard`/`BoardColumn`; verify no action buttons or handle remain and that the delete path is still available through the dialog.
- [x] 4.2 Make the card article the pointer drag surface with a small activation distance, add whole-card click to open the dialog, and ensure a completed drag suppresses the click; verify with harness/unit coverage that a short press opens and a drag sends one move request.
- [x] 4.3 Remove the keyboard drag sensor from the card and implement `Enter` to open plus `Alt+←/→` between columns and `Alt+↑/↓` within a column through the existing authoritative move flow; verify each shortcut, boundary no-ops and click/keyboard independence in App/useDragPreview tests.
- [x] 4.4 Re-run the headless webview drag harness to confirm overlay, placeholder, target-column highlight, single `task/move` on drop and restored order on failure with the new whole-card surface and compact card.

## 5. Documentation and verification

- [x] 5.1 Update `resources/skills/ikanban/SKILL.md` with the optional `dueAt` field, UTC/date-time rules and clearing semantics; verify the skill content test and that the managed `AGENTS.md` block still installs unchanged.
- [x] 5.2 Update `README.md` and `CHANGELOG.md` for the two-line compact card, masked deadline fields, whole-card click/drag, removed card buttons, dialog delete and dialog action icons.
- [x] 5.3 Run `npm run check` (types, lint and unit tests) and fix all failures.
- [x] 5.4 Run `npm run test:integration` and confirm the extension-host flow, including creating and editing a task with a deadline, still passes.
- [x] 5.5 Perform a final visual/manual pass in the Extension Host for compact two-line cards, deadline masks, click-versus-drag, `Alt` shortcuts, dialog delete and Save/Cancel treatment.
