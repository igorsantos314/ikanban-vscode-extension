# Spec Delta

## ADDED Requirements

### Requirement: Shared themed visual system

The interface SHALL use one visual system across the board and the task dialog, built from theme-derived surface layers, quiet borders, consistent corner radii, a compact typography scale and a consistent spacing rhythm. The board background, column surface, card surface, input surface and dialog surface SHALL be visually distinguishable layers rather than a single flat background. Priority treatments SHALL pair color with a readable text label, and tag treatments SHALL pair color with an icon and text label. Hover, focus, drag and disabled states SHALL use the same visual language throughout.

#### Scenario: Layered dark theme

- **WHEN** the board is displayed in a dark VS Code theme
- **THEN** the board, columns, cards, inputs and dialog use distinct layered surfaces with quiet borders and readable contrast

#### Scenario: Light and high-contrast themes

- **WHEN** the user switches to a light or high-contrast theme
- **THEN** the same hierarchy remains readable, borders remain visible and no element relies on a dark-only color

#### Scenario: Priority is not color-only

- **WHEN** a task has low, medium or high priority
- **THEN** the badge shows a tinted color treatment and the readable priority label

#### Scenario: Tag is not color-only

- **WHEN** a task has tags
- **THEN** each tag chip shows its icon and text label with a neutral chip surface, and selection states add a fill or check mark rather than changing color alone

#### Scenario: Keyboard focus remains visible

- **WHEN** the user navigates with the keyboard
- **THEN** every interactive element shows a clear focus indicator consistent with the theme

### Requirement: Board and column presentation

The board SHALL present its header as a compact toolbar with the board identity and summary on the left and grouped actions on the right. Columns SHALL render as layered panels with a colored status dot, the column title, a count pill and a header add action. A full-width add-task affordance SHALL appear at the top of each column's task list. Column reorder, edit and delete actions SHALL remain available but visually quiet until hover or keyboard focus.

#### Scenario: Column identity and count

- **WHEN** a column is displayed
- **THEN** its header shows the status dot, title and a count pill matching the number of tasks

#### Scenario: Add task at the top of the column

- **WHEN** the user views a column
- **THEN** an add-task row is visible at the top of the task list and is reachable by keyboard

#### Scenario: Quiet column actions

- **WHEN** the user is not hovering or focusing a column header
- **THEN** the reorder, edit and delete actions are visually subdued but still present and accessible

#### Scenario: Empty column

- **WHEN** a column has no tasks
- **THEN** the column shows a calm empty state that preserves the column height and the add-task affordance

#### Scenario: Narrow board

- **WHEN** the board is narrower than its columns
- **THEN** columns keep their width and the board scrolls horizontally without clipping card content

### Requirement: Task card visual hierarchy

Each task card SHALL present a compact metadata row, a prominent title, an optional description preview, neutral tag chips and a footer with checklist progress and last-updated metadata. The priority badge SHALL sit at the top right. Cards SHALL use the layered card surface, quiet border and consistent radius, with hover and drag states that do not shift surrounding layout. Long titles and descriptions SHALL wrap or truncate without breaking the card.

#### Scenario: Card hierarchy

- **WHEN** a task with priority, tags, a description, checklists and timestamps is displayed
- **THEN** the priority badge, title, description preview, tag chips and footer metadata are visually distinct and easy to scan

#### Scenario: Card without optional data

- **WHEN** a task has no description, tags or checklists
- **THEN** the card still renders a balanced layout without empty metadata placeholders

#### Scenario: Hover and drag states

- **WHEN** the user hovers over or drags a card
- **THEN** the card shows a subtle surface change and drag affordance without changing its size or moving neighbouring cards

#### Scenario: Updated metadata

- **WHEN** a task has an `updatedAt` timestamp
- **THEN** the card footer shows a readable last-updated value alongside checklist progress when present

### Requirement: Task dialog visual consistency

The task dialog SHALL use the same visual system as the board. It SHALL open as a wide, elevated surface with a header containing the task context and priority badge, a read-only metadata strip for creation and last-updated timestamps, and grouped Details, Organization and Checklists sections. Inputs, tag chips, priority badges and buttons SHALL match the board. The footer SHALL remain visible while long content scrolls, and the dialog SHALL preserve its existing focus management and keyboard behavior.

#### Scenario: Dialog header and metadata

- **WHEN** an existing task is opened
- **THEN** the dialog shows a clear header with the task context, the priority badge and a compact created/last-updated metadata strip

#### Scenario: Grouped form sections

- **WHEN** the dialog is displayed
- **THEN** title and description, column/priority/tags, and checklists are grouped into visually distinct sections with consistent spacing

#### Scenario: Matching chips and controls

- **WHEN** the user selects tags or views priorities in the dialog
- **THEN** the chips, badges, inputs and buttons use the same visual language as the corresponding board elements

#### Scenario: Long content

- **WHEN** a task has enough fields or checklist items to exceed the viewport
- **THEN** the dialog body scrolls while the header and footer remain visible

#### Scenario: Theme and accessibility preserved

- **WHEN** the user changes the theme or navigates the dialog with a keyboard
- **THEN** contrast, focus indicators, focus trapping and Escape-to-close behavior remain intact
