import { useEffect, useState } from 'react';

/**
 * Track a text selection inside `containerRef` and report where to anchor a
 * toolbar, without altering the browser's native selection behaviour.
 *
 * Disabled on coarse pointers (touch), where the OS selection handles are the
 * right affordance and a floating button would only get in the way.
 */
export function useSelectionToolbar(containerRef) {
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    if (window.matchMedia?.('(pointer: coarse)').matches) return undefined;

    const clear = () => setSelection(null);

    const update = () => {
      const active = window.getSelection();

      if (!active || active.isCollapsed || active.rangeCount === 0) {
        clear();
        return;
      }

      const text = active.toString();
      if (!text.trim()) {
        clear();
        return;
      }

      const range = active.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        clear();
        return;
      }

      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        clear();
        return;
      }

      // Anchor above the selection, clamped so it stays on screen.
      setSelection({
        text,
        x: Math.min(Math.max(rect.left + rect.width / 2, 80), window.innerWidth - 80),
        y: Math.max(rect.top, 56)
      });
    };

    const onKeyDown = event => {
      if (event.key === 'Escape') clear();
    };

    document.addEventListener('selectionchange', update);
    document.addEventListener('keydown', onKeyDown);
    // Scrolling moves the anchor text away from a viewport-positioned toolbar.
    container.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);

    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
    };
  }, [containerRef]);

  return selection;
}
