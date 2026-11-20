# Spec Delta

## ADDED Requirements

### Requirement: Validation with paginated loading

Opening or refreshing the board SHALL validate only the task files in the pages being loaded, plus the board and column documents. Validation issues for unloaded task files SHALL NOT be required at load time. The explicit validate action SHALL continue to scan every column and every task file, publish complete diagnostics and report the full board result. A board that appears valid after a first-page load MAY still have invalid tasks outside the loaded pages until explicit validation runs.

#### Scenario: Load validates loaded pages

- **WHEN** a board opens and only the first page of each column is loaded
- **THEN** the board and column documents and the loaded task files are validated

#### Scenario: Unloaded invalid task is not diagnosed at load

- **WHEN** an invalid task exists outside the loaded pages
- **THEN** opening the board does not need to read or diagnose it

#### Scenario: Explicit validation scans the whole board

- **WHEN** the user runs the validate action
- **THEN** every task file is read, all diagnostics are published and the summary reflects the whole board

#### Scenario: Invalid task inside a page

- **WHEN** a page contains an invalid task file
- **THEN** the diagnostic is published, the task is omitted from that page and the other page tasks remain visible

#### Scenario: No silent corruption on load

- **WHEN** a paginated load encounters an invalid task file
- **THEN** the file is left unchanged and is never repaired or rewritten
