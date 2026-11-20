# Design

## Context

See `proposal.md` for motivation and the delta specs for the behavior contract.

- `TaskCard` currently renders the same markup in both densities; compact is only a CSS modifier that still includes the description, tag labels, checklist bar, updated timestamp and hover action buttons.
- Dragging is activated by a `useSortable` listener attached to a `⋮⋮` handle. The card title is a separate button, and delete/move arrow buttons live in the card footer.
- `TaskDialog` has no delete action and uses unadorned footer buttons.
- Task documents have no deadline. Parsing is schema-driven (`taskSchema`), `serializeTask` builds a canonical object, and updates use `updateDocument` to patch existing keys so unknown fields and comments are preserved.
- `useDragPreview` already owns the cross-column preview order, overlay data and drop request; only the drag activator and click behavior need to change.
- The unarchived `improve-board-and-sidebar-ux` change modifies the same card and drag requirements. Any requirement block edited here must include that change's behavior as well as the new behavior.

## Goals / Non-Goals

**Goals:**

- Make compact a genuinely two-line density with one source of truth for what is visible.
- Make the whole card the single interaction surface with a reliable click-versus-drag threshold.
- Add one optional deadline instant that survives every existing task operation and stays absent when unset.
- Keep the deadline editor fast to fill without adding a date-picker dependency.
- Preserve the existing authoritative-move, confirmation and validation semantics.

**Non-Goals:**

- Recurring deadlines, reminders, calendar integration or timezone selection.
- Native date/time picker widgets or a new UI dependency.
- Changing column drag-and-drop, board storage layout or the typed protocol beyond the new `dueAt` field.
- Redesigning the expanded card beyond showing the deadline.

## Decisions

### 1. Store one optional `dueAt` instant in UTC

`Task` gains `dueAt?: string`. It is persisted as one ISO 8601 UTC timestamp in `dueAt`, the same representation as `createdAt`/`updatedAt`. The dialog converts local `DD/MM/AAAA` + `HH:MM` to UTC with `new Date(year, month - 1, day, hour, minute).toISOString()` and converts back with the local part getters.

- **Alternative considered**: separate `dueDate` and `dueTime` fields. Rejected: two fields can drift, complicate validation and do not represent one instant.
- **Alternative considered**: store local `YYYY-MM-DDTHH:mm` without a zone. Rejected: ambiguous across machines and inconsistent with existing timestamp storage.
- Absence is the only "no deadline" state. Clearing must delete the key rather than write `null`.

### 2. Extend `updateDocument` to remove keys on `undefined`

`toTaskUpdates` will include `dueAt: task.dueAt`. `updateDocument` will `document.delete(key)` when the update value is `undefined`; `toPersistedTask` will omit the key when unset. This keeps other unknown fields/comments intact and prevents a lingering `dueAt: null`.

- **Alternative considered**: set `dueAt: null` and allow null in the schema. Rejected: it adds a second empty representation and leaks into the UI.

### 3. Two masked local fields, one shared conversion helper

Create a small `DeadlineInput` component with two controlled text inputs and a clear action:

- date accepts digits and renders `DD/MM/AAAA`;
- time accepts digits and renders `HH:MM` (24-hour);
- separators are inserted as digits arrive, and the date field advances focus to the time field when full;
- the component emits either a valid local pair or `undefined` for empty; incomplete or impossible dates are reported by the dialog validation.

A pure `deadline.ts` helper owns the conversions and validation so mask behavior, domain validation and tests share one implementation. Invalid local input is rejected before any request is sent; the host validates the resulting UTC value again.

- **Alternative considered**: native `<input type="date">` + `<input type="time">`. Rejected by the requested masked quick-entry behavior and inconsistent rendering across platforms.
- **Alternative considered**: a single `DD/MM/AAAA HH:MM` mask. Rejected by the chosen two-field interaction.

### 4. Whole-card interaction without `KeyboardSensor`

