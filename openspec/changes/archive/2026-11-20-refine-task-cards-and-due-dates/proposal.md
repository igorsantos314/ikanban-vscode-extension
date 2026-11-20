# Proposal

## Why

The compact card is still visually heavy: it shows tag labels, a description-style footer, checklist bars and hover action buttons, so it does not behave as a true compact mode. Card actions also fragment the interaction—users must aim at a small drag handle to move a card and at tiny arrow buttons to move it between columns—while Trello-style boards let users click anywhere to open a card and drag anywhere to move it. Tasks also have no deadline field, so the second compact line has no meaningful date and time to show.

## What Changes

- Redefine the `compact` density as exactly two lines: the title on one truncated line, and a single metadata line with priority icon, checklist count, tag icons and due date/time. Description, tag text labels, updated timestamp, progress bar and card action buttons SHALL NOT appear in compact mode. The `expanded` density keeps its current complete presentation.
- Add an optional **due date and time** to tasks, persisted as one ISO 8601 UTC `dueAt` timestamp. The task dialog SHALL edit it through two local-time masked fields—**DD/MM/AAAA** and **HH:MM**—with automatic separators, digit-only input and quick advance between fields. Entering a date without a time (or the reverse) SHALL be rejected, and an explicit clear action SHALL remove the deadline. The value SHALL be validated when read and written, preserved by moves and updates, displayed in the compact and expanded cards, and documented in the agent skill.
- Make the whole card the interaction surface:
  - a single click or `Enter` opens the task dialog;
  - dragging anywhere on the card moves it, using a small activation distance so a click is not treated as a drag;
  - dragging after the threshold suppresses the click, like Trello.
- Remove the per-card `←`, `→` and `×` buttons and the `⋮⋮` drag handle.
- Add **Delete task** to the existing task dialog footer, keeping the current confirmation flow. Delete is only available for existing tasks.
- Give the dialog primary actions distinct color and icons: **Save task** / **Create task** uses the primary button with a check icon; **Cancel** uses a danger-tinted button with an X icon.
- Keep keyboard access without the removed arrow buttons: a focused card supports `Alt+←/→` to move between columns and `Alt+↑/↓` to reorder within its column; `Enter` opens the task and `Space` scrolls as usual.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kanban-ui`: compact card becomes a two-line card; card-wide click and drag replace the handle and action buttons; delete moves to the task dialog; dialog actions gain icons and color; the masked due date/time fields and card deadline display are added.
- `task-management`: tasks gain an optional `dueAt` date-time that is created, updated, preserved across moves and reorders, and removed only when explicitly cleared.
- `yaml-validation`: `dueAt` is validated as an optional ISO 8601 UTC timestamp and invalid local date/time input is rejected without defaults.

## Impact

- **Domain and storage**: `src/domain/types.ts`, `src/domain/validation.ts` (due date/time conversion and validation helpers), `src/infrastructure/yaml/schemas.ts`, `codecs.ts`, `serializer.ts`, `updateDocument` key removal, `yamlTaskRepository.ts`, `boardService.ts`, `src/shared/protocol.ts`.
- **Webview**: `src/webview/components/TaskCard.tsx`, `TaskDialog.tsx`, new masked deadline input component, `BoardColumn.tsx`, `App.tsx`, `useDragPreview.ts`, `styles.css`, and a local date/time formatter.
- **Agent skill and docs**: `resources/skills/ikanban/SKILL.md`, `README.md`, `CHANGELOG.md`.
- **Tests**: due date/time mask and conversion tests, task schema/codecs/repository/service/protocol tests, TaskCard/TaskDialog/App tests, extension-host end-to-end coverage for a task with a deadline.
- **Data compatibility**: `dueAt` is optional, so existing task files remain valid without migration. No status field is introduced and no other YAML field changes meaning.

## Assumptions

- `dueAt` is optional and stored as an ISO 8601 UTC timestamp; the interface displays and edits it in the user's local timezone. The two masked fields are a UI affordance and do not change the single persisted timestamp.
- If the user fills a date but no time, or a time but no date, the form shows a validation error and does not save.
- The compact second line displays a short local form (`DD/MM HH:mm`) and marks an overdue deadline; the expanded card shows the same deadline with full date and time.
- The two-line layout applies only to `compact`; `expanded` remains the full card.
- Save/Cancel colors follow the existing theme: Save keeps the primary button color with a check icon, and Cancel uses a danger-tinted treatment with an X icon.
