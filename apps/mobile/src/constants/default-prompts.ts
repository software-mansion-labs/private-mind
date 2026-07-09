export interface PromptSuggestion {
  id: string;
  title: string;
  prompt: string;
}

export const DEFAULT_PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  {
    id: '1',
    title: 'Explain a concept',
    prompt: 'Can you explain how machine learning works in simple terms?',
  },
  {
    id: '2',
    title: 'Write code',
    prompt:
      'Help me write a Python function to sort a list of dictionaries by a specific key.',
  },
  {
    id: '3',
    title: 'Creative writing',
    prompt:
      'Write a short story about a robot discovering emotions for the first time.',
  },
  {
    id: '4',
    title: 'Problem solving',
    prompt:
      'What are some effective strategies for managing time and staying productive?',
  },
  {
    id: '5',
    title: 'Learn something new',
    prompt: 'Teach me about quantum computing and its potential applications.',
  },
  {
    id: '6',
    title: 'Analyze data',
    prompt: 'How can I analyze customer feedback data to improve my product?',
  },
  {
    id: '7',
    title: 'Cooking',
    prompt: 'Help me cook a delicious roasted chicken for my family.',
  },
  {
    id: '8',
    title: 'Research topic',
    prompt: 'What are the latest developments in AI?',
  },
  {
    id: '9',
    title: 'Plan project',
    prompt:
      'Help me create a project timeline for building a todo list mobile app from scratch.',
  },
  {
    id: '10',
    title: 'Optimize performance',
    prompt:
      'What are the best practices for optimizing React Native app performance?',
  },
];

export const PROMPT_SUGGESTIONS_TEXT = {
  title: 'Suggested messages',
} as const;
