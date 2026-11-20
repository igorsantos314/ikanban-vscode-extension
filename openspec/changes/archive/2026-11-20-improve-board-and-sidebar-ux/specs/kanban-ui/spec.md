# Spec Delta

## MODIFIED Requirements

### Requirement: Task card presentation

Each task card SHALL display a readable title, its priority with a distinguishing icon, every assigned tag as a chip with both an icon and a text label, and checklist completion progress when checklists exist. In the default `expanded` density, cards SHALL also show a concise description preview when present and the last-updated metadata. Tags SHALL NOT communicate meaning through color alone. Long titles and descriptions SHALL wrap or truncate without breaking the layout, and special characters SHALL render literally.

#### Scenario: Card renders all metadata

- **WHEN** a task has high priority, tags `issue` and `spec`, two checklists and a description
- **THEN** the card shows the priority icon and label, both tagged chips with icons and labels, the checklist progress and a description preview

#### Scenario: Card without optional data

- **WHEN** a task has no description, no tags and no checklists
- **THEN** the card renders cleanly without empty placeholders for those fields

#### Scenario: Long unbroken text

- **WHEN** a task title or description contains a very long unbroken string
- **THEN** the card layout remains intact and the content does not overflow the column

#### Scenario: Priority icon is independent of color

- **WHEN** a task has low, medium or high priority
- **THEN** its priority indicator includes an icon that distinguishes the level, and in `expanded` density also a readable text label

### Requirement: Task drag-and-drop

The interface SHALL provide drag-and-drop for moving a task between columns and reordering it within a column. While a task is being dragged, the interface SHALL display a drag overlay that follows the pointer or keyboard movement, SHALL preview the target column and insertion position in the underlying board, and SHALL reserve space at the prospective drop position. Dropping SHALL send an authoritative move request containing the target column and target position. The interface SHALL update the persisted displayed order only after the host confirms persistence; on failure it SHALL restore the previous order and show an error. Drag-and-drop SHALL be usable with a keyboard and SHALL not rely on color or pointer-only interaction.

#### Scenario: Move between columns

- **WHEN** the user drags a task from `backlog` and drops it in `in-progress`
- **THEN** the task is sent to the host, persisted in the target column and displayed there

#### Scenario: Cross-column preview during drag

- **WHEN** the user drags a task over another column
- **THEN** the target column highlights, the insertion position is shown in that column and the source column no longer presents the task as if it were already removed

#### Scenario: Animated drop

- **WHEN** the user releases a dragged task over a valid position
- **THEN** the card animates from the overlay to its final position instead of disappearing and reappearing abruptly

#### Scenario: Reorder within a column

- **WHEN** the user drops a task above another task in the same column
- **THEN** the resulting order matches the drop position after persistence

#### Scenario: Failed drop restores state

- **WHEN** a move request fails
- **THEN** the task returns to its previous displayed position and an error is shown

#### Scenario: Keyboard move

- **WHEN** the user uses the keyboard controls exposed for a task card
- **THEN** the task can be moved to another column or position through an accessible alternative

#### Scenario: Reduced motion

- **WHEN** the user prefers reduced motion
- **THEN** drag feedback remains usable without long animations

## ADDED Requirements

### Requirement: Card density preference

The board SHALL offer a card density control with `expanded` and `compact` layouts. `expanded` SHALL be the default and SHALL preserve the complete card presentation. `compact` SHALL show only the task title, a priority icon, checklist progress and tag icons, omitting the description preview, tag text labels and last-updated metadata. The selected density SHALL be persisted and restored for the workspace, SHALL apply to every card at once, and SHALL remain switchable without reloading the board. Both densities SHALL keep the card's edit, delete and move actions reachable by pointer and keyboard.

#### Scenario: Switch to compact

- **WHEN** the user selects the compact density
- **THEN** every card immediately shows only the title, priority icon, checklist progress and tag icons

#### Scenario: Switch back to expanded

- **WHEN** the user selects the expanded density
- **THEN** descriptions, tag labels and last-updated metadata reappear without changing the board data

#### Scenario: Density persists

- **WHEN** the user reloads or reopens the board after choosing compact
- **THEN** the board restores the compact density for that workspace

#### Scenario: Default density

- **WHEN** the workspace has no saved density preference
- **THEN** the board uses the expanded density

#### Scenario: Compact cards remain usable

- **WHEN** a task is displayed in compact density and the user hovers, focuses or navigates to it with the keyboard
- **THEN** the task can still be opened, deleted and moved, and the priority and tags expose accessible names despite their icon-only presentation

### Requirement: Checklist progress display

For a task with checklists, the card SHALL show derived checklist progress as a checklist icon, a `completed/total` count and a proportional progress bar. The progress bar SHALL convey its value to assistive technology and SHALL NOT be the only indicator of progress. The progress SHALL be computed from checklist item state and SHALL NOT be persisted as a separate counter.

#### Scenario: Partial progress

- **WHEN** a task has checklists with three completed items out of five
- **THEN** the card shows `3/5` and a progress bar filled to three fifths

#### Scenario: Complete progress

- **WHEN** every checklist item is complete
- **THEN** the card shows the full count with a fully filled progress bar and the complete state is announced accessibly

#### Scenario: No checklists

- **WHEN** a task has no checklists or no checklist items
- **THEN** the card does not show a checklist progress element
