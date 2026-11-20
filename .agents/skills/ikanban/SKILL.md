---
name: ikanban
description: Manage the local iKanban board stored as YAML under .ikanban. Use when creating, editing, moving, reordering, completing or deleting iKanban tasks by reading and writing files directly.
---

# iKanban board skill

This skill is a file-based contract. Any agent that can read and write workspace files can use it; it does not require a specific provider, an MCP server or network access. The human can also use the VS Code interface, but direct edits must follow the rules below so the board stays valid.

## Before you edit

1. Find the workspace folder that contains `.ikanban/board.yaml`.
2. Read `.ikanban/board.yaml` and use only the columns listed there.
3. Read the target task file immediately before changing it.
4. Preserve fields you do not recognise and never rewrite unrelated files.
5. Never add a `status` or `columnId` field. Column membership comes only from the directory.
6. Ask for explicit confirmation before deleting tasks or content, or when the target column is ambiguous.
7. Validate after the change, for example with the VS Code command `iKanban: Validate Board` or by checking the Problems panel.

## Storage layout

```text
.ikanban/
  board.yaml
  backlog/
    column.yaml
    550e8400-e29b-41d4-a716-446655440000.yaml
  in-progress/
    column.yaml
  done/
    column.yaml
```

- `.ikanban/board.yaml` is the board configuration.
- Every column has its own directory and a `column.yaml`.
- Every task is one `<task-id>.yaml` file inside its column directory.
- A task belongs to the column whose directory contains its file.
- Task IDs must be unique across the whole board.
- Checklists and checklist items are embedded in the task file, not stored separately.
- `.ikanban/.index/` is a derived, git-ignored pagination index. Never treat it as task data and never edit it by hand; if it is stale or deleted, the extension rebuilds it from the task files.

## Board document

```yaml
version: 1
name: "My Project"
columns:
  - backlog
  - in-progress
  - done
```

- `version` must be `1`.
- `name` must be non-empty.
- `columns` is the visual order and must list every existing column exactly once.
- Column IDs contain lowercase letters, digits and hyphens and match their directory names.
- Do not edit `board.yaml` unless the user explicitly asks for a board or column change.

## Column document

```yaml
id: backlog
title: Backlog
color: "#64748b"
```

The `id` must match the directory name. `color` is a six-digit hexadecimal value. Do not invent a new column directory for a task; use a column already present in `board.yaml`.

## Task document

```yaml
id: "550e8400-e29b-41d4-a716-446655440000"
title: "Implement authentication"
description: ""
tags: []
priority: medium
position: 1024
checklists: []
createdAt: "2026-11-18T10:00:00.000Z"
updatedAt: "2026-11-18T10:00:00.000Z"
```

### Required fields and rules

| Field | Rule |
|---|---|
| `id` | Lowercase UUID, also the file name. Never reuse an ID. |
| `title` | Non-empty after trimming. |
| `description` | Optional string. Empty is valid and multiline text is preserved literally. |
| `tags` | Array containing only `issue`, `feat`, `chore` and `spec`, without duplicates, in the canonical order `issue`, `feat`, `chore`, `spec`. |
| `priority` | Exactly `low`, `medium` or `high`. |
| `position` | Non-negative integer used to order tasks inside the column. Prefer unique values spaced by `1024`. |
| `checklists` | Array of checklists; each has a UUID `id`, non-empty `title`, non-negative integer `position` and an `items` array. |
| checklist item | UUID `id`, non-empty `text`, boolean `completed` and non-negative integer `position`. |
| `dueAt` | Optional ISO 8601 UTC instant with both date and time, for example `2026-11-25T14:30:00.000Z`. Omit the key when there is no deadline; never write a date without a time or a null placeholder. |
| `createdAt` | ISO 8601 UTC instant, unchanged for the whole life of the task. |
| `updatedAt` | ISO 8601 UTC instant, refreshed on every successful change. |

Timestamp format: `YYYY-MM-DDTHH:MM:SS.sssZ`, for example `2026-11-18T10:00:00.000Z`. The extension accepts 1–3 fractional digits but always writes milliseconds. Never use a local time or omit the `Z`.

