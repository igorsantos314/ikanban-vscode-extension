# vscode-integration Specification

## Purpose

Defines the VS Code surface of iKanban: commands, workspace selection, trust handling, the webview panel lifecycle, the typed messaging boundary, diagnostics and resource cleanup.

## Requirements

### Requirement: Command registration

The extension SHALL register exactly the commands `ikanban.initialize`, `ikanban.open`, `ikanban.createTask`, `ikanban.validate`, `ikanban.refresh` and `ikanban.installAgentSkill`. The scaffold `ikanban.helloWorld` command SHALL be removed. Commands SHALL appear in the Command Palette with clear titles. Activation SHALL occur when one of the contributed commands is invoked or when a board webview needs to be restored.

#### Scenario: Commands available

- **WHEN** the extension is activated
- **THEN** all six iKanban commands are registered and visible in the Command Palette

#### Scenario: AI skill command is available

- **WHEN** the user searches the Command Palette for the iKanban skill installer
- **THEN** `ikanban.installAgentSkill` is offered with a clear title and installs the portable skill when invoked

#### Scenario: Create task command is available

- **WHEN** the user searches the Command Palette for creating a task
- **THEN** `iKanban: Create New Task` is offered and starts the task creation flow

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

### Requirement: Activity Bar entry

The extension SHALL contribute an iKanban view container to the VS Code Activity Bar and a single home view inside it. The entry SHALL be present after installation and SHALL NOT require running a command first. Selecting the entry SHALL activate the extension and resolve the home view. The home view SHALL NOT host an editable board; the board SHALL remain in the existing editor webview panel so there is only one authoritative board surface. The Activity Bar side is controlled by the user's VS Code layout settings, and the extension SHALL NOT attempt to override it.

#### Scenario: Entry visible after installation

- **WHEN** the extension is installed and enabled
- **THEN** the iKanban icon is visible in the Activity Bar and selecting it shows the iKanban home view

#### Scenario: View activates the extension

- **WHEN** VS Code restarts with the iKanban home view visible and no iKanban command has run
- **THEN** the extension activates, resolves the home view and registers its commands normally

#### Scenario: Single board surface

- **WHEN** the iKanban home view is visible in the sidebar
- **THEN** no second editable board is rendered in the sidebar and the board panel remains the only editable board surface

#### Scenario: User-controlled placement

- **WHEN** the user places the Activity Bar on the left or on the right through VS Code settings
- **THEN** the iKanban entry follows that placement without the extension changing the layout

### Requirement: Sidebar fallback home

The home view SHALL present concise usage content and actions for Open board, Initialize board and Validate board that invoke the existing commands. It SHALL adapt to the active light, dark and high-contrast themes, remain usable in a narrow sidebar, and render without executing scripts or loading remote content.

#### Scenario: Actions use existing commands

- **WHEN** the user activates Open, Initialize or Validate from the home view
- **THEN** the corresponding existing iKanban command runs with its normal workspace, trust and error behavior

#### Scenario: Narrow sidebar

- **WHEN** the sidebar is narrow
- **THEN** the home content wraps without horizontal overflow and all actions remain reachable

#### Scenario: Theme adaptation

- **WHEN** the active theme changes
- **THEN** the home view uses theme-provided colors and remains readable

#### Scenario: Static and safe content

- **WHEN** the home view is rendered
- **THEN** its content security policy blocks scripts and remote resources, and no board or task text is injected as untrusted HTML

### Requirement: Supported VS Code baseline

The extension manifest SHALL declare `engines.vscode` at the supported baseline of `^1.147.0`, and the development `@types/vscode` version SHALL NOT exceed that baseline. The packaged VSIX SHALL install successfully on VS Code 1.147.0.

#### Scenario: Install on the current stable release

- **WHEN** the packaged VSIX is installed on VS Code 1.147.0
- **THEN** installation succeeds and the extension reports version 0.1.0 with the expected contributions

#### Scenario: Packaging validation

- **WHEN** the project is packaged with `vsce`
- **THEN** the manifest reports `engines.vscode` as `^1.147.0` and the types-versus-engine compatibility check passes

### Requirement: Create task command

The extension SHALL expose the command `ikanban.createTask` with the title `Create New Task`. The command SHALL use the same workspace-folder selection rules as the other board commands, SHALL require a trusted workspace, and SHALL load the selected board before prompting. It SHALL ask for a non-empty task title and an existing target column; when the board has only one column it SHALL use that column without asking. A cancelled prompt SHALL abort without writing. On confirmation it SHALL create a task in the chosen column with an empty description, priority `medium`, no tags and no checklists, append it after the existing tasks, and open or reveal the board panel so the user can add details in the task dialog. When the board is not initialized or has no columns, the command SHALL report an actionable error and write nothing.

#### Scenario: Create a task from the Command Palette

- **WHEN** the user runs `ikanban.createTask` in a trusted initialized workspace, enters a title and selects a column
- **THEN** the new task is persisted in that column with the default fields and the board opens or is revealed showing it

#### Scenario: Single-column board

- **WHEN** the selected board has exactly one column
- **THEN** the command uses that column without showing a column picker

#### Scenario: Title is required

- **WHEN** the user submits a blank or whitespace-only title
- **THEN** the input reports that the title is required and no task is created until a valid title is provided

#### Scenario: Cancel aborts creation

- **WHEN** the user cancels the title or column prompt
- **THEN** no task file is written and the board is unchanged

#### Scenario: Board is not initialized

- **WHEN** the user runs the command in a workspace without a board
- **THEN** the command reports that the board must be initialized first and writes no task file

