# Spec Delta

## ADDED Requirements

### Requirement: Derived task index storage

The board storage SHALL allow a derived index directory at `.ikanban/.index/`, separate from the authoritative board, column and task documents. Each `<column-id>.json` index SHALL describe only ordering and file metadata for that column; it SHALL NOT be treated as task content and SHALL NOT be required for the board to be valid. The index directory SHALL be git-ignored by the extension’s recommended setup and deleting it SHALL be safe. The extension SHALL never use the index to overwrite, repair or infer the content of a task file.

#### Scenario: Index file layout

- **WHEN** a column index is written
- **THEN** it lives at `.ikanban/.index/<column-id>.json` and contains only index metadata and entries

#### Scenario: Index is not required for validity

- **WHEN** `.ikanban/.index/` is absent
- **THEN** the board and its task files remain valid and the column can be indexed on demand

#### Scenario: Index deletion is safe

- **WHEN** the user deletes `.ikanban/.index/`
- **THEN** no task, column or board data is lost and the index is rebuilt when needed

#### Scenario: Index does not affect YAML documents

- **WHEN** the index is rewritten
- **THEN** board.yaml, column.yaml and task YAML files remain unchanged

#### Scenario: Index is excluded from version control

- **WHEN** the project follows the documented setup
- **THEN** `.ikanban/.index/` is git-ignored and derived data is not committed
