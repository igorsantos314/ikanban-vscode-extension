# Design

## Context

See `proposal.md` for motivation. Today `package.json` contributes only four commands; there is no `viewsContainers` or `views` contribution, so the extension has no Activity Bar presence. `kanban.open` is implemented in `src/extension.ts` as a command that resolves the workspace folder, loads the board, publishes diagnostics and calls `BoardPanel.show`. `BoardPanel` is a singleton in the editor area that reveals and refreshes an existing panel for the same workspace root. The extension also restores the panel through a webview panel serializer.

The current VS Code stable release is 1.147.0. The latest published `@types/vscode` is 1.146.0; `vsce` compares only major and minor versions, so types 1.146.0 are valid with an `engines.vscode` baseline of 1.147.0.

## Goals / Non-Goals

**Goals:**

- Add a discoverable Activity Bar entry that takes the user directly to the existing board screen.
- Reuse the existing `ikanban.open` behavior, panel singleton, diagnostics and error reporting rather than duplicating board logic.
- Provide a safe, static fallback home when the redirect cannot open a board.
- Align the declared VS Code baseline with the current stable release.

**Non-Goals:**

- Rendering an editable Kanban board, React bundle or second message client in the sidebar.
- Adding new commands beyond the existing four.
- A native tree of columns and tasks.
- Forcing the Activity Bar to the left or right; that remains a user layout setting.

## Decisions

### Use an Activity Bar view container with a webview view

Contribute `viewsContainers.activitybar` with id `ikanban` and a single `views` entry of type `webview` with id `ikanban.home`.

Rationale: VS Code only places view containers, not standalone commands, in the Activity Bar. A webview view lets the extension render a home screen and perform the redirect from the extension host. Alternatives considered:

- **`viewsWelcome` plus an empty tree view**: simpler and script-free, but it cannot automatically redirect and requires an extra click.
- **The full React board inside a webview view**: rejected because it would create a second board surface, duplicate the watcher and messaging infrastructure, and risk two clients mutating the same YAML files. The user asked for a redirect to the usage screen, not a sidebar board.

The icon is a 24x24 monochrome SVG at `resources/ikanban.svg` using `currentColor` so VS Code themes it consistently. It is added to the packaged files and must not be excluded by `.vscodeignore`.

### Redirect by invoking the existing `ikanban.open` command

`HomeViewProvider` implements `WebviewViewProvider`. On `resolveWebviewView` and on an `onDidChangeVisibility` transition to visible, it invokes `ikanban.open` through `commands.executeCommand` and keeps a redirect-in-progress guard to avoid overlapping calls. The provider imports only VS Code types and receives the redirect callback from `extension.ts`, so its state machine can be unit-tested with a fake `WebviewView` without a VS Code runtime. The static HTML builder lives in a separate `homeHtml.ts` module with no VS Code imports and is unit-tested as a pure function.

Rationale: `ikanban.open` already encapsulates workspace selection, board loading, diagnostics, panel singleton reuse, reveal/refresh and user-facing error handling. Calling it keeps one code path and one board panel. Registering the provider after the commands ensures the command exists before the first redirect. The redirect never initializes a board, so opening the entry on an uninitialized workspace reaches the existing initialization empty state without writing files.

Alternative considered: calling `BoardPanel.show` directly from the provider. Rejected because it would bypass the command's workspace resolution, refresh and error presentation, and would duplicate logic that must stay consistent with the Command Palette.

### Static, script-free home content

The home view sets `webview.options = { enableScripts: false, enableCommandUris: true }` and assigns a static HTML document with a CSP of `default-src 'none'; style-src 'unsafe-inline'` (plus `img-src` only if needed). Actions are plain links such as `command:ikanban.open`, `command:ikanban.initialize` and `command:ikanban.validate`. Styling uses VS Code theme variables (`--vscode-foreground`, `--vscode-button-*`, `--vscode-descriptionForeground`, etc.) so light, dark and high-contrast themes work without custom theme detection.

Rationale: the home only needs static guidance and command links. Avoiding scripts removes a second message protocol, avoids loading the React bundle, and keeps the security surface small. `enableCommandUris` is scoped to this view and the commands retain their own workspace and trust checks. The HTML contains only trusted static strings; no board or task content is injected.

### Redirect only while the view is visible

The provider reacts to visibility changes rather than opening the board in the background. `resolveWebviewView` fires when the view is first shown, and later reveals are handled by `onDidChangeVisibility`. The provider never calls `view.show`, so it does not move the sidebar or change the Activity Bar placement.

### Raise the baseline to VS Code 1.147.0

Set `engines.vscode` to `^1.147.0` and set `devDependencies["@types/vscode"]` to `^1.146.0` (the latest published definitions). Update the lockfile, README requirements and the packaged manifest. Keep the extension version at `0.1.0`; this change is a feature/compatibility update, not a release-version decision.

Alternative considered: leaving the engine at `^1.142.0`. Rejected because the user explicitly wants the current stable release as the baseline. Users on older VS Code releases will no longer be able to install the new VSIX; that is the intended compatibility trade-off and is documented in the README.

## Risks / Trade-offs

- **Auto-redirect on window restore can steal focus** → Only redirect when the view is actually visible and avoid calling `view.show`; the board panel reveal is the requested behavior. Users who keep the entry closed are unaffected.
- **Repeated error notifications without a workspace** → The redirect stays on the existing command path, so the normal workspace-required message is shown; the home view remains visible with its actions and no file writes occur.
- **Command URI misuse or blocked commands** → `enableCommandUris` is enabled only for the static home view; every target is one of the four audited iKanban commands, which already enforce trust and workspace rules.
- **The new VSIX cannot be installed on VS Code older than 1.147.0** → Intentional baseline change; document it in the README and verify installation on 1.147.0 during packaging.
- **Icon or view not appearing** → Add an Extension Host test that asserts the manifest contributions and packaged resource path, and verify the installed VSIX on 1.147.0.

## Migration Plan

1. Update `@types/vscode` and the lockfile, then raise `engines.vscode` to `^1.147.0`.
2. Add the icon, view contributions and provider; wire the provider into `activate` and dispose its registration with the extension context.
3. Update README requirements and usage, then build, run unit and Extension Host tests, package the VSIX and install it on VS Code 1.147.0.

Rollback is a manifest/provider revert; there is no stored-data or protocol migration.