#### Scenario: Untrusted workspace

- **WHEN** the user runs the command in an untrusted workspace
- **THEN** the command reports that a trusted workspace is required and writes no task file

#### Scenario: Multiple workspace folders

- **WHEN** more than one workspace folder is open
- **THEN** the command follows the same folder selection and remembered-choice rules as the other iKanban commands

#### Scenario: Creation failure

- **WHEN** task persistence fails
- **THEN** the command reports an actionable error, leaves the board unchanged and keeps the extension usable

### Requirement: State-aware Activity Bar home view

The Activity Bar home view SHALL act as a launcher and status surface. It SHALL NOT redirect to or open the board panel merely because the view is displayed or becomes visible. When the view is resolved or becomes visible, the extension SHALL determine the selected workspace folder and whether that folder contains an iKanban board, and SHALL render actions that match that state. Simply displaying the home view SHALL NOT create, open or modify any board file.

When the selected folder has an initialized board, the view SHALL offer **Open board** and **Validate board** and SHALL NOT offer **Initialize board**. When the selected folder has no board, the view SHALL offer **Initialize board** and SHALL NOT present opening an empty board as the primary action. When no workspace folder is available, the view SHALL explain that a workspace folder is required and SHALL NOT offer actions that write. In an untrusted workspace, the view SHALL explain that a trusted workspace is required before initialization or skill installation.

The view SHALL re-evaluate its state after initialization completes, after skill installation or update, when the view is refreshed and when the board is created or removed outside the extension. State-detection failures SHALL be reported without breaking the view, and later state refreshes SHALL remain possible.

#### Scenario: Initialized board

- **WHEN** the home view is shown for a workspace that already contains `.ikanban/board.yaml`
- **THEN** it offers Open board and Validate board, shows no Initialize board action, and does not open the board automatically

#### Scenario: Board not initialized

- **WHEN** the home view is shown for a workspace without a board
- **THEN** it offers Initialize board, does not present Open board as the primary action, and writes no files

#### Scenario: Initialize updates the panel

- **WHEN** the user initializes the board from the home view and initialization succeeds
- **THEN** the view refreshes to the initialized state and offers Open board instead of Initialize board

#### Scenario: External board creation

- **WHEN** a board is created or removed in the workspace while the extension is running
- **THEN** refreshing the view reflects the new board state

#### Scenario: No workspace folder

- **WHEN** the home view is shown with no workspace folder open
- **THEN** it explains that a workspace folder is required and offers no write action

#### Scenario: Untrusted workspace

- **WHEN** the home view is shown in an untrusted workspace
- **THEN** it explains that a trusted workspace is required for initialization and skill installation without writing any file

#### Scenario: State detection fails

- **WHEN** the extension cannot determine the board state
- **THEN** the view reports the failure, remains usable and does not display the failed state as current

#### Scenario: Narrow and themed presentation

- **WHEN** the home view is displayed in a narrow sidebar or with any VS Code theme
- **THEN** its content wraps without horizontal overflow, uses theme colors and loads no scripts or remote resources

### Requirement: Skill status and explicit update

The extension SHALL determine the state of the workspace agent skill by comparing `<workspace>/.agents/skills/ikanban/SKILL.md` with the skill bundled in the installed extension. The home view SHALL present **Install AI skill** when the skill is missing, **Update AI skill** when the installed skill differs from the bundled version, and an up-to-date indication when both match. Status detection SHALL NOT modify any file.

Updating SHALL be explicitly triggered by the user. When the user activates the update action, the extension SHALL replace the installed skill with the bundled version, create or replace the managed block in `AGENTS.md` while preserving all content outside that block, and report the paths written. The action SHALL be offered again after an extension update changes the bundled skill, and it SHALL follow the same workspace selection, trust and error-handling rules as the existing install command.

#### Scenario: Skill missing

- **WHEN** the selected workspace has no `.agents/skills/ikanban/SKILL.md`
- **THEN** the home view offers Install AI skill and writes nothing until the user activates it

#### Scenario: Skill current

- **WHEN** the installed skill matches the bundled skill
- **THEN** the home view indicates that the skill is up to date and does not offer an update action

#### Scenario: Extension update changes the skill

- **WHEN** the extension is updated with a different bundled skill and the workspace skill is outdated
- **THEN** the home view offers Update AI skill without rewriting the workspace automatically

#### Scenario: User updates the skill

- **WHEN** the user activates Update AI skill
- **THEN** `.agents/skills/ikanban/SKILL.md` is refreshed, the managed `AGENTS.md` block is updated, other `AGENTS.md` content is preserved and the written paths are reported

#### Scenario: Skill installation succeeds

- **WHEN** the user activates Install AI skill in a trusted workspace
- **THEN** the skill and pointer block are created, the written paths are reported and the view reflects the current skill state

#### Scenario: Untrusted workspace blocks the action

- **WHEN** the user attempts to install or update the skill in an untrusted workspace
- **THEN** the action is blocked with an explanation and no file is written

#### Scenario: No workspace folder

- **WHEN** no workspace folder is available
- **THEN** installing or updating the skill reports that a workspace folder is required and writes nothing

#### Scenario: Update fails safely

- **WHEN** the skill or `AGENTS.md` cannot be written
- **THEN** the extension reports an actionable error, does not truncate existing content and leaves the view usable

#### Scenario: Multiple workspace folders

- **WHEN** more than one workspace folder is open
- **THEN** skill status and updates use the same folder selection and remembered-choice rules as the other iKanban commands
