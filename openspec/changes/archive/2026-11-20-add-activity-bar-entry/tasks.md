# Tasks

## 1. Update the VS Code baseline

- [x] 1.1 Set `devDependencies["@types/vscode"]` to `^1.146.0` in `package.json`, run `npm install`, and verify `node -p "require('./node_modules/@types/vscode/package.json').version"` reports the latest published 1.146.x release.
- [x] 1.2 Set `engines.vscode` to `^1.147.0` in `package.json` and verify `node -p "require('./package.json').engines.vscode"` reports `^1.147.0` with `@types/vscode` not exceeding it.
- [x] 1.3 Update the README requirement from VS Code 1.146 to 1.147 or newer and verify the documented requirement matches `package.json`.

## 2. Add the Activity Bar contribution

- [x] 2.1 Add `resources/ikanban.svg` as a 24x24 monochrome icon using `currentColor`, and verify it is not excluded by `.vscodeignore` and is listed by `npx vsce ls`.
- [x] 2.2 Add `contributes.viewsContainers.activitybar` for container `ikanban` and `contributes.views.ikanban` for a single `webview` view `ikanban.home` in `package.json`, and verify the manifest parses and no `onView` activation event is added manually.
- [x] 2.3 Update README usage to describe the iKanban Activity Bar entry, the redirect to the board panel and that the Activity Bar side follows the user's VS Code layout setting.

## 3. Implement the home view and redirect

- [x] 3.1 Add `src/vscode/homeHtml.ts` with a pure static HTML builder for the home view, including a script-blocking CSP, theme-aware styles and command links for `ikanban.open`, `ikanban.initialize` and `ikanban.validate`; verify with unit tests that the HTML contains no script and includes the three command URIs.
- [x] 3.2 Add `src/vscode/homeView.ts` with a `HomeViewProvider` that configures `enableScripts: false` and `enableCommandUris: true`, renders the home HTML, redirects on resolve and on visibility transitions to visible, guards overlapping redirects, and disposes its listener; verify with unit tests using a fake `WebviewView` and an injected redirect callback.
- [x] 3.3 Register the provider in `src/extension.ts` after the commands are registered, pass a callback that runs `ikanban.open`, add the registration disposable to the extension subscriptions, and verify the four-command surface is unchanged in `npm run test:integration`.

## 4. Test, package and verify

- [x] 4.1 Add Extension Host assertions that the manifest contributes the `ikanban` Activity Bar container, the `ikanban.home` webview view and the icon resource; verify with `npm run test:integration`.
- [x] 4.2 Run `npm run check` and verify type checks, lint and all unit tests pass, including the new home view tests.
- [x] 4.3 Run `npm run test:integration` on VS Code 1.147.0 and verify all Extension Host tests pass without activation-event warnings.
- [x] 4.4 Run `npm run package`, inspect the VSIX manifest for `engines.vscode: ^1.147.0`, the views contribution and `resources/ikanban.svg`, and verify `vsce` reports no types-versus-engine compatibility error.
- [x] 4.5 Install the packaged VSIX on VS Code 1.147.0, verify `code --list-extensions --show-versions` lists `ikanban.ikanban@0.1.0`, and smoke-test that selecting the iKanban icon opens or reveals exactly one board panel.
- [x] 4.6 Add a CHANGELOG entry for the Activity Bar entry, sidebar redirect and VS Code 1.147 baseline, and verify it matches the shipped behavior.
