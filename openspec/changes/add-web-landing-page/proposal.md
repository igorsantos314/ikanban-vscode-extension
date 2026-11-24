# Proposal

## Why

iKanban has a developer-facing README and repository, but no public landing page that explains the product quickly to a first-time visitor. A polished, static page gives the project a credible front door, showcases the local Kanban board and its AI/LLM workflow, and centralizes the GitHub and author links.

## What Changes

- Add a new `web/` folder at the repository root containing a self-contained static landing page:
  - `index.html`, `styles.css` and `script.js`, with no framework and no build step.
  - `web/assets/` for the brand images used by the page.
- Write the page in English with a professional, technical, friendly tone. The page language, metadata, navigation, UI labels, summaries and FAQ are all English.
- Stop calling the product "local-first": use "local Kanban" (and equivalent plain English) instead.
- Structure the page into clear sections: header/navigation, hero with primary calls to action, product showcase (board mockup), feature grid, how it works, AI and local LLM integration, SDD benefits, installation/quick start, FAQ, author section with LinkedIn, and footer with the application GitHub.
- Explain the AI/LLM workflow accurately: iKanban is AI-ready through a portable `SKILL.md` contract that lets a local LLM or coding assistant read the board rules and manage columns and tasks. The page must not claim a bundled hosted AI service or a direct runtime model API that the extension does not provide.
- Add a separate SDD (Spec-Driven Development) topic that explains the benefits of pairing iKanban with structured specs and tasks, especially when working with low-cost models such as DeepSeek V4.1 Flash 1017: clear acceptance criteria, reviewable artifacts, smaller prompts and safer edits.
- Include the application GitHub (`https://github.com/igorsantos314/ikanban-vscode-extension`) and the author profile (`Igor Santos`, `https://www.linkedin.com/in/igor-santos-8383941a6/`).
- Implement progressive-enhancement JavaScript only where it improves the experience: mobile navigation, scroll-spy navigation, reveal-on-scroll, copy-to-clipboard for the install command, and current year in the footer. The page must remain fully readable and navigable without JavaScript.
- Make the page responsive, keyboard accessible, semantic, theme-aware and respectful of `prefers-reduced-motion`.
- Link the landing page from the README so it is discoverable.
- Align the application's own user-facing description with the new positioning: `package.json`, the README introduction/feature list and the Activity Bar home view stop using "local-first" and mention the AI/SKILL.md workflow and SDD.
- Exclude `web/` from the packaged VS Code extension so the landing assets are not shipped in the VSIX.

## Capabilities

### New Capabilities

- `landing-page`: A static, deployable, English marketing page under `web/` that introduces iKanban as a local Kanban board, presents its features, AI/LLM and SDD workflow, installation path, GitHub repository and the author's LinkedIn, and behaves accessibly across screen sizes.

### Modified Capabilities

<!-- No existing capability requirements change. -->

## Impact

* New static files under `web/` (`index.html`, `styles.css`, `script.js`, `assets/`); no production dependency, bundler or server requirement.
- User-facing product copy in `package.json`, `README.md` and `src/vscode/homeHtml.ts` changes from "local-first" to "local Kanban" and gains AI/SKILL.md and SDD positioning.
- `.vscodeignore` gains a `web/**` exclusion so the VSIX contents and size are unaffected except for the planned documentation link.
- `README.md` gains a short link to the landing page.
- No changes to extension runtime behavior, the webview, board storage or the YAML schema.
