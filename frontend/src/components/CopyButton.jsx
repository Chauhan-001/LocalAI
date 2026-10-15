import { useCallback, useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/clipboard.js';
import { IconCheck, IconCopy } from './Icons.jsx';

const RESET_DELAY_MS = 1800;

/**
 * Copies `text` verbatim and reports the outcome inline.
 *
 * The visible label doubles as the accessible name, so the same control works
 * for code blocks, whole responses and selected passages.
 */
export default function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  failedLabel = 'Copy failed',
  className = '',
  iconOnly = false
}) {
  const [state, setState] = useState('idle');
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = useCallback(async () => {
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'failed');

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState('idle'), RESET_DELAY_MS);
  }, [text]);

  const visibleLabel = state === 'copied' ? copiedLabel : state === 'failed' ? failedLabel : label;

  return (
    <button
      type="button"
      className={`copy-button${state === 'copied' ? ' is-copied' : ''}${state === 'failed' ? ' is-failed' : ''} ${className}`.trim()}
      onClick={handleClick}
      title={visibleLabel}
      aria-label={visibleLabel}
    >
      {state === 'copied' ? <IconCheck size={14} /> : <IconCopy size={14} />}
      {!iconOnly && <span className="copy-button__label">{visibleLabel}</span>}
      <span role="status" aria-live="polite" className="visually-hidden">
        {state === 'copied' ? 'Copied to clipboard' : state === 'failed' ? 'Copy failed' : ''}
      </span>
    </button>
  );
}
