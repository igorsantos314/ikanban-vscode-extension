import { useState } from 'react';
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

interface ClickToEditOptions {
  initiallyEditable?: boolean;
  reveal?: boolean;
}

function useClickToEdit({ initiallyEditable = false, reveal = false }: ClickToEditOptions) {
  const [enabled, setEnabled] = useState(initiallyEditable);
  const editable = enabled || initiallyEditable || reveal;
  const enable = () => setEnabled(true);
  return { editable, enable };
}

type SharedProps = ClickToEditOptions & {
  value: string;
  onValueChange(value: string): void;
  className?: string;
};

type InputProps = SharedProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'readOnly'>;

export function ClickToEditInput({
  value,
  onValueChange,
  initiallyEditable,
  reveal,
  className = '',
  onClick,
  onKeyDown,
  ...rest
}: InputProps) {
  const { editable, enable } = useClickToEdit({ initiallyEditable, reveal });
  return (
    <input
      {...rest}
      value={value}
      readOnly={!editable}
      className={`${className} ${editable ? '' : 'input-click-to-edit'}`.trim()}
      onClick={(event) => {
        onClick?.(event);
        if (!editable) {
          enable();
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!editable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          enable();
        }
      }}
      onChange={(event) => {
        enable();
        onValueChange(event.target.value);
      }}
    />
  );
}

type TextareaProps = SharedProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'readOnly'>;

export function ClickToEditTextarea({
  value,
  onValueChange,
  initiallyEditable,
  reveal,
  className = '',
  onClick,
  onKeyDown,
  ...rest
}: TextareaProps) {
  const { editable, enable } = useClickToEdit({ initiallyEditable, reveal });
  return (
    <textarea
      {...rest}
      value={value}
      readOnly={!editable}
      className={`${className} ${editable ? '' : 'input-click-to-edit'}`.trim()}
      onClick={(event) => {
        onClick?.(event);
        if (!editable) {
          enable();
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!editable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          enable();
        }
      }}
      onChange={(event) => {
        enable();
        onValueChange(event.target.value);
      }}
    />
  );
}
