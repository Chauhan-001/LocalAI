import { Children } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import CodeBlock from './CodeBlock.jsx';

/**
 * Recover the raw source text from a rendered node tree.
 *
 * Used for copying, so indentation and special characters must survive
 * verbatim rather than being read back from the DOM.
 */
function toPlainText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toPlainText).join('');
  if (typeof node === 'object' && node.props) return toPlainText(node.props.children);
  return '';
}

const LANGUAGE_PATTERN = /language-([\w+-]+)/;

const components = {
  // Fenced blocks arrive as <pre><code class="language-x">; lift them into a
  // framed component while keeping the highlighted children intact.
  pre({ children }) {
    const child = Children.toArray(children)[0];
    const className = child?.props?.className ?? '';
    const language = LANGUAGE_PATTERN.exec(className)?.[1];

    return (
      <CodeBlock language={language} code={toPlainText(child?.props?.children)}>
        {children}
      </CodeBlock>
    );
  },

  code({ className, children, ...rest }) {
    // A language class means this is a fenced block already handled by `pre`.
    // GFM utility classes (e.g. "language-diff") keep their token styling.
    if (className && LANGUAGE_PATTERN.test(className)) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }

    return (
      <code className="inline-code" {...rest}>
        {children}
      </code>
    );
  },

  a({ children, ...rest }) {
    return (
      <a {...rest} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },

  table({ children, ...rest }) {
    // Tables need a scroll container on narrow screens.
    return (
      <div className="table-scroll">
        <table {...rest}>{children}</table>
      </div>
    );
  }
};

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [[rehypeHighlight, { detect: false, ignoreMissing: true }]];

/**
 * Renders assistant markdown.
 *
 * `skipHtml` drops raw HTML, so model output can never inject markup; only the
 * markdown subset plus sanitised syntax-highlight spans are rendered.
 */
export default function Markdown({ content }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
        skipHtml
      >
        {content ?? ''}
      </ReactMarkdown>
    </div>
  );
}
