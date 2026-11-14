import { useEffect, useRef, type ReactNode } from "react";

/** Keeps keyboard focus inside the modal and restores it to the opener on close. */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = root.current!;
    const focusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),a[href],select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      );
    (focusable()[0] ?? node).focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        e.preventDefault();
        node.focus();
        return;
      }
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault();
        items.at(-1)!.focus();
      }
      if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault();
        items[0].focus();
      }
    };
    node.addEventListener("keydown", handle);
    return () => {
      node.removeEventListener("keydown", handle);
      opener?.focus();
    };
  }, []);
  return (
    <div className="detail-backdrop">
      <section
        ref={root}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="stop-detail"
      >
        <button onClick={onClose}>Close {title}</button>
        {children}
      </section>
    </div>
  );
}
