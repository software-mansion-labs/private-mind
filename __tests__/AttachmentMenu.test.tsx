import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import AttachmentMenu, {
  attachmentMenuHeight,
} from '../components/chat-screen/attachments/AttachmentMenu';
import MenuRow from '../components/menu/MenuRow';
import {
  MENU,
  PRESS_ANYWHERE,
  menuHeight,
} from '../components/chat-screen/attachments/constants';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../utils/Feedback', () => ({
  Feedback: { toggleOn: jest.fn(), toggleOff: jest.fn() },
}));

const { Feedback } = jest.requireMock('../utils/Feedback');

const hidden = { includeHiddenElements: true };

const renderWithTools = (props = {}) => {
  const tools = {
    thinkingEnabled: false,
    onThinkingToggle: jest.fn(),
    webSearchEnabled: false,
    onWebSearchToggle: jest.fn(),
    ...props,
  };
  render(<AttachmentMenu onSelect={jest.fn()} {...tools} />);
  return tools;
};

beforeEach(() => jest.clearAllMocks());

describe('AttachmentMenu', () => {
  it('holds a press through the finger travelling, on every row', () => {
    const view = render(
      <AttachmentMenu
        onSelect={jest.fn()}
        onThinkingToggle={jest.fn()}
        onWebSearchToggle={jest.fn()}
      />
    );

    const rows = view.UNSAFE_getAllByType(MenuRow);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.props.pressRetentionOffset).toEqual(PRESS_ANYWHERE);
    }
  });

  it('reports every row to its handler', () => {
    const onSelect = jest.fn();
    render(<AttachmentMenu onSelect={onSelect} />);

    fireEvent.press(screen.getByTestId('attachment-document'));
    expect(onSelect).toHaveBeenCalledWith('files');
  });

  it('keeps every row reading as itself on a model that takes no images', () => {
    render(<AttachmentMenu onSelect={jest.fn()} imagesEnabled={false} />);

    expect(screen.getByText('Camera')).toBeTruthy();
    expect(screen.getByText('Photos')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.queryByText('Images not supported')).toBeNull();
  });
});

describe('the tool switches in the menu', () => {
  it('lists Think and Web search under a divider, after the attachment rows', () => {
    renderWithTools();

    expect(screen.getByTestId('menu-divider')).toBeTruthy();
    expect(screen.getByText('Think')).toBeTruthy();
    expect(screen.getByText('Web search')).toBeTruthy();
  });

  it('shows each switch in the state the composer holds', () => {
    renderWithTools({ thinkingEnabled: true, webSearchEnabled: false });

    expect(screen.getByTestId('thinking-toggle', hidden).props.value).toBe(
      true
    );
    expect(screen.getByTestId('web-search-toggle', hidden).props.value).toBe(
      false
    );
    expect(
      screen.getByTestId('menu-think-switch').props.accessibilityState.checked
    ).toBe(true);
  });

  it('flips Think on from a tap anywhere on the row', () => {
    const tools = renderWithTools();

    fireEvent.press(screen.getByTestId('menu-think-switch'));

    expect(tools.onThinkingToggle).toHaveBeenCalledTimes(1);
    expect(Feedback.toggleOn).toHaveBeenCalledTimes(1);
  });

  it('flips Web search off from the switch itself', () => {
    const tools = renderWithTools({ webSearchEnabled: true });

    fireEvent(
      screen.getByTestId('web-search-toggle', hidden),
      'valueChange',
      false
    );

    expect(tools.onWebSearchToggle).toHaveBeenCalledTimes(1);
    expect(Feedback.toggleOff).toHaveBeenCalledTimes(1);
  });

  it('flips Web search from its row', () => {
    const tools = renderWithTools();

    fireEvent.press(screen.getByTestId('menu-web-switch'));

    expect(tools.onWebSearchToggle).toHaveBeenCalledTimes(1);
    expect(tools.onThinkingToggle).not.toHaveBeenCalled();
  });

  it('leaves Web search out when the chat cannot search the web', () => {
    render(
      <AttachmentMenu onSelect={jest.fn()} onThinkingToggle={jest.fn()} />
    );

    expect(screen.getByText('Think')).toBeTruthy();
    expect(screen.queryByText('Web search')).toBeNull();
    expect(screen.queryByTestId('menu-web-switch')).toBeNull();
  });

  it('dims a tool the current model cannot use and locks its switch', () => {
    renderWithTools({ thinkingAvailable: false, webSearchAvailable: false });

    expect(
      screen.getByTestId('menu-think-switch').props.accessibilityState.disabled
    ).toBe(true);
    expect(screen.getByTestId('thinking-toggle', hidden).props.disabled).toBe(
      true
    );
    expect(screen.getByTestId('web-search-toggle', hidden).props.disabled).toBe(
      true
    );
  });

  it('still lets a dimmed row report the tap, so the composer can explain why', () => {
    const tools = renderWithTools({ thinkingAvailable: false });

    fireEvent.press(screen.getByTestId('menu-think-switch'));

    expect(tools.onThinkingToggle).toHaveBeenCalledTimes(1);
  });

  it('gives no on-haptic for a tool the model cannot use', () => {
    renderWithTools({ thinkingAvailable: false });

    fireEvent.press(screen.getByTestId('menu-think-switch'));

    expect(Feedback.toggleOn).not.toHaveBeenCalled();
  });

  it('draws no divider when there is no tool to follow it', () => {
    render(<AttachmentMenu onSelect={jest.fn()} />);

    expect(screen.queryByTestId('menu-divider')).toBeNull();
  });
});

describe('menu height', () => {
  it('grows by one row height per row', () => {
    expect(menuHeight({ rows: 4 }) - menuHeight({ rows: 3 })).toBe(
      MENU.itemHeight
    );
  });

  it('grows with every tool row the menu carries', () => {
    const attachmentsOnly = attachmentMenuHeight({});
    const withThink = attachmentMenuHeight({ onThinkingToggle: jest.fn() });
    const withBoth = attachmentMenuHeight({
      onThinkingToggle: jest.fn(),
      onWebSearchToggle: jest.fn(),
    });

    expect(withThink).toBeGreaterThan(attachmentsOnly);
    expect(withBoth - withThink).toBe(MENU.itemHeight);
  });

  it('sizes the menu to the height the panel animates to', () => {
    const tools = {
      onThinkingToggle: jest.fn(),
      onWebSearchToggle: jest.fn(),
    };
    const view = render(<AttachmentMenu onSelect={jest.fn()} {...tools} />);

    const root = view.toJSON() as { props: { style: unknown } };
    expect(StyleSheet.flatten(root.props.style)).toEqual(
      expect.objectContaining({ height: attachmentMenuHeight(tools) })
    );
  });
});
