import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AccessibilityInfo, AppState, StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => {
    require('react').useEffect(effect, [effect]);
  },
}));

jest.mock('react-native-gesture-handler', () => {
  const pan = new Proxy(
    {},
    { get: (_target, _name, receiver) => () => receiver }
  );
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pan: () => pan },
  };
});

import PromptSuggestions from '../components/chat-screen/PromptSuggestions';
import { NEW_CHAT_HEADING } from '../constants/chat-screen';
import { DRIFT_SETTLE_MS } from '../components/chat-screen/promptRowMotion';
import {
  DEFAULT_PROMPT_SUGGESTIONS,
  PROMPT_SUGGESTION_ROWS,
} from '../constants/default-prompts';

const firstPrompt = DEFAULT_PROMPT_SUGGESTIONS[0];

const setActive = jest.fn();

beforeEach(() => {
  setActive.mockClear();
  jest
    .spyOn(Reanimated, 'useFrameCallback')
    .mockReturnValue({ setActive, isActive: false, callbackId: 0 });
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(false);
});

afterEach(() => jest.restoreAllMocks());

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
  });

  it('shows titles only, but still reads the full prompt aloud', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    expect(screen.queryByText(firstPrompt.prompt)).toBeNull();
    expect(
      screen.getByLabelText(`${firstPrompt.title}: ${firstPrompt.prompt}`)
    ).toBeTruthy();
  });

  it('reads each prompt once, hiding the copies that make the loop', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    expect(screen.getAllByTestId('prompt-suggestion-pill')).toHaveLength(
      DEFAULT_PROMPT_SUGGESTIONS.length
    );
    expect(
      screen.getAllByTestId('prompt-suggestion-pill', {
        includeHiddenElements: true,
      })
    ).toHaveLength(DEFAULT_PROMPT_SUGGESTIONS.length * 2);
  });

  it('leaves the heading to the hero above the rows', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    expect(screen.queryByText(NEW_CHAT_HEADING)).toBeNull();
  });

  it('tints each pill icon with its own label color', () => {
    const { testTheme } = require('./helpers/renderWithTheme');
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    const tiles = screen.getAllByTestId('prompt-suggestion-tile', {
      includeHiddenElements: true,
    });
    const eachPillInRowOrder = PROMPT_SUGGESTION_ROWS.flatMap((row) => [
      ...row,
      ...row,
    ]);
    eachPillInRowOrder.forEach((suggestion, i) => {
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

describe('when the rows drift', () => {
  it('drifts on an open chat', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    expect(setActive).toHaveBeenLastCalledWith(true);
  });

  it('waits for the screen to settle, so a slow mount cannot freeze moving rows', () => {
    const withDelay = jest.spyOn(Reanimated, 'withDelay');
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    expect(withDelay).toHaveBeenCalledWith(DRIFT_SETTLE_MS, expect.anything());
  });

  it('holds still while paused, as on a chat being left', () => {
    const withDelay = jest.spyOn(Reanimated, 'withDelay');
    render(<PromptSuggestions onSelectPrompt={jest.fn()} paused />);

    expect(withDelay).not.toHaveBeenCalled();
  });

  it('stops while a sheet covers the rows', () => {
    render(<PromptSuggestions onSelectPrompt={jest.fn()} paused />);

    expect(setActive).toHaveBeenLastCalledWith(false);
  });

  it('stays still with Reduce Motion on', () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    expect(setActive).toHaveBeenLastCalledWith(false);
  });

  it('stays still for a screen reader, so its focus does not chase a pill', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
      .mockResolvedValue(true);
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    await waitFor(() => expect(setActive).toHaveBeenLastCalledWith(false));
  });

  it('stops in the background and resumes in the foreground', () => {
    let notify: (state: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      listener: (state: string) => void
    ) => {
      notify = listener;
      return { remove: jest.fn() };
    }) as never);
    render(<PromptSuggestions onSelectPrompt={jest.fn()} />);

    act(() => notify('background'));
    expect(setActive).toHaveBeenLastCalledWith(false);

    act(() => notify('active'));
    expect(setActive).toHaveBeenLastCalledWith(true);
  });
});
