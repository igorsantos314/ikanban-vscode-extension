# Tasks

## 1. Domain prepend planning

- [x] 1.1 Add a pure prepend planner in `src/domain/positions.ts` that returns `1024` for an empty column, `minimum - 1` when the minimum is positive, and a column-local rebalance plan when the minimum is `0`; verify with unit tests for empty, positive-minimum, zero-minimum and stable-order cases.
- [x] 1.2 Keep `nextPosition`, `planReorder` and `sortByPosition` behavior unchanged for moves and reorders; verify the existing `positions.test.ts` suite still passes.

## 2. Task creation behavior

- [x] 2.1 Change `BoardService.createTask` to use the prepend planner instead of `nextPosition`; verify a unit test shows a new task ordered before every existing task in the same column.
- [x] 2.2 Verify ordinary prepends write only the new task file and leave sibling task content and `updatedAt` unchanged through a service test.
- [x] 2.3 Implement the rare zero-position rebalance path, updating only the affected column with rollback when the new task write fails; verify tests cover the rebalanced order, preserved relative order and restored siblings on failure.
- [x] 2.4 Confirm the column index is invalidated after creation and the new task is returned in the first page, including columns with more than 20 tasks; verify with pagination and service tests.
- [x] 2.5 Update existing task-creation, ordering and pagination tests that assumed append order, then run `npm run test:unit` and confirm all unit suites pass.

## 3. Command and integration paths

- [x] 3.1 Verify `ikanban.createTask` produces a task at the top of the selected column through the shared service, adding or updating an integration assertion in `src/test/extension.test.ts`.
- [x] 3.2 Run `npm run test:integration` and confirm the Extension Host suite passes with the new ordering.

## 4. Documentation and agent contract

- [x] 4.1 Update `resources/skills/ikanban/SKILL.md` with the prepend creation recipe, `minimum - 1` position rule, empty-column default `1024`, zero-position rebalance and a matching validation checklist item.
- [x] 4.2 Update `README.md` to state that new tasks appear at the top, and describe the prepend position rule and local rebalance in the task/storage sections.
- [x] 4.3 Run `npm run check` and confirm types, lint and unit tests pass.
