# Spec Delta

## ADDED Requirements

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

The extension SHALL determine the state of the workspace agent skill by comparing `<workspace>/skills/ikanban/SKILL.md` with the skill bundled in the installed extension. The home view SHALL present **Install AI skill** when the skill is missing, **Update AI skill** when the installed skill differs from the bundled version, and an up-to-date indication when both match. Status detection SHALL NOT modify any file.

Updating SHALL be explicitly triggered by the user. When the user activates the update action, the extension SHALL replace the installed skill with the bundled version, create or replace the managed block in `AGENTS.md` while preserving all content outside that block, and report the paths written. The action SHALL be offered again after an extension update changes the bundled skill, and it SHALL follow the same workspace selection, trust and error-handling rules as the existing install command.

#### Scenario: Skill missing

- **WHEN** the selected workspace has no `skills/ikanban/SKILL.md`
- **THEN** the home view offers Install AI skill and writes nothing until the user activates it

#### Scenario: Skill current

- **WHEN** the installed skill matches the bundled skill
- **THEN** the home view indicates that the skill is up to date and does not offer an update action

#### Scenario: Extension update changes the skill

- **WHEN** the extension is updated with a different bundled skill and the workspace skill is outdated
- **THEN** the home view offers Update AI skill without rewriting the workspace automatically

#### Scenario: User updates the skill

- **WHEN** the user activates Update AI skill
- **THEN** `skills/ikanban/SKILL.md` is refreshed, the managed `AGENTS.md` block is updated, other `AGENTS.md` content is preserved and the written paths are reported

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
