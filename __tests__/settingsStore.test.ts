import { useSettingsStore } from '../store/settingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ customSystemPrompt: '' });
  });

  it('defaults to an empty custom system prompt', () => {
    expect(useSettingsStore.getState().customSystemPrompt).toBe('');
  });

  it('stores a custom system prompt', () => {
    useSettingsStore.getState().setCustomSystemPrompt('Be concise.');
    expect(useSettingsStore.getState().customSystemPrompt).toBe('Be concise.');
  });
});
