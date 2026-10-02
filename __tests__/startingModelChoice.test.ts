import { keepStartingModelChoice } from '../utils/startingModelChoice';
import { Model } from '../database/modelRepository';

const model = (id: number): Model => ({
  id,
  modelName: `Model ${id}`,
  source: 'remote',
  isDownloaded: true,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  thinking: false,
  featured: false,
});

describe('keepStartingModelChoice', () => {
  it('keeps the model the user picked when another download finishes', () => {
    const [first, picked, finishedLater] = [model(1), model(2), model(3)];

    expect(
      keepStartingModelChoice(
        picked,
        [first, picked, finishedLater],
        [first, picked, finishedLater]
      )
    ).toBe(picked);
  });

  it('picks a downloaded model from the list on screen before any other', () => {
    const elsewhere = model(9);
    const onScreen = model(2);

    expect(
      keepStartingModelChoice(null, [elsewhere, onScreen], [model(1), onScreen])
    ).toBe(onScreen);
  });

  it('moves off a pick that is no longer downloaded', () => {
    const removed = model(1);
    const remaining = model(2);

    expect(
      keepStartingModelChoice(removed, [remaining], [removed, remaining])
    ).toBe(remaining);
  });

  it('selects nothing while no model is downloaded', () => {
    expect(keepStartingModelChoice(null, [], [model(1)])).toBeNull();
  });
});
