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

  it('keeps the automatic conversation memory until the user picks a level', () => {
    expect(useSettingsStore.getState().conversationMemory).toBe('auto');
    useSettingsStore.getState().setConversationMemory('high');
    expect(useSettingsStore.getState().conversationMemory).toBe('high');
    useSettingsStore.getState().setConversationMemory('auto');
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

describe('conversation memory persistence', () => {
  const STORAGE_KEY = 'app-settings';

  const seedStorage = (state: Record<string, unknown>, version = 0) =>
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));

  const flushWrites = () => new Promise((resolve) => setTimeout(resolve, 0));

  const storedMemory = async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return JSON.parse(raw ?? '{}').state.conversationMemory;
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    useSettingsStore.setState({ conversationMemory: 'auto' });
  });

  it('writes the chosen level to storage as soon as it is set', async () => {
    useSettingsStore.getState().setConversationMemory('high');
    await flushWrites();
    expect(await storedMemory()).toBe('high');
  });

  it('restores the stored level on rehydrate', async () => {
    await seedStorage({ conversationMemory: 'low' });
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().conversationMemory).toBe('low');
    expect(useSettingsStore.getState().hasHydrated).toBe(true);
  });

  it('round-trips through a fresh store as an app restart would', async () => {
    useSettingsStore.getState().setConversationMemory('high');
    await flushWrites();
    const persistedBytes = await AsyncStorage.getItem(STORAGE_KEY);
    let restarted: typeof useSettingsStore | undefined;
    jest.isolateModules(() => {
      const freshStorage = require('@react-native-async-storage/async-storage')
        .default as typeof AsyncStorage;
      freshStorage.setItem(STORAGE_KEY, persistedBytes ?? '');
      restarted = require('../store/settingsStore').useSettingsStore;
    });
    await flushWrites();
    expect(restarted?.getState().hasHydrated).toBe(true);
    expect(restarted?.getState().conversationMemory).toBe('high');
  });

  it('gives an install with no stored value the auto level', async () => {
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().conversationMemory).toBe('auto');
  });

  it('gives an install that predates the field the auto level', async () => {
    await seedStorage({ themePreference: 'dark' });
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().conversationMemory).toBe('auto');
    expect(useSettingsStore.getState().themePreference).toBe('dark');
  });

  it.each(['huge', 3, null, ''])(
    'falls back to auto for the invalid stored value %p',
    async (invalid) => {
      await seedStorage({ conversationMemory: invalid });
      await useSettingsStore.persist.rehydrate();
      expect(useSettingsStore.getState().conversationMemory).toBe('auto');
    }
  );
});

describe('dictation language persistence', () => {
  const STORAGE_KEY = 'app-settings';

  const flushWrites = () => new Promise((resolve) => setTimeout(resolve, 0));

  const storedDictationLanguage = async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return JSON.parse(raw ?? '{}').state.dictationLanguage;
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    useSettingsStore.setState({ dictationLanguage: 'phone' });
  });

  it('follows the phone language until the user picks one', () => {
    expect(useSettingsStore.getInitialState().dictationLanguage).toBe('phone');
  });

  it('remembers the picked language across launches', async () => {
    useSettingsStore.getState().setDictationLanguage('pl');
    await flushWrites();

    expect(await storedDictationLanguage()).toBe('pl');
    const persistedBytes = await AsyncStorage.getItem(STORAGE_KEY);

    useSettingsStore.setState({ dictationLanguage: 'phone' });
    await AsyncStorage.setItem(STORAGE_KEY, persistedBytes ?? '');
    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().dictationLanguage).toBe('pl');
  });

  it('goes back to the phone language when the stored value is not a language', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { dictationLanguage: 'xx' }, version: 0 })
    );

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().dictationLanguage).toBe('phone');
  });

  it('starts settings saved before this setting existed on the phone language', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { hapticsEnabled: true }, version: 0 })
    );

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().dictationLanguage).toBe('phone');
  });
});
