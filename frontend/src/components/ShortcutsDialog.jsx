import Modal from './Modal.jsx';

const GROUPS = [
  {
    heading: 'Composing',
    items: [
      ['Enter', 'Send the message'],
      ['Shift + Enter', 'Insert a new line'],
      ['Escape', 'Cancel an edit in progress']
    ]
  },
  {
    heading: 'Navigation',
    items: [
      ['Ctrl / ⌘ + K', 'Focus conversation search'],
      ['Ctrl / ⌘ + B', 'Collapse or expand the sidebar'],
      ['Alt + N', 'Start a new chat'],
      ['Ctrl / ⌘ + /', 'Show this shortcut list']
    ]
  },
  {
    heading: 'Working with answers',
    items: [
      ['Ctrl / ⌘ + C', 'Copy the current text selection'],
      ['Ctrl / ⌘ + Shift + C', 'Copy the latest assistant response'],
      ['Tab', 'Move to the action buttons on a message']
    ]
  }
];

export default function ShortcutsDialog({ onClose }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      {GROUPS.map(group => (
        <section key={group.heading} className="shortcuts__group">
          <h3>{group.heading}</h3>
          <dl className="shortcuts__list">
            {group.items.map(([keys, description]) => (
              <div key={keys} className="shortcuts__row">
                <dt>
                  <kbd>{keys}</kbd>
                </dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Modal>
  );
}
