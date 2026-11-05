import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  return { ScrollView: RN.ScrollView, Pressable: RN.Pressable };
});

import PromptSuggestions from '../components/chat-screen/PromptSuggestions';
import { NEW_CHAT_HEADING } from '../constants/chat-screen';
import {
  DEFAULT_PROMPT_SUGGESTIONS,
  PROMPT_SUGGESTION_ROWS,
} from '../constants/default-prompts';

const firstPrompt = DEFAULT_PROMPT_SUGGESTIONS[0];

describe('the suggested prompt rows', () => {
  it('hands the whole prompt to the composer when one is tapped', () => {
    const onSelectPrompt = jest.fn();
    render(<PromptSuggestions onSelectPrompt={onSelectPrompt} />);

    fireEvent.press(screen.getByText(firstPrompt.title));

    expect(onSelectPrompt).toHaveBeenCalledWith(firstPrompt.prompt);
  });

  it('splits every prompt across two rows', () => {
    expect(PROMPT_SUGGESTION_ROWS).toHaveLength(2);
    expect(PROMPT_SUGGESTION_ROWS.flat()).toEqual(DEFAULT_PROMPT_SUGGESTIONS);
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    expect(
      screen.UNSAFE_getAllByType(require('react-native').ScrollView)
    ).toHaveLength(2);
  });

  it('shows titles only, but still reads the full prompt aloud', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    expect(screen.queryByText(firstPrompt.prompt)).toBeNull();
    expect(
      screen.getByLabelText(`${firstPrompt.title}: ${firstPrompt.prompt}`)
    ).toBeTruthy();
  });

  it('leaves the heading to the hero above the rows', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    expect(screen.queryByText(NEW_CHAT_HEADING)).toBeNull();
  });

  it('tints each pill icon with its own label color', () => {
    const { testTheme } = require('./helpers/renderWithTheme');
    const view = render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    const pills = screen.getAllByTestId('prompt-suggestion-pill');
    expect(pills).toHaveLength(DEFAULT_PROMPT_SUGGESTIONS.length);
    const tiles = view.UNSAFE_root.findAll(
      (node) =>
        node.props.accessibilityElementsHidden === true &&
        typeof node.type === 'string'
    );
    DEFAULT_PROMPT_SUGGESTIONS.forEach((suggestion, i) => {
      expect(StyleSheet.flatten(tiles[i]!.props.style)).toEqual(
        expect.objectContaining({
          backgroundColor: testTheme.label[suggestion.tone].background,
        })
      );
    });
  });

  it('holds every title to one line, so no pill outgrows its row', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    for (const suggestion of DEFAULT_PROMPT_SUGGESTIONS) {
      expect(screen.getByText(suggestion.title).props.numberOfLines).toBe(1);
    }
  });
});
