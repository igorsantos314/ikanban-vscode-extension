# Design

## Context

The repository currently ships only the VS Code extension: a React webview built with Vite (`src/webview`) and a static-set of brand files under `resources/`. There is no public website, no page build pipeline outside the extension, and no deployment configuration. The README is the only long-form introduction.

The landing page is additive and must not couple itself to the extension build, its dependencies or its VS Code theme variables, because it will be hosted on a normal static host and opened outside VS Code. See `proposal.md` for the motivation and `specs/landing-page/spec.md` for the behavioral contract.

## Goals / Non-Goals

**Goals:**

- Deliver a polished, fast, fully static `web/` site that can be deployed by copying the folder to any static host.
- Present iKanban as a credible product with a board preview, concrete features and an honest installation path.
- Keep the page usable without JavaScript and accessible from a keyboard.
- Keep the repository's extension package unchanged in content and size.

**Non-Goals:**

- No marketplace purchase/install flow, analytics, cookie banner, contact form, CMS or backend.
- No changes to the extension webview, its Tailwind setup or its build scripts.
- No automated browser test suite or new runtime dependency for the site.
- No final public domain or canonical URL decision; deployment-specific metadata remains configurable.

## Decisions

### 1. Three plain files plus local assets, no build pipeline

Use `web/index.html`, `web/styles.css` and `web/script.js`, with `web/assets/` holding the logo/icon copies. The site is opened directly by a static server and has no dependency on npm, Vite or Tailwind.

- Why: the user explicitly asked for HTML, CSS and JS files; a landing page does not benefit from the extension's toolchain; deployment becomes a folder copy.
- Alternatives considered: adding a second Vite entry point (couples the site to the extension build and package), or a component framework (unnecessary weight and runtime).

### 2. Dark, product-led visual language derived from the board

Use a dark navy canvas, layered slate surfaces, the board's green/blue/amber accents and a restrained indigo-to-teal gradient for emphasis. Typography uses a system sans-serif stack for UI copy and a monospace stack for YAML and commands. The hero and showcase are composed from CSS/HTML, not a screenshot.

- Why: the extension already has a refined dark board identity; a matching page feels like the same product. A CSS-built mockup stays sharp at every density, can be updated with the product and adds no image weight.
- Alternatives considered: light marketing theme (disconnects from the product), stock photography (generic, adds third-party assets), captured screenshots (stale and resolution-bound).

### 3. Content-first sections with a single narrative

The page flows through: hero (what/why + CTAs), board showcase with YAML evidence, feature grid, three-step "how it works", an AI and local LLM section built around the portable `SKILL.md`, a separate SDD benefits section, installation/quick start, FAQ, author and footer. Navigation labels mirror the section headings, with one "AI & SDD" entry pointing at the AI section.

- Why: each section answers the next likely question from a first-time visitor and gives the page clear visual rhythm. AI/LLM capability and SDD are the differentiators the user wants surfaced, so they get their own blocks rather than one feature card.
- Alternatives considered: a long single feature list (harder to scan), a documentation-style page (wrong audience for a landing page), burying AI/SDD inside the feature grid (under-sells the workflow).

### 4. Copy in English, claims grounded in the README

All visible copy is English. The product is described as a "local Kanban" board, never "local-first". Product claims are limited to behavior already documented in `README.md`: local YAML storage, no account/server, VS Code commands, drag-and-drop and keyboard moves, checklists, deadlines, tags, validation, pagination and the AI skill. The AI section explains the bring-your-own-LLM workflow through `SKILL.md` and does not imply a hosted model or a direct runtime API. The SDD section explains the workflow benefits of pairing iKanban with structured specs and tasks, using low-cost models such as DeepSeek V4.1 Flash 1017 as an example. The installation section offers the repository path today (clone/build/VSIX or F5) instead of implying a marketplace listing.

