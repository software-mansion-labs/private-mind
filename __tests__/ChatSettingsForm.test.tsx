import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../components/model-hub/ModelCard', () => {
  const { Text } = require('react-native');
  return ({ model }: any) => <Text testID="model-card">{model.modelName}</Text>;
});

jest.mock('../components/TextFieldInput', () => {
  const { TextInput } = require('react-native');
  return ({ value, onChangeText, placeholder, testID }: any) => (
    <TextInput
      testID={testID || placeholder || 'text-input'}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
    />
  );
});

jest.mock('../components/TextAreaField', () => {
  const { TextInput } = require('react-native');
  return ({ value, onChangeText, placeholder, editable }: any) => (
    <TextInput
      testID="system-prompt-input"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      editable={editable}
    />
  );
});

jest.mock('../components/EntryButton', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ text, onPress }: any) => (
    <TouchableOpacity testID={`entry-${text}`} onPress={onPress}>
      <Text>{text}</Text>
    </TouchableOpacity>
  );
});

jest.mock('../components/SecondaryButton', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ text, onPress }: any) => (
    <TouchableOpacity testID={`secondary-${text}`} onPress={onPress}>
      <Text>{text}</Text>
    </TouchableOpacity>
  );
});

import ChatSettingsForm from '../components/settings/ChatSettingsForm';

const defaultSettings = {
  title: 'My Chat',
  systemPrompt: 'You are helpful.',
  contextWindow: '6',
};

const defaultProps = {
  settings: defaultSettings,
  setSetting: jest.fn(),
  isDefaultSettings: false,
  isPhantomChat: false,
  scrollViewRef: { current: null } as any,
  onDelete: jest.fn(),
  onExport: jest.fn(),
  onAppInfo: jest.fn(),
};

const renderForm = (props = {}) =>
  render(<ChatSettingsForm {...defaultProps} {...props} />);

beforeEach(() => jest.clearAllMocks());

// ─── field visibility ─────────────────────────────────────────────────────────

describe('field visibility', () => {
  it('shows chat name field for regular (non-default, non-phantom) chats', () => {
    renderForm({ isDefaultSettings: false, isPhantomChat: false });
    expect(screen.getByText('Chat name')).toBeTruthy();
  });

  it('hides chat name field for default settings', () => {
    renderForm({ isDefaultSettings: true });
    expect(screen.queryByText('Chat name')).toBeNull();
  });

  it('hides chat name field for phantom chats', () => {
    renderForm({ isPhantomChat: true });
    expect(screen.queryByText('Chat name')).toBeNull();
  });

  it('shows model card when model is provided', () => {
    renderForm({
      model: {
        id: 1,
        modelName: 'Llama-3B',
        source: 'remote',
        isDownloaded: true,
        modelPath: '',
        tokenizerPath: '',
        tokenizerConfigPath: '',
        thinking: false,
        featured: false,
      },
    });
    expect(screen.getByTestId('model-card')).toBeTruthy();
  });

  it('hides model card when no model provided', () => {
    renderForm({ model: undefined });
    expect(screen.queryByTestId('model-card')).toBeNull();
  });

  it('always shows Context Window and System Prompt fields', () => {
    renderForm();
    expect(screen.getByText('Context Window')).toBeTruthy();
    expect(screen.getByText('System Prompt')).toBeTruthy();
  });
});

// ─── action buttons ───────────────────────────────────────────────────────────

describe('action buttons', () => {
  it('shows Export and Delete buttons for regular chats', () => {
    renderForm({ isDefaultSettings: false, isPhantomChat: false });
    expect(screen.getByTestId('secondary-Export Chat')).toBeTruthy();
    expect(screen.getByTestId('secondary-Delete Chat')).toBeTruthy();
  });

  it('hides Export and Delete buttons for default settings', () => {
    renderForm({ isDefaultSettings: true });
    expect(screen.queryByTestId('secondary-Export Chat')).toBeNull();
    expect(screen.queryByTestId('secondary-Delete Chat')).toBeNull();
  });

  it('hides Export and Delete buttons for phantom chats', () => {
    renderForm({ isPhantomChat: true });
    expect(screen.queryByTestId('secondary-Export Chat')).toBeNull();
    expect(screen.queryByTestId('secondary-Delete Chat')).toBeNull();
  });

  it('always shows App Info button', () => {
    renderForm();
    expect(screen.getByText('App Info')).toBeTruthy();
  });

  it('calls onDelete when Delete Chat pressed', () => {
    const onDelete = jest.fn();
    renderForm({ onDelete });
    fireEvent.press(screen.getByTestId('secondary-Delete Chat'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('calls onExport when Export Chat pressed', () => {
    const onExport = jest.fn();
    renderForm({ onExport });
    fireEvent.press(screen.getByTestId('secondary-Export Chat'));
    expect(onExport).toHaveBeenCalled();
  });

  it('calls onAppInfo when App Info pressed', () => {
    const onAppInfo = jest.fn();
    renderForm({ onAppInfo });
    fireEvent.press(screen.getByTestId('entry-App Info'));
    expect(onAppInfo).toHaveBeenCalled();
  });
});

// ─── system prompt editability ────────────────────────────────────────────────

describe('system prompt editability', () => {
  it('is editable for default settings', () => {
    renderForm({ isDefaultSettings: true });
    const input = screen.getByTestId('system-prompt-input');
    expect(input.props.editable).toBe(true);
  });

  it('is editable for phantom chat', () => {
    renderForm({ isPhantomChat: true });
    const input = screen.getByTestId('system-prompt-input');
    expect(input.props.editable).toBe(true);
  });

  it('is not editable for regular existing chats', () => {
    renderForm({ isDefaultSettings: false, isPhantomChat: false });
    const input = screen.getByTestId('system-prompt-input');
    expect(input.props.editable).toBe(false);
  });
});

// ─── setSetting callbacks ─────────────────────────────────────────────────────

describe('setSetting callbacks', () => {
  it('calls setSetting with contextWindow when changed', () => {
    const setSetting = jest.fn();
    renderForm({ setSetting });
    fireEvent.changeText(screen.getByDisplayValue('6'), '10');
    expect(setSetting).toHaveBeenCalledWith('contextWindow', '10');
  });
});
