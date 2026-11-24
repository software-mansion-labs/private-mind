import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import DeviceInfo from 'react-native-device-info';
import { StyleSheet } from 'react-native';
import SettingsRowGroup from '../components/settings/SettingsRowGroup';
import { ContextSizeSelector } from '../components/settings/ContextSizeSelector';
import { ContextSizeSettingRow } from '../components/settings/ContextSizeSettingRow';
import { useSettingsStore } from '../store/settingsStore';
import {
  forgetModelContextCapacities,
  rememberModelContextCapacity,
} from '../utils/modelContextCapacity';
import type { Model } from '../database/modelRepository';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { Pressable, ScrollView } = require('react-native');
  return { Pressable, ScrollView };
});

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

const GB = 1024 * 1024 * 1024;
const mockTotalMemory = DeviceInfo.getTotalMemorySync as jest.Mock;

const model: Model = {
  id: 11,
  modelName: 'LFM 3 - 1.7B',
  source: 'remote',
  isDownloaded: true,
  modelPath: '/models/lfm3.pte',
  tokenizerPath: '/models/tokenizer.json',
  tokenizerConfigPath: '/models/tokenizer_config.json',
};

const phoneWith = (ramGB: number) =>
  mockTotalMemory.mockReturnValue(ramGB * GB);

beforeEach(() => {
  phoneWith(11.3);
  rememberModelContextCapacity(model.id, 8192);
  useSettingsStore.setState({ conversationMemory: 'auto' });
});

afterEach(() => {
  forgetModelContextCapacities();
});

