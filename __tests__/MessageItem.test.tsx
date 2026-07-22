import React from 'react';
import type { ViewProps } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

type MockLLMState = {
  isGenerating: boolean;
  isProcessingPrompt: boolean;
};

type MockLLMSelector<T = MockLLMState> = (state: MockLLMState) => T;

type ThinkingBlockMockProps = {
  content: string;
  isComplete: boolean;
  inProgress: boolean;
};

type BottomSheetModalHandle = {
  present: jest.Mock;
  dismiss: jest.Mock;
};

type BottomSheetModalMockProps = {
  children?: React.ReactNode;
};

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../store/llmStore', () => ({
  useLLMStore: jest.fn(<T,>(selector?: MockLLMSelector<T>) => {
    const state = { isGenerating: false, isProcessingPrompt: false };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('../components/chat-screen/MarkdownComponent', () => {
  const { Text } = require('react-native');
  return ({ text }: { text: string }) => <Text testID="markdown">{text}</Text>;
});

jest.mock('../components/chat-screen/ThinkingBlock', () => {
  const { Text } = require('react-native');
  return ({ content, isComplete, inProgress }: ThinkingBlockMockProps) => (
    <Text
      testID="thinking-block"
      accessibilityLabel={`complete:${isComplete} inProgress:${inProgress}`}
    >
      {content}
    </Text>
  );
});

jest.mock('../components/chat-screen/AnimatedChatLoading', () => () => null);

jest.mock('@gorhom/bottom-sheet', () => {
  const MockReact = require('react') as typeof import('react');
  const { View } = require('react-native');

  const BottomSheetModal = MockReact.forwardRef<
    BottomSheetModalHandle,
    BottomSheetModalMockProps
  >(({ children }, ref) => {
    MockReact.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: jest.fn(),
    }));
    return <View testID="bottom-sheet-modal">{children}</View>;
  });

  return {
    BottomSheetBackdrop: (props: ViewProps) => <View {...props} />,
    BottomSheetModal,
    BottomSheetView: View,
    BottomSheetScrollView: View,
    useBottomSheet: () => ({ close: jest.fn() }),
    useBottomSheetSpringConfigs: (config: unknown) => config,
  };
});

// ── helpers ───────────────────────────────────────────────────────────────────

import MessageItem from '../components/chat-screen/MessageItem';
import { useLLMStore } from '../store/llmStore';

const mockUseLLMStore = useLLMStore as unknown as jest.Mock;

const setLLMState = (state: MockLLMState) =>
  mockUseLLMStore.mockImplementation((selector?: MockLLMSelector) =>
    selector ? selector(state) : state
  );

const baseMessage = {
  id: 1,
  role: 'assistant',
  content: 'Hello world',
  chatId: 1,
  timestamp: 0,
} as React.ComponentProps<typeof MessageItem>['message'];

const renderItem = (
  props: Partial<React.ComponentProps<typeof MessageItem>> = {}
) =>
  render(
    <MessageItem
      message={baseMessage}
      content="Hello world"
      role="assistant"
      isLastMessage={false}
      {...props}
    />
  );

