import { useSettingsStore } from '../store/settingsStore';
import { MAX_CUSTOM_SYSTEM_PROMPT_LENGTH } from '../constants/settings';

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
});
