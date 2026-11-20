# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