beforeEach(() => {
  setLLMState({ isGenerating: false, isProcessingPrompt: false });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── event messages ───────────────────────────────────────────────────────────

describe('event messages', () => {
  it('renders event message with filename and text parts', () => {
    renderItem({ role: 'event', content: 'document.pdf was added' });
    // The outer Text contains "document.pdf " as direct text — match with substring
    expect(screen.getByText(/document\.pdf/, { exact: false })).toBeTruthy();
    expect(screen.getByText('was added')).toBeTruthy();
  });

  it('does not render a MarkdownComponent for event messages', () => {
    renderItem({ role: 'event', content: 'file.txt uploaded' });
    expect(screen.queryByTestId('markdown')).toBeNull();
  });
});

// ─── assistant messages ───────────────────────────────────────────────────────

describe('assistant messages', () => {
  it('renders the model name', () => {
    renderItem({ role: 'assistant', content: 'Hi', modelName: 'Llama-3B' });
    expect(screen.getByText('Llama-3B')).toBeTruthy();
  });

  it('renders content via MarkdownComponent', () => {
    renderItem({ role: 'assistant', content: 'Some response' });
    expect(screen.getByTestId('markdown')).toBeTruthy();
    expect(screen.getByText('Some response')).toBeTruthy();
  });

  it('renders metadata when tokensPerSecond is provided and non-zero', () => {
    renderItem({
      role: 'assistant',
      content: 'Hi',
      tokensPerSecond: 12.5,
      timeToFirstToken: 300,
    });
    expect(screen.getByText(/tps:/)).toBeTruthy();
    expect(screen.getByText(/ttft:/)).toBeTruthy();
  });

  it('does not render metadata when tokensPerSecond is 0', () => {
    renderItem({ role: 'assistant', content: 'Hi', tokensPerSecond: 0 });
    expect(screen.queryByText(/tps:/)).toBeNull();
  });

  it('does not render metadata when tokensPerSecond is undefined', () => {
    renderItem({ role: 'assistant', content: 'Hi' });
    expect(screen.queryByText(/tps:/)).toBeNull();
  });

  it('hands deduplicated sources to onShowSources when the sources button is pressed', () => {
    const onShowSources = jest.fn();
    renderItem({
      role: 'assistant',
      content: 'The answer is in the report.',
      userQuestion: 'What was the revenue?',
      sourceDocuments: [
        { documentId: 1, name: 'financial_report.pdf' },
        { documentId: 1, name: 'financial_report.pdf' },
      ],
      onShowSources,
    });

    expect(screen.getByTestId('source-action-button')).toBeTruthy();
    expect(screen.getByLabelText('Sources')).toBeTruthy();

    fireEvent.press(screen.getByTestId('source-action-button'));

    expect(onShowSources).toHaveBeenCalledWith(
      [{ documentId: 1, name: 'financial_report.pdf' }],
      'What was the revenue?'
    );
  });

  it('strips inline [n] citation markers from the rendered answer', () => {
    renderItem({
      role: 'assistant',
      content: 'The total was 100 [1].',
      sourceDocuments: [{ documentId: 1, name: 'financial_report.pdf' }],
    });

    const markdown = screen.getByTestId('markdown');
    expect(markdown.props.children).toBe('The total was 100.');
  });

  it('does not render source actions for user messages', () => {
    renderItem({
      role: 'user',
      content: 'Question',
      sourceDocuments: [{ documentId: 1, name: 'notes.txt' }],
    });

    expect(screen.queryByTestId('source-action-button')).toBeNull();
  });

  it('does not render source actions while the last assistant message is generating', () => {
    setLLMState({
      isGenerating: true,
      isProcessingPrompt: false,
    });

    renderItem({
      role: 'assistant',
      content: 'Streaming answer',
      isLastMessage: true,
      sourceDocuments: [{ documentId: 1, name: 'report.pdf' }],
    });

    expect(screen.queryByTestId('source-action-button')).toBeNull();
  });
});

// ─── user messages ────────────────────────────────────────────────────────────

describe('user messages', () => {
  it('does not render model name for user messages', () => {
    renderItem({ role: 'user', content: 'Hello', modelName: 'Llama-3B' });
    expect(screen.queryByText('Llama-3B')).toBeNull();
  });

  it('renders user content via MarkdownComponent', () => {
    renderItem({ role: 'user', content: 'My question' });
    expect(screen.getByText('My question')).toBeTruthy();
  });
});

// ─── user messages with image ─────────────────────────────────────────────────

describe('user messages with image', () => {
  it('renders image as a separate bubble from text', () => {
    renderItem({
      role: 'user',
      content: 'Check this out',
      imagePath: 'file://test.jpg',
    });
    const image = screen.getByTestId('message-image');
    expect(image.props.source).toEqual({ uri: 'file://test.jpg' });
    expect(screen.getByText('Check this out')).toBeTruthy();
    // Image bubble and text bubble should be separate Views
    expect(screen.getByTestId('image-bubble')).toBeTruthy();
    expect(screen.getByTestId('text-bubble')).toBeTruthy();
  });

  it('renders text-only bubble when imagePath is absent', () => {
    renderItem({ role: 'user', content: 'Hello there' });
    expect(screen.queryByTestId('message-image')).toBeNull();
    expect(screen.queryByTestId('image-bubble')).toBeNull();
    expect(screen.getByText('Hello there')).toBeTruthy();
  });

  it('does not render image for assistant messages even if imagePath is provided', () => {
    renderItem({
      role: 'assistant',
      content: 'Response',
      imagePath: 'file://test.jpg',
    });
    expect(screen.queryByTestId('message-image')).toBeNull();
  });
});

// ─── user messages with document ──────────────────────────────────────────────

describe('user messages with document', () => {
  it('renders document as a separate bubble from text', () => {
    renderItem({
      role: 'user',
      content: 'Summarize this',
      documentName: 'report.pdf',
    });
    expect(screen.getByTestId('message-document')).toBeTruthy();
    expect(screen.getByTestId('document-bubble')).toBeTruthy();
    expect(screen.getByTestId('text-bubble')).toBeTruthy();
    expect(screen.getByText('report.pdf')).toBeTruthy();
    expect(screen.getByText('Summarize this')).toBeTruthy();
  });

  it('does not render document bubble when documentName is absent', () => {
    renderItem({ role: 'user', content: 'Hello' });
    expect(screen.queryByTestId('message-document')).toBeNull();
    expect(screen.queryByTestId('document-bubble')).toBeNull();
  });

  it('renders document bubble without text bubble when content is empty', () => {
    renderItem({ role: 'user', content: '', documentName: 'notes.txt' });
    expect(screen.getByTestId('document-bubble')).toBeTruthy();
    expect(screen.queryByTestId('text-bubble')).toBeNull();
  });

  it('does not render document bubble for assistant messages', () => {
    renderItem({
      role: 'assistant',
      content: 'Response',
      documentName: 'doc.pdf',
    });
    expect(screen.queryByTestId('message-document')).toBeNull();
  });
});

// ─── user messages with both image and document ──────────────────────────────

describe('user messages with image and document', () => {
  it('renders image bubble, document bubble, and text bubble separately', () => {
    renderItem({
      role: 'user',
      content: 'Analyze both',
      imagePath: 'file://photo.jpg',
      documentName: 'data.pdf',
    });
    expect(screen.getByTestId('image-bubble')).toBeTruthy();
    expect(screen.getByTestId('document-bubble')).toBeTruthy();
    expect(screen.getByTestId('text-bubble')).toBeTruthy();
  });
});

// ─── thinking block parsing ───────────────────────────────────────────────────

describe('thinking block parsing', () => {
  it('does not render ThinkingBlock when there is no <think> tag', () => {
    renderItem({ content: 'Plain response' });
    expect(screen.queryByTestId('thinking-block')).toBeNull();
  });

  it('renders ThinkingBlock with complete=true for closed <think> tag', () => {
    renderItem({ content: '<think>some reasoning</think>Final answer' });
    const block = screen.getByTestId('thinking-block');
    expect(block).toBeTruthy();
    expect(block.props.accessibilityLabel).toContain('complete:true');
    expect(screen.getByText('some reasoning')).toBeTruthy();
  });

  it('renders ThinkingBlock with complete=false for unclosed <think> tag (streaming)', () => {
    renderItem({ content: '<think>still thinking...', isLastMessage: true });
    const block = screen.getByTestId('thinking-block');
    expect(block.props.accessibilityLabel).toContain('complete:false');
  });

  it('renders normal content after </think> via MarkdownComponent', () => {
    renderItem({ content: '<think>reasoning</think>This is the answer' });
    const markdowns = screen.getAllByTestId('markdown');
    const texts = markdowns.map((el) => el.props.children);
    expect(texts).toContain('This is the answer');
  });

  it('marks ThinkingBlock as inProgress when last message and isGenerating and thinking is incomplete', () => {
    setLLMState({ isGenerating: true, isProcessingPrompt: false });
    renderItem({ content: '<think>working...', isLastMessage: true });
    const block = screen.getByTestId('thinking-block');
    expect(block.props.accessibilityLabel).toContain('inProgress:true');
  });

  it('does not mark ThinkingBlock as inProgress when not isLastMessage', () => {
    setLLMState({ isGenerating: true, isProcessingPrompt: false });
    renderItem({ content: '<think>working...', isLastMessage: false });
    const block = screen.getByTestId('thinking-block');
    expect(block.props.accessibilityLabel).toContain('inProgress:false');
  });

  it('does not render ThinkingBlock when thinking content is empty whitespace', () => {
    renderItem({ content: '<think>   </think>answer' });
    expect(screen.queryByTestId('thinking-block')).toBeNull();
  });
});