- Why: matches the requested language and positioning, avoids marketing claims the product cannot back today, and keeps the page maintainable alongside the README.
- Alternatives considered: Portuguese copy (replaced at the user's request), aspirational marketplace CTAs (misleading until published), presenting AI as a built-in service (contradicts the provider-neutral skill design).

### 5. Progressive enhancement, no hidden content without JavaScript

The HTML contains every section and link. JavaScript adds the mobile navigation toggle (`aria-expanded`, Escape and link dismissal), scroll-spy active state, reveal-on-scroll using `IntersectionObserver` with an immediate fallback, copy-to-clipboard with an `aria-live` status, and the footer year. Reveal styles are applied only when a `js` class is present, so a script failure cannot hide content.

- Why: satisfies the spec's no-JS scenario and keeps enhancement optional.
- Alternatives considered: a JavaScript-rendered page (fails without JS), CSS-only scroll effects (no accessible state/announcement).

### 6. Accessibility and motion are part of the visual system

Provide a skip link, semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1`, ordered headings, visible `:focus-visible` rings, sufficient contrast, descriptive link labels, and `prefers-reduced-motion` handling in both CSS and the reveal logic.

- Why: the page is a public presentation of an accessibility-conscious product and must work for keyboard and assistive-technology visitors.
- Alternatives considered: animation-first hero effects (risk for motion sensitivity and no benefit).

### 7. Self-contained assets and privacy-respecting metadata

Copy `resources/ikanban.svg` and `resources/icon.png` into `web/assets/` so `web/` can be deployed alone. The page uses no external fonts, scripts or trackers. Metadata uses English copy and includes `lang="en"`, title, description, theme color, favicon, Open Graph and Twitter tags; `og:image` points at the local social image and the canonical URL is left for deployment configuration.

- Why: aligns with iKanban's local/no-network positioning and keeps the page portable.
- Alternatives considered: hotlinking `resources/` (breaks standalone deploys), external font CDN (extra request and privacy cost).

### 8. AI and SDD presented as workflows, not magic

The AI section uses a small "agent session" panel: a prompt, a short assistant response, the `iKanban: Install AI Skill` command, and the `.agents/skills/ikanban/SKILL.md` path. The SDD section uses a compact Spec → Tasks → Board → Code flow with benefit cards and a subtle callout for low-cost models such as DeepSeek V4.1 Flash 1017. Both are CSS/HTML compositions; no chat widget, API call or fake live data.

- Why: makes the workflow concrete and credible while staying honest about the provider-neutral skill contract.
- Alternatives considered: a fake chat box with animated typing (implies a built-in assistant), a generic AI icon grid (does not explain the integration), omitting the SKILL.md path (loses the actionable detail).

### 9. Keep the site out of the extension package

Add `web/**` to `.vscodeignore` and add a short, clearly labeled landing-page link to `README.md`.

- Why: the site is repository content, not extension runtime content. The link makes it discoverable.
- Alternatives considered: shipping the page inside the VSIX (unnecessary payload), no README link (page stays undiscoverable).

## Risks / Trade-offs

- **Copy drifts from the product** → Keep claims tied to `README.md`, and review both when features change.
- **AI positioning overpromises** → Explicitly frame `SKILL.md` as a bring-your-own assistant contract and state that there is no hosted model or mandatory cloud service.
- **SDD positioning overpromises** → Present SDD as a workflow benefit and the low-cost model as an example, not as an automatic feature of the extension.
- **Asset duplication between `resources/` and `web/assets/`** → Document the source of the copies in the tasks and keep the filenames identical for easy diffing.
- **Reveal animations hide content when JavaScript partially fails** → Gate reveal styles behind a `js` class added by the script, and reveal immediately when `IntersectionObserver` is unavailable or reduced motion is requested.
- **Open Graph images need absolute URLs in some crawlers** → Use a local image and document the deployment-time replacement of relative URLs/canonical metadata in the page comments.
- **Landing assets accidentally shipped in the VSIX** → Add `web/**` to `.vscodeignore` and verify with the packaging output/`vsce ls` during implementation.
- **The CSS board mockup could diverge from the real UI** → Reuse real column names, task terminology and the board's visual tokens; treat it as illustrative, not a pixel-perfect screenshot.

## Migration Plan

Additive change. Deploy by copying `web/` to any static host. Rollback consists of removing `web/`, the README link and the `.vscodeignore` entry; no data or extension state is affected.

## Open Questions

- The final public URL/domain is unknown. It only affects the canonical and absolute Open Graph URLs, which can be filled in at deployment time without changing the page structure, specs or tasks.
