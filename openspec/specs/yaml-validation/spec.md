# yaml-validation Specification

## Purpose

Defines how every YAML document is parsed, validated, reported and safely round-tripped so invalid data never becomes a plausible-looking domain entity and never causes data loss.

## Requirements

### Requirement: Two-stage validation pipeline

Every discovered YAML document SHALL be validated before it is converted into a domain entity. Validation SHALL first perform YAML syntax validation and then, only for syntactically valid documents, schema and semantic validation. Invalid documents SHALL be rejected rather than coerced, defaulted or repaired. Validation SHALL never delete, overwrite or rewrite the invalid source file.

#### Scenario: Syntax failure stops schema validation

- **WHEN** a task file contains malformed YAML
- **THEN** the extension reports the syntax error and does not attempt to build a task from partial data

#### Scenario: Valid syntax with invalid schema

- **WHEN** a task file is syntactically valid but has no title
- **THEN** the extension reports a schema validation error for the missing title

#### Scenario: Invalid source is preserved

- **WHEN** validation fails for any file
- **THEN** the original bytes of that file remain unchanged

### Requirement: YAML syntax validation

The YAML parser SHALL be configured to detect duplicate mapping keys and to report syntax errors instead of silently accepting them. The extension SHALL detect invalid indentation, invalid sequences and mappings, duplicate keys, unclosed quoted strings, malformed arrays, unexpected document shapes and multiple YAML documents in a file where exactly one is expected. Syntax diagnostics SHALL include line and column information when the parser provides it and a human-readable message otherwise.

#### Scenario: Invalid indentation

- **WHEN** a task file uses inconsistent indentation that produces invalid YAML
- **THEN** a syntax diagnostic identifies the file and the affected line and column

#### Scenario: Unclosed quoted string

- **WHEN** a task title starts with a quote that is never closed
- **THEN** a syntax diagnostic reports the unclosed string

#### Scenario: Duplicate mapping key

- **WHEN** a document contains `title` twice at the same level
- **THEN** a syntax diagnostic reports the duplicate key instead of keeping an arbitrary value

#### Scenario: Malformed array

- **WHEN** the `tags` value is malformed as a YAML sequence
- **THEN** a syntax diagnostic is published for the file

#### Scenario: Unexpected document structure

- **WHEN** a task file contains a top-level scalar or sequence instead of a mapping
- **THEN** validation reports an unexpected document structure

#### Scenario: Multiple documents

- **WHEN** a task or column file contains more than one YAML document
- **THEN** validation reports that exactly one document is expected and rejects the file

### Requirement: Schema and semantic validation

Syntactically valid documents SHALL be validated against runtime schemas that enforce required fields, field types, supported enum values, supported schema version, ISO 8601 timestamps, non-negative integer positions, safe identifiers and valid checklist structures. The extension SHALL reject missing required fields, wrong types, `null` where a value is required, unknown tags and unsupported priorities. It SHALL NOT replace malformed persisted values with defaults.

#### Scenario: Missing required field

- **WHEN** `board.yaml` has no `name`
- **THEN** validation reports that the board name is required

#### Scenario: Invalid field type

- **WHEN** a task `position` is the string `first`
- **THEN** validation reports that the position must be an integer

#### Scenario: Invalid enum value

- **WHEN** a task priority is `urgent`
- **THEN** validation reports the supported priority values

#### Scenario: Invalid timestamp

- **WHEN** a task `createdAt` is not a valid ISO 8601 timestamp
- **THEN** validation reports the invalid timestamp

#### Scenario: Invalid position

- **WHEN** a task has a negative position
- **THEN** validation reports that the position must be a non-negative integer

#### Scenario: Unsupported schema version

- **WHEN** `board.yaml` declares a schema version newer than the supported version
- **THEN** validation reports that the schema version is unsupported and does not load the board as a current board

#### Scenario: No silent defaults

