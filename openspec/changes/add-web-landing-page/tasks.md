# Tasks

## 1. Landing page structure and assets

- [x] 1.1 Create `web/index.html`, `web/styles.css` and `web/script.js`, then verify all three files exist and `index.html` references the local CSS and deferred JS.
- [x] 1.2 Create `web/assets/` and copy `resources/ikanban.svg` and `resources/icon.png` into it; verify the copies match the originals (checksums) and are referenced with relative paths.
- [x] 1.3 Add `web/**` to `.vscodeignore` and a short "Landing page" link to `README.md`; verify `npx vsce ls` no longer lists `web/` and the README link points to `web/index.html`.
- [x] 1.4 Update the user-facing product description in `package.json`, the `README.md` introduction/features and `src/vscode/homeHtml.ts` from "local-first" to "local Kanban", adding the AI/`SKILL.md` and SDD positioning; verify no "local-first" remains in those files and the existing tests pass.

## 2. HTML content and metadata

- [x] 2.1 Build the document head in English with `lang="en"`, descriptive title, meta description, theme color, local favicon, Open Graph and Twitter metadata; verify the page source contains no third-party stylesheet, script or font URLs.
- [x] 2.2 Add the skip link, header, wordmark, desktop navigation, mobile menu button and primary GitHub call to action; verify every navigation item targets an existing section id.
- [x] 2.3 Write the hero with the product promise, local Kanban explanation and two calls to action; verify the copy names iKanban, VS Code, local YAML files and the no-account/no-server benefit.
- [x] 2.4 Build the product showcase with an illustrative board (Backlog, In Progress, Done), task cards and a YAML snippet; verify it uses real iKanban terms and needs no external image.
- [x] 2.5 Build the feature grid covering local YAML storage, VS Code integration, drag-and-drop and keyboard moves, checklists/deadlines/tags, validation and the AI skill; verify each claim is supported by `README.md`.
- [x] 2.6 Build the three-step "how it works" section with board initialization and the paths for installing the VSIX or running the extension with `F5`; verify commands match the README setup.
- [x] 2.7 Build the installation/quick-start section with the GitHub repository link, clone/build commands and the VSIX/F5 options; verify no marketplace link is implied before publication.
- [x] 2.8 Build the FAQ with at least five questions covering cost, offline use, data location, accounts, AI agents and SDD; verify answers stay consistent with the README.
- [x] 2.9 Build the author section naming Igor Santos with the LinkedIn profile `https://www.linkedin.com/in/igor-santos-8383941a6/` and the GitHub profile/repository links, plus a footer with dynamic-year fallback and legal/product links.
- [x] 2.10 Verify all external anchors use `target="_blank"` with `rel="noopener noreferrer"` and descriptive text or accessible labels.
- [x] 2.11 Build the AI and local LLM section: explain the bring-your-own-model workflow, the `iKanban: Install AI Skill` command, the `.agents/skills/ikanban/SKILL.md` path and the fact that no hosted AI service is required; verify the copy does not claim a direct runtime model API.
- [x] 2.12 Build a separate SDD benefits section with a Spec → Tasks → Board → Code flow, reviewable-artifact and safer-edit benefits, and a low-cost model callout naming DeepSeek V4.1 Flash 1017; verify it is visually distinct from the feature grid.

## 3. CSS visual system and responsiveness

- [x] 3.1 Define CSS custom properties for the dark palette, surfaces, borders, accents, focus ring, radii, shadows and spacing; verify no external font is loaded and the page uses system sans-serif and monospace stacks.
- [x] 3.2 Implement the base layout, container widths, section rhythm, typography scale and hero composition; verify the page has one visual `h1`, consistent heading sizes and readable line lengths at 1440px.
- [x] 3.3 Style the header, navigation, mobile menu, buttons and link states, including hover and `:focus-visible`; verify every interactive element has a visible focus state.
- [x] 3.4 Style the board showcase, task cards, priority/checklist/tag details and YAML snippet so they read clearly and match the extension's slate/blue/green visual language; verify the mockup has no clipped text at desktop and mobile widths.
- [x] 3.5 Style the feature grid, steps, installation panel with copy control, FAQ details, author card and footer; verify sections are visually distinct and survive long translated text.
- [x] 3.6 Add responsive rules for 360px, 768px, 1024px and 1440px widths; verify there is no horizontal scrolling and the mobile menu is usable at 360px.
- [x] 3.7 Add accessibility styles for the skip link, focus rings, contrast and `prefers-reduced-motion`; verify reduced motion disables reveal/transition effects and the skip link appears on keyboard focus.
- [x] 3.8 Guard reveal animation styles behind a `js` class applied by the script; verify all content is visible when JavaScript is disabled.
- [x] 3.9 Style the AI agent-session panel and the SDD workflow (flow nodes, benefit cards and low-cost model callout); verify both are visually distinct from the feature grid and readable at 360px.

## 4. Progressive-enhancement JavaScript

- [x] 4.1 Implement the mobile navigation toggle with `aria-expanded`, `aria-controls`, Escape handling and closing after a link activation; verify with keyboard and pointer.
- [x] 4.2 Implement scroll-spy navigation using `IntersectionObserver` with a safe fallback, marking only the current section; verify the active item updates while scrolling and no JavaScript error appears when sections are missing.
- [x] 4.3 Implement reveal-on-scroll for section content with an immediate fallback when `IntersectionObserver` is unavailable or reduced motion is requested; verify no content stays hidden after load or after disabling JavaScript mid-session.
- [x] 4.4 Implement copy-to-clipboard for the installation command with `navigator.clipboard`, a legacy fallback, an `aria-live` status and a reset state; verify success and failure announcements.
- [x] 4.5 Set the footer year from `new Date()` with a static fallback; verify the rendered year matches the current year.
- [x] 4.6 Wrap enhancement initialization defensively so missing elements or a blocked API do not throw; verify the browser console stays free of errors and the base page still works.

## 5. Verification and integration

- [x] 5.1 Serve `web/` with a local static server and check every internal anchor, CSS, JS, image and favicon returns a successful response; verify external URLs use the repository and confirmed LinkedIn profile.
- [x] 5.2 Perform a manual responsive pass at 360px, 768px, 1024px and 1440px; verify no overflow, readable text, reachable menu and visible primary actions.
- [x] 5.3 Perform a keyboard and no-JavaScript pass: tab through the page, use the skip link and menu, open FAQ items and confirm all content remains readable with scripts disabled.
- [x] 5.4 Run `npm run check` to confirm the existing extension test/type/lint suites still pass after the description, README and `.vscodeignore` changes.
- [x] 5.5 Run the packaging command (or `npx vsce ls`) and confirm the VSIX excludes `web/` while the README link and extension assets remain intact.
- [x] 5.6 Verify the page is fully English, uses "local Kanban" instead of "local-first", and that the AI/SKILL.md and SDD sections make only claims supported by the README and current extension behavior.
- [x] 5.7 Add a `CHANGELOG.md` entry describing the new English landing page, the AI/SKILL.md and SDD positioning, and verify the entry sits under the current unreleased section.
