# Design

## Context

See `proposal.md` for motivation and `specs/` for the behavior contract.

`BoardService.createTask` currently reads the target column through `tasksForColumn` and assigns `nextPosition(existing)`, which is the maximum position plus `1024`. Tasks are rendered in ascending `(position, taskId)` order, and paginated columns always load the first page in that same order, so an appended task can be outside the visible page.

`planReorder` already handles inserting an existing task at an arbitrary index, including a column-local rebalance when no integer gap remains. Moves compute their target position from the column index and fall back to `planReorder` when the index cannot provide a midpoint. Creation has no equivalent prepend planning helper.

The bundled agent skill and the README currently document the append behavior (`max + 1024`), so they must change with the implementation.

## Goals / Non-Goals

**Goals:**

- Make every task created through iKanban appear before the existing tasks in its column.
- Keep ordering deterministic and preserve the normal spaced-position behavior for reorders and moves.
- Avoid rewriting sibling task files during ordinary prepends.
- Keep creation atomic from the user's perspective: a failed creation must not leave a half-rebalanced column.
- Keep pagination and the derived index consistent with the new first task.

**Non-Goals:**

- Changing the ordering of existing tasks, moves, reorders or column operations.
- Changing the task YAML schema or adding new metadata.
- Redesigning the pagination cursor or derived index.
- Preventing users or external tools from manually choosing another valid position.

## Decisions

### 1. Prepend with the next lower integer, not another 1024-step gap

A task created in an empty column receives position `1024`. In a non-empty column, the new task receives the greatest non-negative integer lower than the current minimum position (`min - 1`). When the minimum is `0`, the column is rebalanced locally: the new task receives `1024` and existing tasks receive `2048`, `3072`, and so on in their existing order.

This leaves up to 1024 consecutive prepends before another rebalance while requiring no sibling writes for normal creation. Subtracting `1024` instead would hit `0` on the second prepend when the first existing task is at `1024`, forcing frequent column-wide rewrites.

**Alternative considered:** always rebalance on creation to keep positions spaced by `1024`. Rejected because every new task would rewrite sibling files and bump their `updatedAt`.

**Alternative considered:** reuse `planReorder` by inserting a provisional task at index `0`. It needs a full task list and its rebalance does not create headroom for repeated prepends. Rejected in favor of a dedicated prepend plan.

### 2. Add a pure prepend planner in the domain layer

Add a planner alongside `nextPosition` and `planReorder`:

- Empty column: return the new task position `1024`, no rebalance.
- Minimum above `0`: return `minimum - 1` for the new task, no rebalance.
- Minimum at `0`: return a rebalanced position map containing `1024` for the new task and `2048 + index * 1024` for existing tasks in their current order.

The planner stays pure and testable, like `planReorder`. The application service remains responsible for persistence and rollback.

### 3. Keep rebalance writes recoverable and column-local

`createTask` applies the plan inside the existing serialized mutation queue:

1. Read the current column tasks and derive the prepend plan.
2. If no rebalance is needed, write only the new task file.
3. If a rebalance is needed, update each existing task's position and `updatedAt`, recording its previous task and new revision, then create the new task.
4. If any write fails, restore the recorded sibling tasks in reverse order, then report the failure. This follows the existing `moveTask` rebalance rollback pattern.
5. Invalidate the column index after success so pagination observes the new first entry.

Only the affected column is touched. Other columns and their indexes remain unchanged.

### 4. Keep ordering and pagination behavior unchanged elsewhere

The new task's lower position is sufficient for the existing `(position, taskId)` ordering, first-page selection, drag/move planning and webview `upsert-task` sorting. No protocol or snapshot shape changes are required. Because the new task is below the previous minimum, it is included in the first page even when the column has more than one page.

### 5. Update the agent contract and user documentation

The bundled `SKILL.md` and README must describe prepending, the `min - 1` rule, the empty-column default `1024`, and the local rebalance at `0`. The skill's creation recipe and position rule are part of its behavioral contract, so agents following it must produce the same order as the extension.

## Risks / Trade-offs

- **Dense positions near the top** → Reordering between adjacent prepended tasks can exhaust a gap sooner; the existing reorder planner rebalances the affected column, preserving correctness at the cost of a rare column-local rewrite.
- **Rebalance during creation rewrites siblings** → This happens only when the first task is at `0` (after roughly 1024 prepends) and is explicitly allowed by the updated requirement; rollback mirrors the existing move recovery.
- **Concurrent creation at the top** → `MutationQueue` serializes creations, so each request observes the latest minimum and decrements from it; no two concurrent creates read the same previous state.
- **External agents may still append** → The skill is updated, and manual edits remain free-form; the extension can only enforce ordering for tasks it creates. Existing validation continues to reject invalid positions.
- **Error during rebalance** → Sibling positions may have been written before the new task fails; reverse-order rollback restores their previous content, with best-effort semantics consistent with existing multi-file operations.

## Migration Plan

No data migration is required. Existing board files retain their positions and remain valid. The next task created in a column is placed below its current minimum; if that minimum is `0`, the column is rebalanced once. Rolling back the extension requires no data change because the YAML schema is unchanged.