- **WHEN** a persisted task omits its priority
- **THEN** validation rejects the task instead of assigning `medium`

### Requirement: Cross-document integrity

After individual documents are valid, the extension SHALL validate relationships between files. It SHALL verify that every column in `board.yaml` exists, contains a valid `column.yaml`, matches its directory name and appears only once; that every referenced column configuration declares a safe ID matching its directory; that task IDs are unique across the board; that each task filename matches its task ID; and that checklist IDs are unique within a task and checklist item IDs unique within a checklist. Missing referenced directories and missing `column.yaml` files SHALL be reported. Directories not referenced by `board.yaml` SHALL produce a warning and SHALL NOT be modified.

#### Scenario: Board references missing column

- **WHEN** `board.yaml` lists `review` but `.ikanban/review` is absent
- **THEN** validation reports the missing referenced column directory

#### Scenario: Column configuration missing

- **WHEN** a referenced column directory has no `column.yaml`
- **THEN** validation reports the missing column configuration

#### Scenario: Directory and ID mismatch

- **WHEN** `.ikanban/review/column.yaml` declares `id: done`
- **THEN** validation reports that the directory name and column ID differ

#### Scenario: Duplicate column reference

- **WHEN** `board.yaml` contains the same column ID twice
- **THEN** validation reports a duplicate column reference

#### Scenario: Duplicate task ID across files

- **WHEN** two task files declare the same task ID
- **THEN** validation reports the duplicate ID for both files

#### Scenario: Task filename mismatch

- **WHEN** a task file's name does not match its declared task ID
- **THEN** validation reports a task identity mismatch

#### Scenario: Duplicate checklist IDs

- **WHEN** one task contains two checklists with the same ID
- **THEN** validation reports the duplicate checklist ID within that task

#### Scenario: Duplicate checklist item IDs

- **WHEN** one checklist contains two items with the same ID
- **THEN** validation reports the duplicate item ID within that checklist

#### Scenario: Unreferenced directory is warned

- **WHEN** a valid column directory is not listed in `board.yaml`
- **THEN** a warning diagnostic is published and the directory is preserved

### Requirement: Partial board loading

When the board configuration is valid, the extension SHALL preserve access to valid columns and tasks even when other files are invalid. An invalid task SHALL be omitted from the displayed board, SHALL produce a diagnostic, and SHALL NOT prevent valid tasks in the same or other columns from loading. If `board.yaml` itself is invalid, the extension SHALL report the problem and SHALL NOT invent a board or overwrite the configuration. A malformed or corrupted file SHALL never crash the extension or close the board panel.

#### Scenario: Mixed valid and invalid tasks

- **WHEN** a column contains three valid tasks and one corrupted task file
- **THEN** the three valid tasks are displayed and the corrupted file has a diagnostic

#### Scenario: Invalid board configuration

- **WHEN** `board.yaml` is malformed
- **THEN** the board reports a configuration error, keeps the panel open, and leaves the file untouched

#### Scenario: Corrupted task during refresh

- **WHEN** a previously valid task file becomes corrupted externally
- **THEN** the board refreshes without that task, shows the validation problem and remains usable

#### Scenario: No automatic repair

- **WHEN** any invalid file is detected
- **THEN** the extension does not rewrite, normalize, truncate or delete it

### Requirement: Validation diagnostics

The extension SHALL publish validation results to a dedicated VS Code diagnostic collection. Each diagnostic SHALL include the affected file URI, a severity, a human-readable message, a source range when reliably available, and the relevant YAML property or domain path. Parser diagnostics SHALL use the reported line and column. For schema and cross-file errors where an exact range cannot be determined reliably, the diagnostic SHALL use a safe conservative fallback range instead of an invented precise location. The user SHALL be able to navigate to the affected file. Diagnostics SHALL be cleared or updated when the file becomes valid or is deleted. The Kanban interface SHALL display a visible validation status.

#### Scenario: Diagnostic links to the file

