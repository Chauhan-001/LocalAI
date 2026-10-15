import CopyButton from './CopyButton.jsx';

/** Floating Copy control anchored above the current text selection. */
export default function SelectionToolbar({ selection }) {
  if (!selection) return null;

  return (
    <div
      className="selection-toolbar"
      style={{ left: `${selection.x}px`, top: `${selection.y}px` }}
      // Keep the browser selection alive while the button is clicked.
      onMouseDown={event => event.preventDefault()}
    >
      <CopyButton
        text={selection.text}
        label="Copy"
        copiedLabel="Copied"
        className="selection-toolbar__button"
      />
    </div>
  );
}
