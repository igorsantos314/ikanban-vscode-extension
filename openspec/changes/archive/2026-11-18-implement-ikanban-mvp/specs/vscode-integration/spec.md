# Spec Delta

## Purpose

Defines the VS Code surface of iKanban: commands, workspace selection, trust handling, the webview panel lifecycle, the typed messaging boundary, diagnostics and resource cleanup.

## ADDED Requirements

### Requirement: Command registration

The extension SHALL register exactly the commands `ikanban.initialize`, `ikanban.open`, `ikanban.validate` and `ikanban.refresh`. The scaffold `ikanban.helloWorld` command SHALL be removed. Commands SHALL appear in the Command Palette with clear titles. Activation SHALL occur when one of the contributed commands is invoked or when a board webview needs to be restored.

#### Scenario: Commands available

- **WHEN** the extension is activated
- **THEN** all four iKanban commands are registered and visible in the Command Palette

#### Scenario: Hello World removed

- **WHEN** the user searches the Command Palette for `Hello World`
- **THEN** no iKanban Hello World command is offered

#### Scenario: Command activation

- **WHEN** the user runs `ikanban.open` before any board is open
- **THEN** the extension activates and opens or restores the board interface

### Requirement: Workspace folder selection

Before any board access, the extension SHALL determine the target workspace folder. With no open workspace folder it SHALL fail with a workspace-not-available message instead of touching the filesystem. With exactly one workspace folder it SHALL use that folder. With multiple workspace folders it SHALL ask the user to choose and SHALL remember the choice for the workspace session. If the remembered folder no longer exists, the extension SHALL ask again. Initialization SHALL use the same selection rules and SHALL operate only on the selected folder.

#### Scenario: No workspace open

- **WHEN** the user runs `ikanban.open` with no workspace folder open
- **THEN** the extension shows a message that a workspace folder is required and performs no file operation

#### Scenario: Single workspace folder

- **WHEN** exactly one workspace folder is open
- **THEN** the board uses that folder without prompting

#### Scenario: Multiple workspace folders

- **WHEN** more than one workspace folder is open and the user runs `ikanban.initialize`
- **THEN** the extension asks which folder should contain the board

#### Scenario: Remembered folder is gone

- **WHEN** the previously selected workspace folder is no longer open
- **THEN** the extension asks for a folder again instead of writing to a stale location

### Requirement: Workspace trust

The extension SHALL respect VS Code workspace trust. In an untrusted workspace, commands that modify `.ikanban` SHALL be blocked with an actionable message, and the extension SHALL NOT write, create or delete board files. Read-only display MAY be offered only when it requires no write access. The extension SHALL declare limited trust support rather than claiming full support for untrusted workspaces.

#### Scenario: Untrusted workspace blocks writes

- **WHEN** the user runs `ikanban.initialize` in an untrusted workspace
- **THEN** the extension explains that a trusted workspace is required and writes no files

#### Scenario: Trusted workspace works normally

- **WHEN** the workspace is trusted
- **THEN** initialize, open, validate and refresh operate normally

### Requirement: Webview panel lifecycle

`ikanban.open` SHALL open the Kanban interface in a webview panel in the editor area. The extension SHALL prevent unnecessary duplicate board panels, reuse the existing panel, and reveal it when requested. When the panel is reopened or revealed, the extension SHALL refresh the board state from disk. The panel SHALL display a meaningful empty or initialization state when no board exists, and SHALL show errors without crashing or closing. The panel SHALL use the active VS Code theme.

#### Scenario: Open creates one panel

- **WHEN** the user runs `ikanban.open` twice
- **THEN** only one board panel is present and the existing panel is revealed

#### Scenario: Reopen refreshes state

- **WHEN** the user closes and reopens the board after editing YAML externally
- **THEN** the panel shows the current persisted state

#### Scenario: Empty state before initialization

- **WHEN** the selected workspace has no `.ikanban/board.yaml`
- **THEN** the panel shows an initialization state with an action to initialize the board

#### Scenario: Panel survives errors

- **WHEN** loading the board fails
- **THEN** the panel remains open and displays the error with a retry action

### Requirement: Typed webview messaging

React and the extension host SHALL communicate only through a centralized typed messaging protocol. Every request SHALL include a message type, a request ID when a response is expected, and a payload. Every response SHALL include the request ID and either validated data or a structured error containing a code and a user-readable message. The protocol SHALL include the types `board/load`, `board/initialize`, `board/validate`, `column/create`, `column/update`, `column/delete`, `column/reorder`, `task/create`, `task/update`, `task/delete`, `task/move`, `checklist/create`, `checklist/update`, `checklist/delete`, `checklistItem/create`, `checklistItem/update`, `checklistItem/delete`, `checklistItem/toggle` and `file/open`. Every incoming message SHALL be validated against a runtime schema. Unknown message types, malformed payloads and missing request IDs where required SHALL be rejected with structured errors.

#### Scenario: Valid request receives a response

- **WHEN** the webview sends `task/update` with a request ID and a valid payload
- **THEN** the host replies with the same request ID and the update result or a structured error

#### Scenario: Unknown message rejected

- **WHEN** the webview sends an unregistered message type
- **THEN** the host replies with an unsupported-message error and performs no filesystem operation

#### Scenario: Malformed payload rejected

