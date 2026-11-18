# Spec Delta

## Purpose

Defines nested checklists and checklist items inside tasks, including complete CRUD behavior, deterministic ordering, and completion progress derived from item state.

## ADDED Requirements

### Requirement: Embedded checklist model

A task SHALL support zero, one or multiple checklists embedded in its own YAML file. Each checklist SHALL have a stable generated ID, a non-empty title, a non-negative integer position and an items collection. Each checklist item SHALL have a stable generated ID, non-empty text, a boolean completion state and a non-negative integer position. Checklist and item IDs SHALL be unique within their parent scope. Checklists and items SHALL NOT be stored as separate files.

#### Scenario: Task without checklists

- **WHEN** a task is created with no checklists
- **THEN** the task is valid and persists an empty checklists collection

#### Scenario: Task with multiple checklists

- **WHEN** a task is saved with an `Implementation` checklist and a `Testing` checklist
- **THEN** both checklists are stored in the same task YAML file with their own items

#### Scenario: Empty checklist

- **WHEN** a checklist is created with no items
- **THEN** the checklist is valid with zero items

### Requirement: Checklist creation and update

The extension SHALL create checklists with generated stable IDs, append them to the task using deterministic positions, and persist the change as part of the task document. Renaming a checklist SHALL preserve its ID, position, items and completion states. Updating or deleting a checklist SHALL NOT alter unrelated task fields or other checklists. A checklist title SHALL be required.

#### Scenario: Create a checklist

- **WHEN** the user adds a checklist titled `Implementation` to an existing task
- **THEN** the task YAML contains the new checklist with a stable ID and an items array

#### Scenario: Persist and reload a checklist

- **WHEN** the task is reloaded after adding a checklist
- **THEN** the checklist title, ID, position and items match the saved state

#### Scenario: Rename a checklist

- **WHEN** the user renames `Testing` to `Verification`
- **THEN** the checklist keeps its ID and all of its items and completion states

#### Scenario: Blank checklist title rejected

- **WHEN** the user submits a checklist with a blank title
- **THEN** the task save is rejected with a checklist title validation message

#### Scenario: Reorder checklists

- **WHEN** the user moves a checklist above another checklist
- **THEN** the persisted positions reflect the requested order while IDs remain stable

### Requirement: Checklist deletion

The extension SHALL allow a checklist to be deleted from a task. Deletion SHALL remove the checklist and its items from the task document, SHALL preserve unrelated task fields and other checklists, and SHALL be persisted. Deleting a checklist that does not exist SHALL fail with a not-found error or an equivalent validation message.

#### Scenario: Delete a checklist

- **WHEN** the user deletes the `Testing` checklist
- **THEN** it no longer appears in the task YAML and its items are removed with it

#### Scenario: Other checklists survive deletion

- **WHEN** one of several checklists is deleted
- **THEN** all remaining checklists and their item states are unchanged

#### Scenario: Delete nonexistent checklist

- **WHEN** a delete request targets a checklist ID that is not in the task
- **THEN** the operation is rejected and the task file is unchanged

### Requirement: Checklist item CRUD

The extension SHALL allow users to create, edit and delete checklist items and to mark them complete or incomplete. Every item mutation SHALL be persisted to the owning task file. Item IDs SHALL be stable across text edits and completion toggles. Item text SHALL be required. Updates to a nonexistent item SHALL be rejected. Deleting an item SHALL remove only that item.

#### Scenario: Create an item

- **WHEN** the user adds `Create login screen` to a checklist
- **THEN** the item is persisted with a stable ID, the text, `completed: false` and a position

#### Scenario: Edit item text

- **WHEN** the user changes an item's text
- **THEN** the item keeps its ID and completion state and the new text is persisted

#### Scenario: Delete an item

- **WHEN** the user deletes an item
- **THEN** only that item is removed and the remaining items keep their order and states

#### Scenario: Mark an item complete

- **WHEN** the user marks an item as complete
- **THEN** the persisted item has `completed: true`

#### Scenario: Mark an item incomplete

- **WHEN** the user unchecks a completed item
- **THEN** the persisted item has `completed: false`

#### Scenario: Reorder items

- **WHEN** the user moves an item within its checklist
- **THEN** the persisted item positions reflect the requested order and item IDs are unchanged

#### Scenario: Blank item text rejected

- **WHEN** the user tries to save an item with blank text
- **THEN** the task save is rejected with a field-specific validation message

#### Scenario: Update nonexistent item

- **WHEN** an update targets an item ID that does not exist in the checklist
- **THEN** the operation is rejected and the task file is unchanged

### Requirement: Checklist progress is derived

Checklist completion progress SHALL be calculated dynamically from checklist item states. The extension SHALL NOT persist redundant completed or total counters. An empty checklist SHALL report `0` completed items and `0` total items. Toggling or deleting an item SHALL immediately change the derived progress, and moving a task SHALL NOT change its checklist progress.

#### Scenario: Progress after completing an item

- **WHEN** a checklist has three items and one becomes complete
- **THEN** its progress is `1` completed of `3` total

#### Scenario: Empty checklist progress

- **WHEN** a checklist contains no items
- **THEN** its progress is `0` completed of `0` total

#### Scenario: Deletion updates progress

- **WHEN** the only completed item in a checklist is deleted
- **THEN** the completed count decreases by one and the total count decreases by one

#### Scenario: Move preserves progress

- **WHEN** a task is moved to another column
- **THEN** each checklist reports the same completed and total counts as before the move

#### Scenario: No stored counters

- **WHEN** a task YAML file is inspected
- **THEN** checklist progress exists only as item completion states and not as stored aggregate counters

### Requirement: Deterministic checklist ordering

Checklists SHALL be ordered by ascending position, with the checklist ID as a deterministic tie-breaker. Items SHALL be ordered by ascending position, with the item ID as a deterministic tie-breaker. New checklists and items SHALL be appended after existing entries. Reordering SHALL rewrite only the task being changed.

#### Scenario: Stable order with equal positions

- **WHEN** two checklists or items share the same position
- **THEN** their display order is deterministic by ID

#### Scenario: Append new entries

- **WHEN** a new checklist or item is added
- **THEN** it appears after the current entries in its parent

#### Scenario: Rebalance is task-local

- **WHEN** checklist or item positions are rebalanced
- **THEN** only the owning task file is rewritten

### Requirement: Consistent checklist persistence

Checklist and checklist item changes SHALL be validated and persisted as part of the owning task document. A failed task save SHALL leave the YAML file unchanged and SHALL NOT leave a partially updated checklist, partially updated item or modified unrelated field. Checklist changes made in the task dialog SHALL be persisted atomically with the rest of the task update.

#### Scenario: Failed checklist save is atomic

- **WHEN** a task save that includes checklist changes fails validation or persistence
- **THEN** the original task YAML, including all checklists and item states, remains unchanged

#### Scenario: Unrelated fields are preserved

- **WHEN** a checklist title is updated
- **THEN** the task title, description, tags, priority and other checklists are unchanged
