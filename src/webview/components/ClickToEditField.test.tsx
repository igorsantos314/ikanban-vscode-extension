import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ClickToEditInput, ClickToEditTextarea } from './ClickToEditField';

function Harness({
  initiallyEditable = false,
  reveal = false,
}: {
  initiallyEditable?: boolean;
  reveal?: boolean;
}) {
  const [value, setValue] = useState('Existing');
  return (
    <>
      <ClickToEditInput
        aria-label="Title"
        value={value}
        onValueChange={setValue}
        initiallyEditable={initiallyEditable}
        reveal={reveal}
      />
      <ClickToEditTextarea
        aria-label="Description"
        value={value}
        onValueChange={setValue}
        initiallyEditable={initiallyEditable}
        reveal={reveal}
      />
    </>
  );
}

describe('ClickToEditField', () => {
  it('starts read-only and enables on click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const title = screen.getByLabelText('Title');
    expect(title).toHaveAttribute('readonly');
    await user.click(title);
    expect(title).not.toHaveAttribute('readonly');
    await user.type(title, ' edited');
    expect(title).toHaveValue('Existing edited');
  });

  it('enables with Enter or Space from the keyboard', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const title = screen.getByLabelText('Title');
    title.focus();
    await user.keyboard('{Enter}');
    expect(title).not.toHaveAttribute('readonly');

    const description = screen.getByLabelText('Description');
    expect(description).toHaveAttribute('readonly');
    description.focus();
    await user.keyboard(' ');
    expect(description).not.toHaveAttribute('readonly');
  });

  it('starts editable for new content', () => {
    render(<Harness initiallyEditable />);
    expect(screen.getByLabelText('Title')).not.toHaveAttribute('readonly');
  });

  it('reveals the field when validation requires it', () => {
    render(<Harness reveal />);
    expect(screen.getByLabelText('Title')).not.toHaveAttribute('readonly');
  });

  it('does not enable fields that are disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ClickToEditInput
        aria-label="Disabled"
        value=""
        onValueChange={onChange}
        disabled
      />,
    );
    await user.click(screen.getByLabelText('Disabled'));
    expect(screen.getByLabelText('Disabled')).toHaveAttribute('readonly');
    expect(onChange).not.toHaveBeenCalled();
  });
});
