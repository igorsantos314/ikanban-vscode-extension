# Spec Delta

## ADDED Requirements

### Requirement: Deadline validation

The extension SHALL accept an optional task `dueAt` value and SHALL validate it as an ISO 8601 UTC timestamp containing both a calendar date and a time of day. A persisted `dueAt` that is not a valid timestamp, lacks a time, or uses an unsupported format SHALL be rejected with a schema diagnostic for the affected task file; the extension SHALL NOT coerce it, default it or silently drop it. A missing `dueAt` SHALL remain valid. The deadline value SHALL round-trip faithfully as text and SHALL NOT be converted to a date object or reformatted by serialization.

#### Scenario: Valid deadline is accepted

- **WHEN** a task file contains a valid ISO 8601 UTC `dueAt` with date and time
- **THEN** the task loads successfully and the deadline is available to the interface

#### Scenario: Missing deadline is valid

- **WHEN** a task file has no `dueAt` field
- **THEN** validation succeeds and the task has no deadline

#### Scenario: Date-only deadline is rejected

- **WHEN** a task file contains `dueAt: 2026-11-25`
- **THEN** validation reports that the deadline must include a time and the task file is left unchanged

#### Scenario: Invalid deadline is rejected

- **WHEN** a task file contains `dueAt: tomorrow at noon`
- **THEN** validation reports an invalid deadline for that file instead of defaulting it

#### Scenario: Invalid local input is rejected before writing

- **WHEN** the interface sends a deadline that does not represent a real local date and time, such as `31/02/2026 10:00`
- **THEN** the request fails validation and no task file is written or modified

#### Scenario: Deadline round-trips unchanged

- **WHEN** a valid task with a deadline is read and written without changing the deadline
- **THEN** the persisted `dueAt` text represents the same instant and no other deadline key is introduced

#### Scenario: Clearing removes the key

- **WHEN** a task update clears the deadline
- **THEN** serialization removes the `dueAt` key instead of writing an empty or null value
