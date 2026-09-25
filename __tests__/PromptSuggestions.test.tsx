import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  return { ScrollView: RN.ScrollView, TouchableOpacity: RN.TouchableOpacity };
});

import PromptSuggestions from '../components/chat-screen/PromptSuggestions';
import { DEFAULT_PROMPT_SUGGESTIONS } from '../constants/default-prompts';

const firstPrompt = DEFAULT_PROMPT_SUGGESTIONS[0];

describe('the suggested message cards', () => {
  it('hands the whole prompt to the composer when one is tapped', () => {
    const onSelectPrompt = jest.fn();
    render(<PromptSuggestions onSelectPrompt={onSelectPrompt} />);

    fireEvent.press(screen.getByText(firstPrompt.title));

    expect(onSelectPrompt).toHaveBeenCalledWith(firstPrompt.prompt);
  });

  it('reserves no line the prompt does not use', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    const flattened = StyleSheet.flatten(
      screen.getByText(firstPrompt.prompt).props.style
    ) as { height?: number };

    expect(flattened.height).toBeUndefined();
  });

  it('keeps every card the height of the tallest one', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    const row = screen.UNSAFE_getByType(
      require('react-native').ScrollView
    ).props;
    const content = StyleSheet.flatten(row.contentContainerStyle) as {
      alignItems?: string;
    };

    expect(content.alignItems).toBe('stretch');
  });
});