- **WHEN** a malformed task file is detected
- **THEN** the Problems panel shows a diagnostic associated with that file URI and opening it navigates to the file

#### Scenario: Line and column reported

- **WHEN** the YAML parser reports an error at a known position
- **THEN** the diagnostic range starts at that line and column

#### Scenario: Safe fallback range

- **WHEN** a cross-file duplicate ID error has no reliable source range
- **THEN** the diagnostic uses a safe fallback range within the affected document

#### Scenario: Diagnostics clear after correction

- **WHEN** an invalid YAML file is corrected externally and the board refreshes
- **THEN** its diagnostics are removed

#### Scenario: Diagnostics clear after deletion

- **WHEN** an invalid task file is deleted
- **THEN** its diagnostics are removed

#### Scenario: Validation status in the UI

- **WHEN** the board contains validation issues
- **THEN** the Kanban interface shows a visible validation status with an issue count

### Requirement: Consistent application errors

Validation and persistence failures SHALL be represented with consistent error categories, including validation, not-found, duplicate entity, storage, conflict, unsupported schema version and workspace unavailable. User-facing messages SHALL be actionable and SHALL NOT expose raw stack traces. Technical details SHALL be logged to an extension output channel when useful.

#### Scenario: Conflict message

- **WHEN** a save conflicts with an external edit
- **THEN** the user sees a message explaining that the task changed outside iKanban and should be reloaded

#### Scenario: Validation message

- **WHEN** a task title is missing
- **THEN** the user sees `Task title is required.` or an equivalent actionable message

#### Scenario: No stack trace in the interface

- **WHEN** a storage failure occurs
- **THEN** the interface shows a concise error and technical details are written only to the output channel

### Requirement: Faithful YAML round-trip

Serialization and parsing SHALL preserve the semantic value of task and column text. The extension SHALL correctly round-trip Portuguese accented characters, other Unicode, emoji, CJK characters, single and double quotes, colons, hash symbols, backslashes, forward slashes, multiline descriptions, blank lines, leading and trailing spaces, YAML reserved-looking text such as `true`, `false` and `null`, date-like and numeric-looking strings, anchor and alias symbols, very long descriptions, Markdown content and HTML-like content. Empty optional fields SHALL remain valid. CRLF and LF input line endings SHALL both load correctly.

#### Scenario: Unicode round-trip

- **WHEN** a task title contains `Ação — 日本語 — 🚀` and is saved and reloaded
- **THEN** the title is exactly equal to the original string

#### Scenario: Reserved words remain text

- **WHEN** a task description is exactly `true`, `false` or `null`
- **THEN** it reloads as the corresponding string rather than a boolean or null

#### Scenario: Quotes and punctuation

- **WHEN** text contains `It's "quoted": #1 \ path/to/file`
- **THEN** the reloaded value is semantically identical

#### Scenario: Multiline description

- **WHEN** a description contains multiple paragraphs, blank lines and leading spaces
- **THEN** the reloaded description preserves those line breaks and spaces

#### Scenario: CRLF input

- **WHEN** a valid task file uses CRLF line endings
- **THEN** it loads successfully and an update persists a valid single-document YAML file

#### Scenario: Long description

- **WHEN** a task has a very long description
- **THEN** it is persisted and reloaded without truncation

### Requirement: Safe YAML processing

YAML processing SHALL NOT execute content or construct arbitrary application objects from data. Custom tags SHALL NOT be executed. Untrusted text SHALL be treated as data only. Parsing failures SHALL be contained and reported as diagnostics or application errors rather than unhandled exceptions.

#### Scenario: Custom tag content is inert

- **WHEN** a YAML value contains a custom tag-like token
- **THEN** it is not executed and the document is either parsed as data or rejected with a validation error

#### Scenario: Parser failure is contained

- **WHEN** a document triggers a parser failure
- **THEN** the extension reports an error for that file without terminating the extension host
