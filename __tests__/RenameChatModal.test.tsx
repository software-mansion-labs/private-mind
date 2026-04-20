import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { ...require('../styles/colors').lightTheme },
  }),
}));

import RenameChatModal from '../components/chat-screen/RenameChatModal';

const defaultProps = {
  visible: true,
  initialTitle: 'My Chat',
  onCancel: jest.fn(),
  onSubmit: jest.fn(),
};

const renderModal = (props: Partial<typeof defaultProps> = {}) =>
  render(<RenameChatModal {...defaultProps} {...props} />);

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

// ─── visibility & prefill ────────────────────────────────────────────────────

describe('prefill', () => {
  it('renders the input prefilled with initialTitle when visible', () => {
    renderModal();
    expect(screen.getByDisplayValue('My Chat')).toBeTruthy();
  });

  it('strips trailing "..." from initialTitle', () => {
    renderModal({ initialTitle: 'Truncated...' });
    expect(screen.getByDisplayValue('Truncated')).toBeTruthy();
  });

  it('does not strip "..." when they are not trailing', () => {
    renderModal({ initialTitle: 'A...B' });
    expect(screen.getByDisplayValue('A...B')).toBeTruthy();
  });
});

// ─── maxLength prop ──────────────────────────────────────────────────────────

describe('maxLength', () => {
  it('passes maxLength={25} to the TextInput', () => {
    renderModal();
    const input = screen.getByDisplayValue('My Chat');
    expect(input.props.maxLength).toBe(25);
  });
});

// ─── typing ───────────────────────────────────────────────────────────────────

describe('typing', () => {
  it('updates the input value as the user types', () => {
    renderModal();
    fireEvent.changeText(screen.getByDisplayValue('My Chat'), 'New Name');
    expect(screen.getByDisplayValue('New Name')).toBeTruthy();
  });
});

// ─── Save button state ────────────────────────────────────────────────────────

const getSaveDisabled = () => {
  // Walk up from the Text node to find the Pressable that has the disabled prop
  let node: any = screen.getByText('Save');
  while (node) {
    if (node.props?.disabled !== undefined) return node.props.disabled;
    if (node.props?.accessibilityState?.disabled !== undefined)
      return node.props.accessibilityState.disabled;
    node = node.parent;
  }
  return undefined;
};

describe('Save button disabled state', () => {
  it('Save button is disabled when the value is empty', () => {
    renderModal({ initialTitle: '' });
    expect(getSaveDisabled()).toBe(true);
  });

  it('Save button is enabled when the value is non-empty', () => {
    renderModal({ initialTitle: 'My Chat' });
    expect(getSaveDisabled()).toBeFalsy();
  });

  it('Save button becomes disabled after clearing the input', () => {
    renderModal();
    fireEvent.changeText(screen.getByDisplayValue('My Chat'), '');
    expect(getSaveDisabled()).toBe(true);
  });
});

// ─── onSubmit ─────────────────────────────────────────────────────────────────

describe('onSubmit', () => {
  it('calls onSubmit with the trimmed value when Save is pressed', () => {
    const onSubmit = jest.fn();
    renderModal({ onSubmit, initialTitle: '  Hello  ' });
    fireEvent.press(screen.getByText('Save'));
    expect(onSubmit).toHaveBeenCalledWith('Hello');
  });

  it('does not call onSubmit when value is all whitespace', () => {
    const onSubmit = jest.fn();
    renderModal({ onSubmit, initialTitle: '   ' });
    fireEvent.press(screen.getByText('Save'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with trimmed value via keyboard submit', () => {
    const onSubmit = jest.fn();
    renderModal({ onSubmit, initialTitle: 'My Chat' });
    fireEvent(screen.getByDisplayValue('My Chat'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalledWith('My Chat');
  });
});

// ─── onCancel ─────────────────────────────────────────────────────────────────

describe('onCancel', () => {
  it('calls onCancel when Cancel is pressed', () => {
    const onCancel = jest.fn();
    renderModal({ onCancel });
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});

// ─── reset on re-open ─────────────────────────────────────────────────────────

describe('reset on re-open', () => {
  it('resets to the new initialTitle when visible toggles false→true with a different title', () => {
    const { rerender } = renderModal({ initialTitle: 'Old Title', visible: true });
    rerender(<RenameChatModal {...defaultProps} initialTitle="New Title" visible={false} />);
    rerender(<RenameChatModal {...defaultProps} initialTitle="New Title" visible={true} />);
    expect(screen.getByDisplayValue('New Title')).toBeTruthy();
  });
});
