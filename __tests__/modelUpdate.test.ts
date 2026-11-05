import { type Model } from '../database/modelRepository';
import {
  needsUpdate,
  pendingRetiredNotices,
  replacementsToDownload,
  updateSizeGB,
} from '../utils/modelUpdate';

const model = (id: number, overrides: Partial<Model>): Model => ({
  id,
  modelName: `Model ${id}`,
  source: 'built-in',
  isDownloaded: true,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  ...overrides,
});

describe('a model that needs its update', () => {
  it('is a download whose files the catalog moved past', () => {
    expect(needsUpdate(model(1, { outdatedSources: ['old.pte'] }))).toBe(true);
  });

  it('is not a model that was never downloaded', () => {
    expect(
      needsUpdate(
        model(1, { isDownloaded: false, outdatedSources: ['old.pte'] })
      )
    ).toBe(false);
  });
});

describe('the replacement of a removed model', () => {
  const spinQuant = model(8, {
    modelName: 'LLaMA 3.2 - 1B - SpinQuant',
    isDownloaded: false,
  });
  const retired = [
    {
      modelName: 'LLaMA 3.2 - 1B - QLoRa',
      replacement: 'LLaMA 3.2 - 1B - SpinQuant',
    },
  ];

  it('is offered for download while it is not on the phone', () => {
    expect(replacementsToDownload(retired, [spinQuant])).toEqual([spinQuant]);
  });

  it('is not offered once it is downloaded', () => {
    expect(
      replacementsToDownload(retired, [{ ...spinQuant, isDownloaded: true }])
    ).toEqual([]);
  });

  it('keeps the removal notice up until it is downloaded', () => {
    expect(pendingRetiredNotices(retired, [spinQuant])).toEqual(retired);
    expect(
      pendingRetiredNotices(retired, [{ ...spinQuant, isDownloaded: true }])
    ).toEqual([]);
  });
});

describe('the size of an update', () => {
  it('adds up the files every listed model downloads', () => {
    expect(
      updateSizeGB([
        model(1, { modelSize: 0.53 }),
        model(2, { modelSize: 1.09 }),
      ])
    ).toBeCloseTo(1.62);
  });
});
