import {
  contextSizeOptionsFor,
  effectiveContextSize,
  type ContextSizeEnvironment,
} from '../utils/contextSizeOptions';
import type { Model } from '../database/modelRepository';

const model: Model = {
  id: 11,
  modelName: 'LFM 3 - 1.7B',
  source: 'remote',
  isDownloaded: true,
  modelPath: '/models/lfm3.pte',
  tokenizerPath: '/models/tokenizer.json',
  tokenizerConfigPath: '/models/tokenizer_config.json',
};

const env = (overrides: Partial<ContextSizeEnvironment>) => ({
  model,
  deviceRamGB: 8,
  deviceName: 'Pixel 9',
  modelCapacityTokens: 8192,
  modelFitsDevice: true,
  ...overrides,
});

type Level = 'low' | 'medium' | 'high' | 'auto';

const optionFor = (
  overrides: Partial<ContextSizeEnvironment>,
  level: Level
) => {
  const option = contextSizeOptionsFor(env(overrides)).find(
    (candidate) => candidate.level === level
  );
  if (!option) throw new Error(`no ${level} option`);
  return option;
};

describe('contextSizeOptionsFor', () => {
  it('offers Auto first, then Low, Medium, High', () => {
    expect(contextSizeOptionsFor(env({})).map((o) => o.level)).toEqual([
      'auto',
      'low',
      'medium',
      'high',
    ]);
  });

  it('labels them for the screen', () => {
    expect(contextSizeOptionsFor(env({})).map((o) => o.label)).toEqual([
      'Auto',
      'Low',
      'Medium',
      'High',
    ]);
  });

  describe('a 4 GB phone', () => {
    const phone = { deviceRamGB: 4 };

    it.each(['medium', 'high'] as const)(
      'disables %s, names the device and shows no size',
      (level) => {
        const option = optionFor(phone, level);
        expect(option.disabled).toBe(true);
        expect(option.size).toBeNull();
        expect(option.note).toMatch(/is not available on Pixel 9\.$/);
      }
    );

    it('keeps Low and Auto selectable', () => {
      expect(optionFor(phone, 'low').disabled).toBe(false);
      expect(optionFor(phone, 'auto').disabled).toBe(false);
    });

    it('says why Medium and High are off before a model is chosen', () => {
      expect(optionFor({ ...phone, model: null }, 'medium').note).toBe(
        'Medium is not available on Pixel 9.'
      );
      expect(optionFor({ ...phone, model: null }, 'high').note).toBe(
        'High is not available on Pixel 9.'
      );
    });
  });

  describe('a 6 GB phone', () => {
    const phone = { deviceRamGB: 6 };

    it('gives Medium 4k with no note', () => {
      expect(optionFor(phone, 'medium')).toMatchObject({
        disabled: false,
        size: '4k',
        note: null,
      });
    });

    it('lets High be picked but shows its real 4k and says it equals Medium', () => {
      expect(optionFor(phone, 'high')).toMatchObject({
        disabled: false,
        size: '4k',
        note: 'Same as Medium on this phone',
      });
    });
  });

  describe('an 8 GB or larger phone', () => {
    it('gives Low 2k, Medium 4k and High 8k', () => {
      expect(optionFor({}, 'low').size).toBe('2k');
      expect(optionFor({}, 'medium').size).toBe('4k');
      expect(optionFor({}, 'high').size).toBe('8k');
    });

    it('holds High at 4k when the model does not fit the phone', () => {
      expect(optionFor({ modelFitsDevice: false }, 'high')).toMatchObject({
        size: '4k',
        note: 'Same as Medium on this phone',
      });
    });
  });

  describe.each([
    [2048, '2k', 'This model goes up to 2k', '2k', 'This model goes up to 2k'],
    [4096, '4k', null, '4k', 'Same as Medium on this phone'],
    [8192, '4k', null, '8k', null],
  ])(
    'a model with a %i token export on an 8 GB phone',
    (capacity, mediumSize, mediumNote, highSize, highNote) => {
      it('reports what Medium and High really give', () => {
        expect(
          optionFor({ modelCapacityTokens: capacity }, 'medium')
        ).toMatchObject({ size: mediumSize, note: mediumNote });
        expect(
          optionFor({ modelCapacityTokens: capacity }, 'high')
        ).toMatchObject({ size: highSize, note: highNote });
      });
    }
  );

  it('shows what the phone allows until the model has reported its own limit', () => {
    expect(
      optionFor({ modelCapacityTokens: undefined }, 'medium')
    ).toMatchObject({ size: '4k', note: null, disabled: false });
    expect(optionFor({ modelCapacityTokens: undefined }, 'high')).toMatchObject(
      {
        size: '8k',
        note: null,
        disabled: false,
      }
    );
  });

  it.each([2048, 4096, 8192, undefined])(
    'gives Auto no size and no note with a %s model on any phone',
    (capacity) => {
      for (const deviceRamGB of [4, 6, 8, 12]) {
        const auto = optionFor(
          { deviceRamGB, modelCapacityTokens: capacity },
          'auto'
        );
        expect(auto.size).toBeNull();
        expect(auto.note).toBeNull();
      }
    }
  );

  it('describes Auto as going larger only for a document that fits whole', () => {
    expect(optionFor({}, 'auto').description).toBe(
      'Picks the size for you. Goes larger only to read an attached document whole, when it fits.'
    );
  });

  it.each([4, 6, 8, 12])(
    'never claims Low is smaller than the base on a %s GB phone',
    (deviceRamGB) => {
      for (const modelCapacityTokens of [2048, 4096, 8192]) {
        expect(
          optionFor({ deviceRamGB, modelCapacityTokens }, 'low')
        ).toMatchObject({ size: '2k', note: null });
      }
    }
  );

  it('shows no sizes before a model is chosen', () => {
    expect(optionFor({ model: null }, 'low').size).toBeNull();
    expect(optionFor({ model: null }, 'auto').size).toBeNull();
  });
});

describe('effectiveContextSize', () => {
  it.each(['medium', 'high'] as const)(
    'shows a stored %s as Auto on a phone that cannot honour it',
    (level) => {
      expect(effectiveContextSize(level, 4)).toBe('auto');
    }
  );

  it.each(['medium', 'high'] as const)('keeps %s from 6 GB up', (level) => {
    expect(effectiveContextSize(level, 6)).toBe(level);
  });

  it.each(['low', 'auto'] as const)('keeps %s anywhere', (level) => {
    expect(effectiveContextSize(level, 3)).toBe(level);
  });
});
