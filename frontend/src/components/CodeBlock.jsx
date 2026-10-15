import CopyButton from './CopyButton.jsx';

/**
 * Frame around a fenced code block: language label, Copy Code button and a
 * horizontally scrollable region so long lines never wrap or clip.
 *
 * `code` is the exact source text, used for copying; `children` is the
 * syntax-highlighted React tree rendered inside <pre>.
 */
export default function CodeBlock({ language, code, children }) {
  return (
    <div className="code-block">
      <div className="code-block__header">
        <span className="code-block__lang">{language || 'text'}</span>
        <CopyButton
          text={code}
          label="Copy Code"
          copiedLabel="Copied"
          className="code-block__copy"
        />
      </div>
      <pre className="code-block__pre" tabIndex={0}>
        {children}
      </pre>
    </div>
  );
}