- Keep only `PointerSensor` with a small activation distance (about 5 px). Spread the pointer listeners on the card article. On pointer release without exceeding the distance, the card's `onClick` opens the dialog; dnd-kit suppresses the click after a real drag.
- The article gets `role="button"`, `tabIndex={0}`, an accessible name and `aria-keyshortcuts`.
- A local `onKeyDown` handles `Enter` to open and `Alt+←/→/↑/↓` to move; other keys are left alone.
- `TaskCard` gains an `onKeyboardMove(task, direction)` callback. `App` reuses `moveTaskToAdjacentColumn` for horizontal moves and computes the same-column target index for vertical moves, then calls the existing authoritative `moveTask`.
- Remove the `KeyboardSensor` and `sortableKeyboardCoordinates` imports because the custom shortcuts replace the Space/Arrow sensor and avoid Space opening or dragging unexpectedly.

- **Alternative considered**: keep `KeyboardSensor` and the handle for keyboard drag only. Rejected: it retains a control the request removes and creates two drag models.
- **Alternative considered**: distinguish click by timing instead of distance. Rejected: distance is the Trello-like, pointer-agnostic behavior and already has an activation constraint.

### 5. Compact markup is a distinct two-line branch

`TaskCardContent` renders different markup for compact instead of hiding elements with CSS:

- line 1: `<span class="task-card-compact-title">` with `title` and accessible full title;
- line 2: priority icon, `ChecklistProgress` in count-only compact form, compact tag icon chips, and the short deadline pushed to the end.

`ChecklistProgress` gains a `compact` variant that hides the bar. `TagChip` already supports icon-only compact rendering. The updated timestamp, description and action buttons are not rendered in compact at all.

- **Alternative considered**: keep one markup and hide pieces with CSS. Rejected: hidden interactive/action elements and duplicate accessible content are harder to keep correct.

### 6. Remove card action buttons; delete lives in the dialog

Remove `onDelete`, `onMoveLeft` and `onMoveRight` from `TaskCard` and from `BoardColumn`'s card props. `TaskDialog` gains `onDelete(task)` used only when editing. The footer renders a danger-styled trash-button on the left; `App` closes the dialog and opens the existing `ConfirmDialog` for that task. Confirming runs the existing delete flow; cancelling returns to the board without deleting. The keyboard `Alt` shortcuts replace the removed move buttons.

### 7. Dialog action styling

Add inline check/X SVG icons and classes: Save/Create stays `btn-primary` plus a success-tinted icon treatment; Cancel uses a new `.btn-cancel` danger-tinted outline/text style. The Delete action uses the existing danger button style with a trash icon. Icons are decorative (`aria-hidden`) and the accessible name remains the button text.

### 8. Deadline display and overdue state

Add `formatDeadline(dueAt, { compact })` in a small webview formatter. Expanded uses full local date and time; compact uses `DD/MM HH:mm`. `isOverdue(dueAt, now)` is derived at render time. The card exposes an "overdue" text/accessibility state in addition to any color, and the compact second line stays single-line with ellipsis/truncation if space is tight.

## Risks / Trade-offs

- **The click-versus-drag threshold can still surprise users on high-DPI input** → use the same small distance for mouse/touch, test click, short move and full drag, and keep dnd-kit's click suppression after a drag.
- **`Alt+Arrow` shortcuts may be captured by the OS/window manager on some Linux desktops** → keep `Enter`/click opening and the dialog's column selector as fallbacks; document the shortcuts in the card's accessible description.
- **DST and invalid local times** → validate the local date/time by round-tripping the constructed `Date`; reject times that do not round-trip and test the helper near DST boundaries.
- **Clearing the key while preserving comments** → use YAML document deletion and a repository round-trip test that verifies the key disappears, unrelated fields/comments survive and a subsequent read has no deadline.
- **Two spec changes touching the same requirements** → include the `improve-board-and-sidebar-ux` behavior in every MODIFIED block and archive the changes in an order that keeps the newer card behavior.
- **Long localised date strings in a narrow compact line** → format compact as fixed `DD/MM HH:mm`, let it shrink last and keep the full value in `title`/accessible text.
- **Whole-card navigation conflicts with text selection** → cards are not text-editable surfaces; pointer dragging is the primary action, and click still opens details.

## Migration Plan

- No data migration. Existing task files without `dueAt` remain valid and render no deadline.
- New writes include `dueAt` only when set; clearing removes it. A rollback to the previous extension version would ignore the unknown field because the task schema uses pass-through unknown fields, so no data is lost.
- The compact layout and card interaction changes are presentation-only and require no stored preference migration; the existing `expanded` default remains.
