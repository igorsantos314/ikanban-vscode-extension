# Proposal

## Why

After installation, iKanban has no visible entry point: users must already know the `iKanban: Open Board` command. A dedicated Activity Bar entry makes the extension discoverable and takes users directly to the board screen. The project also targets VS Code `^1.142.0`, while the current stable release is `1.147.0`, so the declared baseline and packaging setup should be brought up to date.

## What Changes

- Contribute an `iKanban` Activity Bar view container with a single home view and a monochrome icon.
- When the home view becomes visible, redirect the user to the existing board screen by opening, revealing and refreshing the board webview panel through the existing `ikanban.open` command.
- Keep the editor webview panel as the single authoritative board UI; the sidebar SHALL NOT embed a second editable board or a second parallel data source.
- Provide fallback home content with command links for Open, Initialize and Validate when redirection cannot complete, such as no workspace folder, an untrusted workspace or a command failure.
- Raise `engines.vscode` from `^1.142.0` to `^1.147.0` to match the current stable VS Code release, and align `@types/vscode` with the latest published version (`^1.146.0`, which must remain less than or equal to the engine baseline for `vsce` validation).
- Update the README requirements and usage instructions, then repackage and verify the VSIX on VS Code 1.147.0.
- No new commands are introduced; the command surface remains `ikanban.initialize`, `ikanban.open`, `ikanban.validate` and `ikanban.refresh`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vscode-integration`: adds an Activity Bar container and home view that redirects to the board, defines the fallback behavior when redirection is unavailable, and records the supported VS Code baseline.

## Impact

- `package.json`: `contributes.viewsContainers`, `contributes.views`, `engines.vscode` and `@types/vscode`; `package-lock.json` follows the dependency update.
- New `resources/ikanban.svg` icon and new `src/vscode/homeView.ts` provider wired in `src/extension.ts`.
- README requirements and usage documentation.
- Extension Host tests covering the manifest contribution and redirect behavior, plus packaging and installation verification.
- No changes to board storage, YAML schemas, the messaging protocol or the React board UI.
- The Activity Bar can be placed on the left or right by the user; the extension contributes the entry to the Activity Bar but cannot force its side.
