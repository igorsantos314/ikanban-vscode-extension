# Spec Delta

## ADDED Requirements

### Requirement: Task timestamp metadata in the dialog

When an existing task is opened in the reusable task dialog, the dialog SHALL display its creation and last-updated timestamps as read-only metadata. The values SHALL come from the persisted task and SHALL be formatted for the user's locale, while each value SHALL also remain machine-readable through a `<time>` element carrying the original ISO 8601 UTC value. The fields SHALL NOT be editable. The creation dialog SHALL NOT show timestamp metadata because the task does not exist yet. After any successful task modification, reopening the task SHALL show the unchanged creation time and the latest update time.

#### Scenario: Edit dialog shows both timestamps

- **WHEN** the user opens an existing task
- **THEN** the dialog shows labelled creation and last-updated values with readable local formatting and machine-readable `datetime` attributes

#### Scenario: Timestamps are read-only

- **WHEN** the user edits and saves other task fields
- **THEN** the dialog offers no input for the timestamps and does not submit client-calculated timestamp values

#### Scenario: Creation dialog has no timestamps

- **WHEN** the user opens the dialog to create a new task
- **THEN** no creation or last-updated metadata is displayed before the task is saved

#### Scenario: Updated time reflects the latest modification

- **WHEN** a task is updated, moved, reordered or has a checklist changed and the user reopens it
- **THEN** the last-updated value reflects the latest persisted modification and the creation value is unchanged

#### Scenario: Theme and accessibility

- **WHEN** the user switches between light, dark and high-contrast themes
- **THEN** the timestamp metadata remains readable and uses theme-provided colors and labels
