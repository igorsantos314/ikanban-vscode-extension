import { useEffect, useId, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  titleAdornment,
  onRequestClose,
  children,
  footer,
  wide = false,
  inert = false,
  stacked = false,
}: {
  title: string;
  titleAdornment?: ReactNode;
  onRequestClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  inert?: boolean;
  stacked?: boolean;
}) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onRequestClose);

  useEffect(() => {
    closeRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (inert) {
      return undefined;
    }
    const previous = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const first = container?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? container)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !container) {
        return;
      }
      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => !element.hasAttribute('disabled'),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previous?.focus();
    };
  }, [inert]);

  return (
    <div
      className={`modal-backdrop ${stacked ? 'modal-backdrop-stacked' : ''}`}
      aria-hidden={inert ? true : undefined}
      onMouseDown={(event) => {
        if (!inert && event.target === event.currentTarget) {
          closeRef.current();
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal={inert ? undefined : true}
        aria-hidden={inert ? true : undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-panel ${wide ? 'modal-wide' : ''}`}
        {...(inert ? { inert: true } : {})}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            {titleAdornment}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={() => closeRef.current()}
          >
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
