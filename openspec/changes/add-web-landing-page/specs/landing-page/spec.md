# Spec Delta

## Purpose

Provides a public, static English landing page that introduces iKanban as a local Kanban board, communicates its features and AI/LLM and SDD workflows, and directs visitors to the application repository and the author's professional profile.

## ADDED Requirements

### Requirement: Static, dependency-free delivery
The landing page SHALL be delivered as a self-contained static site inside `web/`, using plain HTML, CSS and JavaScript with no build step, package manager, server-side rendering or runtime framework. Assets referenced by the page SHALL be local to `web/` and the page SHALL render without third-party stylesheets, scripts, fonts or tracking.

#### Scenario: Opening the page from a static host
- **WHEN** `web/index.html` is served by any static file server
- **THEN** the page renders completely with local HTML, CSS, JavaScript and image assets and makes no third-party asset requests

#### Scenario: Rendering without JavaScript
- **WHEN** JavaScript is disabled or fails to load
- **THEN** all sections, text, links, navigation targets and the installation command remain visible and usable

### Requirement: English content and section structure
The landing page SHALL be written in English and SHALL present distinct, clearly separated sections covering the product value proposition, main features, how it works, AI and local LLM integration, SDD benefits, installation or quick start, frequently asked questions, the author and the application links. The document SHALL declare `lang="en"`. The page SHALL describe the product as a "local Kanban" board and SHALL NOT use the "local-first" label.

#### Scenario: First-time visitor understands the product
- **WHEN** a visitor opens the page
- **THEN** the hero states that iKanban is a local Kanban board for VS Code, that it stores tasks as YAML files and that it works with local LLMs or AI assistants

#### Scenario: Navigation reaches every section
- **WHEN** a visitor uses the header navigation
- **THEN** each navigation item moves to its corresponding visible section and the section headings describe the content below them

### Requirement: AI and local LLM integration story
The page SHALL explain how iKanban works with AI and local LLMs to manage the board. It SHALL present the portable `SKILL.md` contract as the integration mechanism, describe that an assistant with workspace access can read the skill to create, move, reorder and edit tasks, and SHALL state that the user brings their own model or assistant. The page SHALL NOT claim a bundled hosted AI service, a cloud dependency, or a direct model API integration that the extension does not provide.

#### Scenario: Visitor understands the AI workflow
- **WHEN** a visitor reaches the AI section
- **THEN** the page explains that a local LLM or coding assistant can manage the board by following the installed `SKILL.md` and that no hosted AI service is required

#### Scenario: Skill installation is actionable
- **WHEN** the AI section presents the skill installation
- **THEN** it names the `iKanban: Install AI Skill` command and the `.agents/skills/ikanban/SKILL.md` target path

### Requirement: SDD benefits as a separate topic
The page SHALL include a dedicated SDD (Spec-Driven Development) section, separate from the general feature list, describing the benefits of using iKanban alongside structured specifications and tasks. It SHALL explain that clear specs and acceptance criteria produce reviewable artifacts, smaller and more predictable prompts, and safer board edits, and SHALL mention low-cost models such as DeepSeek V4.1 Flash 1017 as a practical example.

#### Scenario: SDD benefits are discoverable
- **WHEN** a visitor reads the SDD section
- **THEN** the page connects spec-driven planning to a reviewable board workflow and names at least one low-cost model example

#### Scenario: SDD claims stay honest
- **WHEN** the page describes SDD
- **THEN** it presents SDD as a workflow benefit for using iKanban and does not claim that the extension ships an SDD engine or automatically generates specifications

### Requirement: Product showcase
The page SHALL include a visual product showcase that represents the iKanban board without depending on an external screenshot service, showing columns, task cards and the local YAML storage concept.

#### Scenario: Board preview is visible
- **WHEN** the showcase is in the viewport
- **THEN** it displays a board-like composition with named columns and task cards consistent with iKanban terminology