- **WHEN** a message payload fails schema validation
- **THEN** the host replies with a validation error and does not trust any client-side validation

#### Scenario: Structured error response

- **WHEN** an application use case fails
- **THEN** the response contains an error code and an actionable message without a raw stack trace

#### Scenario: Request ID correlation

- **WHEN** multiple requests are in flight
- **THEN** each response is correlated to its request by ID and cannot resolve a different request

### Requirement: Mutation handling and duplicate prevention

The host SHALL route mutations to the application layer, SHALL NOT perform filesystem operations in React, and SHALL serialize mutations. A duplicate mutation request, identified by request ID or equivalent in-flight tracking, SHALL NOT be applied twice. Client-side validation SHALL be treated as advisory only. The webview SHALL receive the authoritative result after persistence.

#### Scenario: Duplicate save is not applied twice

- **WHEN** the same task save request is delivered twice before the first completes
- **THEN** the task file is written once and both responses reflect the single result or the duplicate is rejected

#### Scenario: React never writes files

- **WHEN** the webview performs any action
- **THEN** the only effect is a protocol message handled by the extension host

#### Scenario: Host validation is authoritative

- **WHEN** the webview sends data that its own form validation should have rejected
- **THEN** the host rejects it and no invalid file is written

### Requirement: Webview security

The webview SHALL use a restrictive content security policy with a per-load nonce for scripts, SHALL load bundled assets only through secure webview URIs declared in `localResourceRoots`, and SHALL NOT allow remote script execution. Task titles, descriptions, YAML content, file names and validation messages SHALL NOT be injected as untrusted HTML.

#### Scenario: Content security policy applied

- **WHEN** the board webview is created
- **THEN** its document declares a CSP that restricts scripts to the nonce-bearing bundled script and blocks remote script sources

#### Scenario: Bundled assets load securely

- **WHEN** the webview loads the React bundle and stylesheet
- **THEN** their URIs are converted with the webview asset URI API and originate from the allowed local resource roots

#### Scenario: Task text is not HTML

- **WHEN** a task description contains HTML markup
- **THEN** it is rendered as literal text and is not interpreted as DOM

### Requirement: External change integration

The board host SHALL observe `.ikanban/**/*.yaml` through a filesystem watcher and SHALL push refreshed state to the open webview after debounced changes. Events for the extension's own writes SHALL be suppressed so they do not cause redundant reload loops. Unsaved dialog input in the webview SHALL not be overwritten by a refresh; instead, the next save SHALL produce a conflict error that the user can resolve by reloading.

#### Scenario: External change updates the open panel

- **WHEN** a YAML file changes outside iKanban
- **THEN** the open panel receives refreshed board state after the debounce interval

#### Scenario: Own write does not echo

- **WHEN** the extension persists a task
- **THEN** the watcher event for that write does not trigger an additional refresh cycle

#### Scenario: Dialog conflict surfaced

- **WHEN** the webview has unsaved task edits and a refresh reveals changed persisted content
- **THEN** the subsequent save fails with a conflict message and the dialog stays open

### Requirement: Diagnostics and validation commands

The extension SHALL maintain a dedicated diagnostic collection for iKanban, publish diagnostics from the validation layer, and clear stale diagnostics when files are fixed or deleted. `ikanban.validate` SHALL reload and validate the selected board, publish diagnostics and show a concise result summary. `ikanban.refresh` SHALL reload the board and update the open panel. File-opening requests from the interface SHALL open the affected document at the reported range when available.

#### Scenario: Validate command publishes diagnostics

- **WHEN** the user runs `ikanban.validate` on a board with invalid files
- **THEN** the Problems panel contains iKanban diagnostics and a summary message reports the issue count

#### Scenario: Validate command reports success

- **WHEN** the user runs `ikanban.validate` on a valid board
- **THEN** stale iKanban diagnostics are cleared and a success message is shown

#### Scenario: Refresh command updates the panel

- **WHEN** the user runs `ikanban.refresh` while the board is open
- **THEN** the panel receives the current persisted state

#### Scenario: Open invalid file from the UI

- **WHEN** the user activates a validation issue in the interface
- **THEN** the affected file opens in an editor at the reported location when a location is available

### Requirement: Error presentation and logging

The integration layer SHALL catch failures from use cases and messaging, SHALL present concise, actionable messages, and SHALL keep the extension and webview functional. Technical details and stack traces SHALL be written to a dedicated iKanban output channel and SHALL NOT be displayed in the webview or in user-facing error messages.

#### Scenario: Storage failure is reported

- **WHEN** a write fails
- **THEN** the user sees an actionable error and the technical detail is available in the iKanban output channel

#### Scenario: Handler failure does not crash the host

- **WHEN** a message handler throws an unexpected error
- **THEN** the host returns a structured error response and remains able to process later messages

### Requirement: Lifecycle and resource disposal

All registered commands, the webview panel, the filesystem watcher, the diagnostic collection, the output channel and debounce timers SHALL be disposed when the extension deactivates or the panel is closed. No watcher or timer SHALL continue running after disposal.

#### Scenario: Deactivation releases resources

- **WHEN** the extension deactivates
- **THEN** its commands, watcher, diagnostics, panel and timers are disposed

#### Scenario: Closing the panel stops panel work

- **WHEN** the board panel is closed
- **THEN** pending panel-specific timers are cleared and reopening starts from persisted state
