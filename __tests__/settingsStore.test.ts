import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings } from 'react-native-pulsar';
import { useSettingsStore } from '../store/settingsStore';
import { MAX_CUSTOM_SYSTEM_PROMPT_LENGTH } from '../constants/settings';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      customSystemPrompt: '',
      showPerformanceMetrics: false,
      themePreference: 'system',
    });
  });

  it('follows the system theme until the user picks one', () => {
    expect(useSettingsStore.getState().themePreference).toBe('system');
    useSettingsStore.getState().setThemePreference('dark');
    expect(useSettingsStore.getState().themePreference).toBe('dark');
  });

  it('defaults to an empty custom system prompt', () => {
    expect(useSettingsStore.getState().customSystemPrompt).toBe('');
  });

  it('stores a custom system prompt', () => {
    useSettingsStore.getState().setCustomSystemPrompt('Be concise.');
    expect(useSettingsStore.getState().customSystemPrompt).toBe('Be concise.');
  });

  it('trims surrounding whitespace', () => {
    useSettingsStore.getState().setCustomSystemPrompt('  Be concise.  ');
    expect(useSettingsStore.getState().customSystemPrompt).toBe('Be concise.');
  });

  it('clamps a prompt longer than the limit', () => {
    const tooLong = 'a'.repeat(MAX_CUSTOM_SYSTEM_PROMPT_LENGTH + 50);
    useSettingsStore.getState().setCustomSystemPrompt(tooLong);
    expect(useSettingsStore.getState().customSystemPrompt).toHaveLength(
      MAX_CUSTOM_SYSTEM_PROMPT_LENGTH
    );
  });

  it('keeps a prompt at exactly the limit intact', () => {
    const exact = 'a'.repeat(MAX_CUSTOM_SYSTEM_PROMPT_LENGTH);
    useSettingsStore.getState().setCustomSystemPrompt(exact);
    expect(useSettingsStore.getState().customSystemPrompt).toBe(exact);
  });

  it('hides performance metrics by default', () => {
    expect(useSettingsStore.getInitialState().showPerformanceMetrics).toBe(
      false
    );
  });

  it('toggles performance metrics on and off', () => {
    useSettingsStore.getState().setShowPerformanceMetrics(true);
    expect(useSettingsStore.getState().showPerformanceMetrics).toBe(true);

    useSettingsStore.getState().setShowPerformanceMetrics(false);
    expect(useSettingsStore.getState().showPerformanceMetrics).toBe(false);
  });
});

describe('haptics setting', () => {
  beforeEach(() => {
    (Settings.enableHaptics as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
  });

  it('is on by default', () => {
    expect(useSettingsStore.getInitialState().hapticsEnabled).toBe(true);
  });

  it('switches the haptics engine off and persists the choice when toggled off', async () => {
    useSettingsStore.getState().setHapticsEnabled(false);

    expect(Settings.enableHaptics).toHaveBeenCalledWith(false);
    expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
    await Promise.resolve();
    const persisted = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1);
    expect(JSON.parse(persisted[1]).state.hapticsEnabled).toBe(false);
  });

  it('switches the haptics engine back on when toggled on', () => {
    useSettingsStore.getState().setHapticsEnabled(false);
    (Settings.enableHaptics as jest.Mock).mockClear();
    useSettingsStore.getState().setHapticsEnabled(true);

    expect(Settings.enableHaptics).toHaveBeenCalledWith(true);
  });

  it('applies a stored off value to the haptics engine at hydration', async () => {
    await AsyncStorage.setItem(
      'app-settings',
      JSON.stringify({ state: { hapticsEnabled: false }, version: 0 })
    );
    (Settings.enableHaptics as jest.Mock).mockClear();

    await useSettingsStore.persist.rehydrate();

    expect(Settings.enableHaptics).toHaveBeenCalledWith(false);
    expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
  });

  it('keeps haptics on at hydration when nothing is stored', async () => {
    await AsyncStorage.removeItem('app-settings');
    useSettingsStore.setState({ hapticsEnabled: true });
    (Settings.enableHaptics as jest.Mock).mockClear();

    await useSettingsStore.persist.rehydrate();

    expect(Settings.enableHaptics).toHaveBeenLastCalledWith(true);
  });
});