### Requirement: Repository, author and call-to-action links
The page SHALL link to the application repository at `https://github.com/igorsantos314/ikanban-vscode-extension` and to the author's LinkedIn profile at `https://www.linkedin.com/in/igor-santos-8383941a6/`. Primary calls to action SHALL be visually prominent and SHALL use descriptive accessible labels. Every link SHALL be a real anchor and SHALL open safely.

#### Scenario: Primary call to action reaches the repository
- **WHEN** a visitor activates the primary call to action
- **THEN** the application GitHub repository opens in a new tab without exposing the current page to `window.opener`

#### Scenario: Author section identifies Igor Santos
- **WHEN** a visitor reaches the author section
- **THEN** it names Igor Santos as the creator, links to the confirmed LinkedIn profile and provides a path back to the repository

### Requirement: Responsive layout
The landing page SHALL adapt to small, medium and large viewports. Content SHALL remain legible, controls SHALL remain reachable, and the page SHALL not introduce horizontal scrolling at any supported width.

#### Scenario: Mobile viewport
- **WHEN** the page is viewed at a width of 360 CSS pixels
- **THEN** sections stack vertically, text does not overflow its container, the menu remains operable and primary actions remain visible

#### Scenario: Desktop viewport
- **WHEN** the page is viewed at a width of 1440 CSS pixels or more
- **THEN** content is constrained to a readable measure, feature content uses multiple columns where appropriate and no element stretches indefinitely

### Requirement: Accessibility
The page SHALL use semantic landmarks and heading order, provide a keyboard-operable navigation including a visible skip link and visible focus indicators, provide alternative text for informative images, preserve readable color contrast and honor `prefers-reduced-motion`.

#### Scenario: Keyboard-only navigation
- **WHEN** a visitor navigates with the keyboard from the top of the page
- **THEN** the skip link is the first focusable element, every interactive control is reachable in a logical order and focus is always visible

#### Scenario: Reduced motion preference
- **WHEN** the visitor's system requests reduced motion
- **THEN** reveal and transition animations are disabled or reduced and content is shown without motion-dependent delays

### Requirement: Progressive enhancement
The page SHALL use JavaScript only to enhance a fully functional base document. Enhancements SHALL include a mobile navigation toggle with correct expanded state, active-section highlighting, reveal-on-scroll that does not hide content permanently, and copy-to-clipboard for the installation command with a non-clipboard fallback.

#### Scenario: Copy installation command
- **WHEN** the visitor activates the copy control for the installation command
- **THEN** the command is copied to the clipboard and the control announces the success state; if copying is unavailable, the command remains selectable and the failure is announced

#### Scenario: Script fails to initialize
- **WHEN** the enhancement script throws or is blocked
- **THEN** the page remains readable, the navigation links still work and no content is left invisible

### Requirement: Document metadata and sharing
The page SHALL provide a descriptive title, meta description, canonical-friendly metadata, Open Graph and Twitter card metadata, a theme color and a favicon derived from the local iKanban brand assets.

#### Scenario: Shared link preview
- **WHEN** the page URL is shared in a client that reads Open Graph metadata
- **THEN** the preview exposes the iKanban title, description and a local social image

### Requirement: Product description consistency
The landing page, repository README, extension package description and Activity Bar home description SHALL use "local Kanban" rather than "local-first" and SHALL mention the AI/`SKILL.md` workflow. The README SHALL also mention the SDD and low-cost-model positioning.

#### Scenario: Repository metadata aligns with the page
- **WHEN** a visitor reads the extension description or the README introduction
- **THEN** the product is described as a local Kanban board for VS Code and the AI-ready skill workflow is mentioned

#### Scenario: Landing page link is present
- **WHEN** a visitor reads the repository README
- **THEN** a clearly labeled link leads to the landing page entry point

### Requirement: Packaging isolation
Adding the landing page SHALL NOT increase or alter the contents of the published VS Code extension package.

#### Scenario: Extension package excludes the site
- **WHEN** the extension is packaged
- **THEN** files under `web/` are excluded from the VSIX while the extension runtime continues to include its existing assets
