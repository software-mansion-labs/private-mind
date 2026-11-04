import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ModelCapabilityBadges from '../components/model-hub/ModelCapabilityBadges';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { type Model } from '../database/modelRepository';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));
jest.mock('../utils/modelCompatibility', () => ({
  isModelCompatible: () => true,
  incompatibilityLabel: () => 'Needs 8 GB RAM',
}));

const downloaded: Model = {
  id: 1,
  modelName: 'Qwen 3 - 0.6B',
  source: 'built-in',
  isDownloaded: true,
  modelPath: 'https://hf.example/v0.11.0/model.pte',
  tokenizerPath: 'https://hf.example/v0.11.0/tokenizer.json',
  tokenizerConfigPath: 'https://hf.example/v0.11.0/tokenizer_config.json',
};

describe('the update badge on a model', () => {
  it('marks a downloaded model whose files predate the current engine', () => {
    render(
      <ModelCapabilityBadges
        model={{
          ...downloaded,
          outdatedSources: ['https://hf.example/v0.9.0/model.pte'],
        }}
      />
    );

    expect(screen.getByText(MODEL_UPDATE_TEXT.badge)).toBeTruthy();
  });

  it('leaves a model on the current files unmarked', () => {
    render(<ModelCapabilityBadges model={downloaded} />);

    expect(screen.queryByText(MODEL_UPDATE_TEXT.badge)).toBeNull();
  });
});
