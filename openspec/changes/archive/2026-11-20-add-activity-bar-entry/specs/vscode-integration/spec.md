# Spec Delta

## ADDED Requirements

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

### Requirement: Sidebar redirect to the board screen

When the home view becomes visible, the extension SHALL redirect the user to the board screen by invoking the existing open behavior: open the board panel when none exists, or reveal and refresh the existing panel. The redirect SHALL NOT initialize a board or write files. If no board exists, the board panel SHALL display its existing initialization empty state. Redirect failures SHALL be reported through the existing error path and SHALL leave the home view usable.

#### Scenario: First access opens the board

- **WHEN** the home view becomes visible and no board panel is open
- **THEN** the board panel opens in the editor area and the home view remains available in the sidebar

#### Scenario: Existing board is reused

- **WHEN** the home view becomes visible while a board panel is already open
- **THEN** the existing panel is revealed and refreshed and no duplicate panel is created

#### Scenario: Board not initialized

- **WHEN** the home view becomes visible and the selected workspace has no `.ikanban/board.yaml`
- **THEN** the board screen shows its initialization empty state and no board files are written by the redirect

#### Scenario: No workspace folder

- **WHEN** the home view becomes visible with no workspace folder open
- **THEN** the existing workspace-required error is reported and the home view remains usable

#### Scenario: Untrusted workspace

- **WHEN** the home view becomes visible in an untrusted workspace
- **THEN** the existing trusted-workspace guidance is available and the redirect writes no files

#### Scenario: Redirect failure does not break the entry point

- **WHEN** opening the board fails unexpectedly
- **THEN** the failure is reported through the iKanban output channel and error presentation, and the home view still offers its actions

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
