import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ContextSizeSheet from '../components/bottomSheets/ContextSizeSheet';
import { useSettingsStore } from '../store/settingsStore';

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

const makeRef = () => ({ current: { dismiss: jest.fn(), present: jest.fn() } });

beforeEach(() => useSettingsStore.setState({ conversationMemory: 'auto' }));

describe('the context size sheet', () => {
  it('offers Low, Medium, High and Auto under the Context size title', () => {
    render(<ContextSizeSheet bottomSheetModalRef={makeRef() as never} />);
    expect(screen.getByText('Context size')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('no longer carries a note about when a change applies', () => {
    render(<ContextSizeSheet bottomSheetModalRef={makeRef() as never} />);
    expect(screen.queryByText(/next message/i)).toBeNull();
  });

  it('saves a pick', () => {
    render(<ContextSizeSheet bottomSheetModalRef={makeRef() as never} />);
    fireEvent.press(screen.getByTestId('context-size-low'));
    expect(useSettingsStore.getState().conversationMemory).toBe('low');
  });

  it('locks every option while a reply is running', () => {
    render(
      <ContextSizeSheet bottomSheetModalRef={makeRef() as never} disabled />
    );
    fireEvent.press(screen.getByTestId('context-size-low'));
    expect(useSettingsStore.getState().conversationMemory).toBe('auto');
  });

  it('has no back button', () => {
    render(<ContextSizeSheet bottomSheetModalRef={makeRef() as never} />);
    expect(screen.queryByTestId('context-size-back')).toBeNull();
    expect(screen.queryByLabelText('Back to menu')).toBeNull();
  });
});
