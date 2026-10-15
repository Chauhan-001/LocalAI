import { IconSparkle } from './Icons.jsx';

const EXAMPLES = [
  {
    title: 'Explain a concept',
    prompt: 'Explain JavaScript closures with a short example, then give me one exercise to try.'
  },
  {
    title: 'Debug an error',
    prompt: 'I have a React useEffect that runs twice in development. Explain why and show the correct way to fetch data.'
  },
  {
    title: 'Review code',
    prompt: 'Review this function for bugs and edge cases, and suggest the smallest fix:\n\n```js\nfunction average(nums) {\n  return nums.reduce((a, b) => a + b) / nums.length;\n}\n```'
  },
  {
    title: 'Write a query',
    prompt: 'Write a SQL query that returns the 5 most recent orders for each customer in an `orders` table.'
  },
  {
    title: 'Plan a feature',
    prompt: 'Help me plan adding dark mode to a React app. Break it into steps and list the files I need to touch.'
  },
  {
    title: 'Work through notes',
    prompt: 'Summarize what HTTP status codes 401, 403 and 429 mean and when a backend should return each one.'
  }
];

export default function WelcomeScreen({ model, health, onSelectPrompt }) {
  return (
    <div className="welcome">
      <div className="welcome__intro">
        <span className="welcome__badge" aria-hidden="true">
          <IconSparkle size={18} />
        </span>
        <h1>Local AI Assistant</h1>
        <p className="welcome__lede">
          A private coding workspace running entirely on your machine. Ask about code, paste an
          error, or work through a design problem — nothing leaves this computer.
        </p>
        <p className={`welcome__status status--${health.state}`}>
          <span className="status-dot" aria-hidden="true" />
          {health.state === 'connected' && `Connected to ${model}`}
          {health.state === 'disconnected' && `Ollama is running but ${model} is not pulled`}
          {health.state === 'unreachable' && 'Ollama is not reachable on port 11434'}
          {health.state === 'checking' && 'Checking the local model…'}
        </p>
      </div>

      <div className="welcome__examples">
        <h2>Try one of these</h2>
        <ul className="example-grid">
          {EXAMPLES.map(example => (
            <li key={example.title}>
              <button
                type="button"
                className="example-card"
                onClick={() => onSelectPrompt(example.prompt)}
              >
                <span className="example-card__title">{example.title}</span>
                <span className="example-card__prompt">{example.prompt.split('\n')[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