describe('ContextSizeSelector', () => {
  it('is a radio group with four radios', () => {
    render(<ContextSizeSelector model={model} />);
    const group = screen.getByTestId('context-size-group');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe('Context size');
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('marks the stored level as checked', () => {
    useSettingsStore.setState({ conversationMemory: 'low' });
    render(<ContextSizeSelector model={model} />);
    expect(
      screen.getByTestId('context-size-low').props.accessibilityState.checked
    ).toBe(true);
    expect(
      screen.getByTestId('context-size-auto').props.accessibilityState.checked
    ).toBe(false);
  });

  it('writes the pick to the store straight away', () => {
    render(<ContextSizeSelector model={model} />);
    fireEvent.press(screen.getByTestId('context-size-high'));
    expect(useSettingsStore.getState().conversationMemory).toBe('high');
  });

  it('follows the store when another entry point changes it', () => {
    render(<ContextSizeSelector model={model} />);
    act(() => {
      useSettingsStore.getState().setConversationMemory('low');
    });
    expect(
      screen.getByTestId('context-size-low').props.accessibilityState.checked
    ).toBe(true);
  });

  it('shows what each level gives on this phone and model', () => {
    render(<ContextSizeSelector model={model} />);
    expect(screen.getByTestId('model-badge-2k')).toBeTruthy();
    expect(screen.getByTestId('model-badge-4k')).toBeTruthy();
    expect(screen.getByTestId('model-badge-8k')).toBeTruthy();
    expect(screen.queryByTestId('context-size-auto-note')).toBeNull();
  });

  it('puts the badge on the label line and none on Auto', () => {
    render(<ContextSizeSelector model={model} />);
    expect(screen.getAllByTestId(/^model-badge-/)).toHaveLength(3);
  });

  it('keeps the badge when a row is selected and shows the check beside it', () => {
    useSettingsStore.setState({ conversationMemory: 'low' });
    render(<ContextSizeSelector model={model} />);
    expect(screen.getByTestId('model-badge-2k')).toBeTruthy();
    expect(screen.getByTestId('context-size-low-check')).toBeTruthy();
  });

  it('hides the separators next to the selected manual row only', () => {
    useSettingsStore.setState({ conversationMemory: 'medium' });
    const view = render(<ContextSizeSelector model={model} />);
    const groups = view.UNSAFE_getAllByType(SettingsRowGroup);
    expect(groups[0].props.selectedIndex).toBeUndefined();
    expect(groups[1].props.selectedIndex).toBe(1);
  });

  it('has no selected index in the manual group while Auto is chosen', () => {
    const view = render(<ContextSizeSelector model={model} />);
    expect(
      view.UNSAFE_getAllByType(SettingsRowGroup)[1].props.selectedIndex
    ).toBeUndefined();
  });

  it('draws Auto and the manual sizes as two grouped surfaces', () => {
    const view = render(<ContextSizeSelector model={model} />);
    const groups = view.UNSAFE_getAllByType(SettingsRowGroup);
    expect(groups).toHaveLength(2);
  });

  it('tints the selected row without touching the others', () => {
    useSettingsStore.setState({ conversationMemory: 'medium' });
    render(<ContextSizeSelector model={model} />);
    const flat = (id: string) =>
      StyleSheet.flatten(screen.getByTestId(id).props.style);
    expect(flat('context-size-medium').backgroundColor).toBeTruthy();
    expect(flat('context-size-low').backgroundColor).toBeUndefined();
    expect(flat('context-size-auto').backgroundColor).toBeUndefined();
  });

  it('marks the selected option with a trailing check and no other', () => {
    useSettingsStore.setState({ conversationMemory: 'medium' });
    render(<ContextSizeSelector model={model} />);
    expect(screen.getByTestId('context-size-medium-check')).toBeTruthy();
    expect(screen.queryByTestId('context-size-auto-check')).toBeNull();
    expect(screen.queryByTestId('context-size-high-check')).toBeNull();
  });

  it('draws Auto on its own, then a Manual group', () => {
    render(<ContextSizeSelector model={model} />);
    expect(screen.getByText('Manual')).toBeTruthy();
  });

  it('lists the radios Auto, Low, Medium, High in order', () => {
    render(<ContextSizeSelector model={model} />);
    expect(
      screen
        .getAllByRole('radio')
        .map((radio) => radio.props.accessibilityLabel)
    ).toEqual(['Auto', 'Low', 'Medium', 'High']);
  });

  it('writes Medium to the store', () => {
    render(<ContextSizeSelector model={model} />);
    fireEvent.press(screen.getByTestId('context-size-medium'));
    expect(useSettingsStore.getState().conversationMemory).toBe('medium');
  });

  it('disables Medium and High on a 4 GB phone', () => {
    phoneWith(4);
    render(<ContextSizeSelector model={model} />);
    for (const level of ['medium', 'high']) {
      expect(
        screen.getByTestId(`context-size-${level}`).props.accessibilityState
          .disabled
      ).toBe(true);
    }
  });

  it('disables High on a 4 GB phone and shows a stored High as Auto', () => {
    phoneWith(4);
    useSettingsStore.setState({ conversationMemory: 'high' });
    render(<ContextSizeSelector model={model} />);
    expect(
      screen.getByTestId('context-size-high').props.accessibilityState.disabled
    ).toBe(true);
    expect(
      screen.getByTestId('context-size-auto').props.accessibilityState.checked
    ).toBe(true);
    fireEvent.press(screen.getByTestId('context-size-high'));
    expect(useSettingsStore.getState().conversationMemory).toBe('high');
  });

  it('says High equals Medium on a 6 GB phone', () => {
    phoneWith(6);
    render(<ContextSizeSelector model={model} />);
    expect(screen.getByTestId('context-size-high-note')).toHaveTextContent(
      /Same as Medium on this phone/
    );
  });

  it('says how far a model without a larger export goes', () => {
    rememberModelContextCapacity(model.id, 2048);
    render(<ContextSizeSelector model={model} />);
    expect(screen.getByTestId('context-size-high-note')).toHaveTextContent(
      /This model goes up to 2k/
    );
  });

  it('shows the sizes the phone allows before the model has ever loaded', () => {
    forgetModelContextCapacities();
    render(<ContextSizeSelector model={model} />);
    expect(screen.queryByTestId('context-size-high-note')).toBeNull();
    expect(screen.getByTestId('context-size-high')).toHaveTextContent(/8k/);
  });

  it('ignores presses while disabled for a running generation', () => {
    render(<ContextSizeSelector model={model} disabled />);
    expect(
      screen.getByTestId('context-size-low').props.accessibilityState.disabled
    ).toBe(true);
    fireEvent.press(screen.getByTestId('context-size-low'));
    expect(useSettingsStore.getState().conversationMemory).toBe('auto');
  });
});

describe('both entry points share one stored value', () => {
  it('shows the saved level in the settings row after the selector changes it', () => {
    render(
      <>
        <ContextSizeSettingRow />
        <ContextSizeSelector model={model} testIDPrefix="composer" />
      </>
    );
    expect(screen.getByTestId('settings-context-size-value')).toHaveTextContent(
      'Auto'
    );
    fireEvent.press(screen.getByTestId('composer-low'));
    expect(screen.getByTestId('settings-context-size-value')).toHaveTextContent(
      'Low'
    );
    expect(useSettingsStore.getState().conversationMemory).toBe('low');
  });

  it('shows a stored High as Auto on a phone that cannot honour it', () => {
    phoneWith(4);
    useSettingsStore.setState({ conversationMemory: 'high' });
    render(<ContextSizeSettingRow />);
    expect(screen.getByTestId('settings-context-size-value')).toHaveTextContent(
      'Auto'
    );
  });
});
