# column-management Specification

## Purpose

Defines how users create, inspect, update, reorder and delete Kanban columns while keeping `board.yaml` and column directories consistent.

## Requirements

### Requirement: Column creation

The extension SHALL create a column only when the request contains a non-empty title and a valid hexadecimal color. It SHALL derive a stable, directory-safe column ID from the title, SHALL reject an ID that already exists, SHALL create the column directory with its `column.yaml`, and SHALL append the new column ID to `board.yaml`. A failed creation SHALL NOT leave a registered column without a directory or an orphan directory registered in the board. The new column SHALL contain no task files.

#### Scenario: Create a valid column

- **WHEN** the user creates a column titled `Review` with color `#8b5cf6`
- **THEN** `.ikanban/review/column.yaml` contains `id: review`, `title: Review` and `color: "#8b5cf6"`, and `review` is appended to `board.yaml`

#### Scenario: Duplicate column rejected

- **WHEN** the user tries to create a column whose derived ID already exists
- **THEN** the operation fails with a duplicate column message and no file is written

#### Scenario: Invalid title or color rejected

- **WHEN** the user submits a blank title or a color that is not a six-digit hexadecimal value
- **THEN** the operation fails with a field-specific validation message and no column is created

#### Scenario: Creation failure leaves no inconsistency

- **WHEN** writing `column.yaml` succeeds but updating `board.yaml` fails
- **THEN** the newly created column directory is removed and the board configuration remains valid

### Requirement: Column update

The extension SHALL allow a column's title and color to be changed. Column IDs and directory names SHALL remain unchanged when a title or color changes. Updating a column SHALL modify only its `column.yaml` and SHALL NOT modify task files, task IDs or column order. A blank title or invalid color SHALL be rejected, and the existing `column.yaml` SHALL remain unchanged.

#### Scenario: Rename a column title

- **WHEN** the user changes the `Backlog` title to `Ideas`
- **THEN** `column.yaml` keeps `id: backlog` and the directory remains `backlog`, while the displayed title becomes `Ideas`

#### Scenario: Change column color

- **WHEN** the user selects a new valid color for a column
- **THEN** only that column's `color` value changes

#### Scenario: Invalid update leaves column intact

- **WHEN** a column update contains a blank title
- **THEN** the update is rejected and the persisted column is unchanged

### Requirement: Column reordering

The extension SHALL allow columns to be reordered. Reordering SHALL update only the order of the `columns` list in `board.yaml` and SHALL NOT move directories or modify task files. The resulting order SHALL contain every existing column exactly once.

#### Scenario: Move column within the board

- **WHEN** the user moves `done` before `in-progress`
- **THEN** `board.yaml` lists `backlog`, `done`, `in-progress`, and the board renders that order

#### Scenario: Reorder preserves tasks

- **WHEN** columns are reordered
- **THEN** every task remains in its original directory with unchanged content

### Requirement: Column deletion

The extension SHALL delete a column only when it contains no task files. Deleting a populated column SHALL be rejected with a message explaining that its tasks must be moved or deleted first. Deleting the final remaining column SHALL be rejected. A successful deletion SHALL remove the column ID from `board.yaml`, remove the directory and its `column.yaml`, and SHALL NOT modify any other column or task.

#### Scenario: Delete an empty column

- **WHEN** the user deletes an empty custom column
- **THEN** its directory is removed and its ID no longer appears in `board.yaml`

#### Scenario: Populated column rejected

- **WHEN** the user attempts to delete a column that contains task YAML files
- **THEN** the operation is rejected, the message states that tasks must be moved or deleted first, and every file remains unchanged

#### Scenario: Final column rejected

- **WHEN** only one column remains and the user attempts to delete it
- **THEN** the operation is rejected with a message that a board must keep at least one column

#### Scenario: Deletion failure does not lose tasks

- **WHEN** deleting a column directory fails after the board reference was updated
- **THEN** the failure is reported and the board does not silently lose the column or its tasks

### Requirement: Column consistency

Every column ID referenced by `board.yaml` SHALL resolve to a directory whose name matches the ID and that contains a valid `column.yaml` whose `id` matches the directory name. Duplicate references in `board.yaml` SHALL be rejected. A column directory that exists but is not referenced by `board.yaml` SHALL produce a warning diagnostic and SHALL NOT be displayed as part of the board. The extension SHALL never automatically delete or repair unreferenced or inconsistent directories.

#### Scenario: Missing referenced directory

- **WHEN** `board.yaml` references `review` but `.ikanban/review` does not exist
- **THEN** validation reports the missing column directory and the other valid columns remain usable

#### Scenario: Missing column configuration

- **WHEN** a referenced column directory exists without a `column.yaml`
- **THEN** validation reports the missing column configuration and does not fabricate a column

#### Scenario: Duplicate board reference

- **WHEN** `board.yaml` lists the same column ID twice
- **THEN** validation reports a duplicate column reference

#### Scenario: Directory name mismatch

- **WHEN** `.ikanban/review/column.yaml` declares `id: done`
- **THEN** validation reports the mismatched column identity

#### Scenario: Unreferenced directory is preserved

- **WHEN** an unreferenced column directory with a valid `column.yaml` exists
- **THEN** a warning is published and the directory is left untouched

### Requirement: Column identifiers remain stable

Column IDs SHALL be stable identifiers that are safe to use as directory names and SHALL NOT change when a column title changes. Column positions SHALL be determined by `board.yaml` rather than by directory ordering or filesystem metadata.

#### Scenario: Stable ID across rename and restart

- **WHEN** a column is renamed and the extension is restarted
- **THEN** its ID, directory and existing task locations are unchanged