There is no `status` field and no `columnId` field in a task document.

## Operations

### Create a task

The default destination is usually `backlog`, but use whichever existing column the user requested.

1. Read `board.yaml` and confirm the target column directory exists.
2. Generate a UUID (version 4) for the task.
3. Set `createdAt` and `updatedAt` to the same current UTC timestamp.
4. Read the tasks already in the target column and set `position` to the highest existing position plus `1024`, or `1024` when the column is empty.
5. Write the file as `.ikanban/<column-id>/<task-id>.yaml` with the full schema above.
6. Use `priority: medium`, `description: ""`, `tags: []` and `checklists: []` unless the user provided other values.
7. Set `dueAt` only when the user requested a deadline, using one ISO 8601 UTC instant with date and time. Omit the key when there is no deadline.

```yaml
id: "550e8400-e29b-41d4-a716-446655440000"
title: "Write the release notes"
description: ""
tags: [spec]
priority: medium
position: 3072
checklists: []
createdAt: "2026-11-18T10:00:00.000Z"
updatedAt: "2026-11-18T10:00:00.000Z"
```

The VS Code command `iKanban: Create New Task` provides the same quick creation flow with prompts. Use it when the user wants a new task without specifying every field.

### Update a task

1. Locate the task file by its ID and read its current content.
2. Change only the fields the user requested.
3. Preserve `id`, `createdAt`, column membership, `position` and unknown fields unless the request explicitly moves or reorders the task.
4. Preserve `dueAt` when the deadline did not change. Replace it with one valid UTC instant when the user requested a new deadline, or remove the key when the user explicitly cleared the deadline.
5. Set `updatedAt` to the current UTC timestamp.
6. Write the same file back and validate.

### Move a task (change column / status)

1. Locate the task file and note its source column.
2. Confirm the target column exists in `board.yaml` and is different from the source.
3. Read the target column and choose a position: after the current maximum (`max + 1024`), or between neighbours when the user requested a specific place.
4. Set `updatedAt` to the current UTC timestamp and keep every other field, including `createdAt` and `dueAt`.
5. Write `.ikanban/<target-column>/<task-id>.yaml` and remove the source file. Prefer a single rename/move when the environment supports it.
6. Never overwrite an existing target file. If both copies exist afterwards, stop and report the problem instead of deleting data.

Typical flow: `backlog` → `in-progress` → `done`, but always use the column IDs present in `board.yaml`; never assume only these three columns exist.

### Reorder inside a column

1. Read the column's tasks and sort by `position`.
2. Prefer a midpoint between the new neighbours when an integer gap exists.
3. If there is no gap, reassign positions in `1024` increments for that column, preserving the requested order.
4. Set `updatedAt` on every task whose position changed.
5. Never reorder or rewrite tasks in another column.

### Change checklist content

- Add checklists and items with new UUIDs and positions (`max + 1024`).
- Toggling an item changes only `completed` and the task's `updatedAt`.
- Preserve item text, order and unknown fields.
- Delete checklist content only when the user explicitly asks.

### Remove a task

1. Confirm the target task with the user when the request is ambiguous.
2. Delete only the matching `.ikanban/<column>/<task-id>.yaml` file.
3. Do not delete `board.yaml`, column files, or sibling tasks.

## Validation checklist

Before reporting success, confirm:

- The YAML parses and has no duplicate keys.
- The file name matches `id`.
- `createdAt` and `updatedAt` use the UTC format above.
- A new task has `createdAt == updatedAt`.
- Every modification changed `updatedAt` and left `createdAt` intact.
- Tags and priority are supported values.
- A `dueAt`, when present, is one valid ISO 8601 UTC instant with both date and time; otherwise the key is absent.
- Task, checklist and checklist-item IDs are unique.
- Positions are non-negative integers and ordering matches the request.
- The task is in exactly one column directory.
- No unrelated files changed.

If validation fails, restore the previous content or report the problem; never leave a half-valid task in place.
