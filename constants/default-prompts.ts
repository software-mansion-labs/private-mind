import { SvgComponent } from '../utils/SvgComponent';
import { LabelColor } from './model-labels';
import GraduationCapIcon from '../assets/icons/graduation-cap.svg';
import CodeIcon from '../assets/icons/code.svg';
import EditIcon from '../assets/icons/edit.svg';
import LightBulbIcon from '../assets/icons/light_bulb.svg';
import BookIcon from '../assets/icons/book-open.svg';
import ChartIcon from '../assets/icons/benchmark.svg';
import UtensilsIcon from '../assets/icons/utensils.svg';
import SearchIcon from '../assets/icons/search.svg';
import FolderIcon from '../assets/icons/folder.svg';
import FlashIcon from '../assets/icons/flash.svg';

export interface PromptSuggestion {
  id: string;
  title: string;
  prompt: string;
  icon: SvgComponent;
  tone: LabelColor;
}

export const SUGGESTION_CARD_WIDTH = 220;

export const DEFAULT_PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  {
    id: '1',
    title: 'Explain a concept',
    prompt: 'Can you explain how machine learning works in simple terms?',
    icon: GraduationCapIcon,
    tone: 'violet',
  },
  {
    id: '2',
    title: 'Write code',
    prompt:
      'Help me write a Python function to sort a list of dictionaries by a specific key.',
    icon: CodeIcon,
    tone: 'orange',
  },
  {
    id: '3',
    title: 'Creative writing',
    prompt:
      'Write a short story about a robot discovering emotions for the first time.',
    icon: EditIcon,
    tone: 'lime',
  },
  {
    id: '4',
    title: 'Problem solving',
    prompt:
      'What are some effective strategies for managing time and staying productive?',
    icon: LightBulbIcon,
    tone: 'gold',
  },
  {
    id: '5',
    title: 'Learn something new',
    prompt: 'Teach me about quantum computing and its potential applications.',
    icon: BookIcon,
    tone: 'blue',
  },
  {
    id: '6',
    title: 'Analyze data',
    prompt: 'How can I analyze customer feedback data to improve my product?',
    icon: ChartIcon,
    tone: 'cyan',
  },
  {
    id: '7',
    title: 'Cooking',
    prompt: 'Help me cook a delicious roasted chicken for my family.',
    icon: UtensilsIcon,
    tone: 'red',
  },
  {
    id: '8',
    title: 'Research topic',
    prompt: 'What are the latest developments in AI?',
    icon: SearchIcon,
    tone: 'sky',
  },
  {
    id: '9',
    title: 'Plan project',
    prompt:
      'Help me create a project timeline for building a todo list mobile app from scratch.',
    icon: FolderIcon,
    tone: 'mint',
  },
  {
    id: '10',
    title: 'Optimize performance',
    prompt:
      'What are the best practices for optimizing React Native app performance?',
    icon: FlashIcon,
    tone: 'periwinkle',
  },
];

export const PROMPT_SUGGESTIONS_TEXT = {
  title: 'How can I help?',
} as const;
