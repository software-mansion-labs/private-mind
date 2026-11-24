import {
  decideAutoWindow,
  type AutoWindowInput,
} from '../constants/auto-window';
import {
  EXTENDED_CONTEXT_WINDOW_TOKENS,
  LARGE_CONTEXT_WINDOW_TOKENS,
  getConversationWindowTokens,
  CONVERSATION_MEMORY_LEVELS,
  type ConversationMemory,
} from '../constants/context-window';
import { planTurnWindow, type AttachedDocument } from '../utils/planTurnWindow';
import * as contextUtils from '../utils/contextUtils';
import { retrievalStatsLines } from '../utils/retrievalStatsLine';
import type { Model } from '../database/modelRepository';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';

jest.mock('../utils/modelCompatibility', () => ({
  getDeviceMemoryGB: () => 11.3,
  isModelCompatibleWithRam: () => true,
}));

jest.mock('../utils/modelContextCapacity', () => ({
  modelContextCapacity: () => 8192,
}));

const model = {
  id: 11,
  modelName: 'LFM 3 - 1.7B',
  source: 'remote',
  isDownloaded: true,
  modelPath: '/models/lfm3.pte',
  tokenizerPath: '/models/tokenizer.json',
  tokenizerConfigPath: '/models/tokenizer_config.json',
} as Model;

const WHOLE_BUDGET = 4000;

const capable: AutoWindowInput = {
  memory: 'auto',
  thinking: false,
  deviceRamGB: 11.3,
  modelCapacityTokens: 8192,
  modelFitsDevice: true,
  documentAttached: false,
  documentTokens: 0,
  wholeDocumentBudgetTokens: WHOLE_BUDGET,
};

const decide = (
  overrides: Partial<AutoWindowInput> & { historyTokens?: number } = {}
) => decideAutoWindow({ ...capable, ...overrides });

describe('decideAutoWindow', () => {
  it.each([
    {
      name: 'a conversation with no document',
      overrides: {},
      ceilingTokens: 4096,
      reason: 'no-document',
    },
    {
      name: 'a long conversation with no document',
      overrides: { historyTokens: 9000 },
      ceilingTokens: 4096,
      reason: 'no-document',
    },
    {
      name: 'a document that fits whole in the 8192 budget',
      overrides: { documentAttached: true, documentTokens: 3000 },
      ceilingTokens: 8192,
      reason: 'whole-document',
    },
    {
      name: 'a document exactly as large as the whole-document budget',
      overrides: { documentAttached: true, documentTokens: WHOLE_BUDGET },
      ceilingTokens: 8192,
      reason: 'whole-document',
    },
    {
      name: 'a document one token over the whole-document budget',
      overrides: { documentAttached: true, documentTokens: WHOLE_BUDGET + 1 },
      ceilingTokens: 4096,
      reason: 'document-too-large',
    },
    {
      name: 'an attachment that could not be measured',
      overrides: { documentAttached: true, documentTokens: 0 },
      ceilingTokens: 4096,
      reason: 'document-too-large',
    },
    {
      name: 'a long history beside a document that does not fit',
      overrides: {
        documentAttached: true,
        documentTokens: WHOLE_BUDGET + 1,
        historyTokens: 9000,
      },
      ceilingTokens: 4096,
      reason: 'document-too-large',
    },
    {
      name: 'a weak device with a document that fits',
      overrides: {
        deviceRamGB: 5.6,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 4096,
      reason: 'weak-device',
    },
    {
      name: 'a 7 GB phone with a document that fits',
      overrides: {
        deviceRamGB: 6.6,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 4096,
      reason: 'weak-device',
    },
    {
      name: 'an 8 GB phone with a document that fits',
      overrides: {
        deviceRamGB: 7.5,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 8192,
      reason: 'whole-document',
    },
    {
      name: 'thinking on with a document that fits',
      overrides: {
        thinking: true,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 4096,
      reason: 'thinking',
    },
    {
      name: 'a 4096-capacity model with a document that fits',
      overrides: {
        modelCapacityTokens: 4096,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 4096,
      reason: 'small-capacity',
    },
    {
      name: 'unknown capacity with a document that fits',
      overrides: {
        modelCapacityTokens: undefined,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 4096,
      reason: 'unknown-capacity',
    },
    {
      name: 'a model the memory gate refuses on this device',
      overrides: {
        modelFitsDevice: false,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 4096,
      reason: 'memory-gate',
    },
    {
      name: 'Low memory with a document that fits',
      overrides: {
        memory: 'low' as const,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 4096,
      reason: 'not-auto',
    },
    {
      name: 'Medium memory with a document that fits',
      overrides: {
        memory: 'medium' as const,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 4096,
      reason: 'not-auto',
    },
    {
      name: 'High memory with a document that fits',
      overrides: {
        memory: 'high' as const,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 8192,
      reason: 'whole-document',
    },
    {
      name: 'High memory with a document that does not fit',
      overrides: {
        memory: 'high' as const,
        documentAttached: true,
        documentTokens: WHOLE_BUDGET + 1,
      },
      ceilingTokens: 4096,
      reason: 'not-auto',
    },
    {
      name: 'High memory with no document',
      overrides: { memory: 'high' as const },
      ceilingTokens: 4096,
      reason: 'not-auto',
    },
    {
      name: 'High memory with thinking on and a document that fits',
      overrides: {
        memory: 'high' as const,
        thinking: true,
        documentAttached: true,
        documentTokens: 3000,
      },
      ceilingTokens: 4096,
      reason: 'thinking',
    },
  ])(
    'the window rises only for a document that fits whole: $name',
    ({ overrides, ceilingTokens, reason }) => {
      expect(decide(overrides)).toEqual({ ceilingTokens, reason });
    }
  );
});

describe('no path gives a weak device the larger window', () => {
  const window = (
    deviceRamGB: number,
    memory: ConversationMemory,
    ceilingTokens?: number
  ) =>
    getConversationWindowTokens(model, {
      thinking: false,
      deviceRamGB,
      modelCapacityTokens: 8192,
      memory,
      ceilingTokens,
    });

  it.each([3.7, 5.6, 6.6])(
    'a %s GB phone stays below 8192 even when asked for it',
    (ram) => {
      expect(window(ram, 'auto', LARGE_CONTEXT_WINDOW_TOKENS)).toBeLessThan(
        LARGE_CONTEXT_WINDOW_TOKENS
      );
    }
  );

  it('a 4 GB phone stays at the base window when asked for 8192', () => {
    expect(window(3.7, 'auto', LARGE_CONTEXT_WINDOW_TOKENS)).toBe(2048);
  });

  it('a 6 GB phone gets 4096 at most', () => {
    expect(window(5.6, 'auto', LARGE_CONTEXT_WINDOW_TOKENS)).toBe(4096);
  });

  it('High without the footprint gate stays at 4096, even on a 12 GB phone', () => {
    expect(window(11.3, 'high', LARGE_CONTEXT_WINDOW_TOKENS)).toBe(4096);
  });

  it('High on a weak phone gets the base window', () => {
    expect(window(3.7, 'high', LARGE_CONTEXT_WINDOW_TOKENS)).toBe(2048);
  });

  it('Low ignores the larger ceiling', () => {
    expect(window(11.3, 'low', LARGE_CONTEXT_WINDOW_TOKENS)).toBeLessThan(
      EXTENDED_CONTEXT_WINDOW_TOKENS
    );
  });

  it('a 12 GB phone gets 8192 in Auto when the turn asked for it', () => {
    expect(window(11.3, 'auto', LARGE_CONTEXT_WINDOW_TOKENS)).toBe(8192);
  });

  it('without a ceiling Auto behaves as before', () => {
    expect(window(11.3, 'auto')).toBe(4096);
  });
});

describe('the window planned for each turn of a chat', () => {
  const report: AttachedDocument[] = [{ sourceId: 5, name: 'harbour.txt' }];
  const vectorStoreHolding = (
    document: string,
    rows: { id: string; document: string }[] = [{ id: '5:0', document }]
  ) => {
    const execute = jest.fn().mockResolvedValue({ rows });
    return {
      execute,
      store: { db: { execute } } as unknown as OPSQLiteVectorStore,
    };
  };
  const turn = async (
    attachedDocuments: AttachedDocument[],
    {
      document = 'cranes, ferries and tides of the harbour',
      memory = 'auto',
      thinkingEnabled = false,
    }: {
      document?: string;
      memory?: ConversationMemory;
      thinkingEnabled?: boolean;
    } = {}
  ) => {
    const { store, execute } = vectorStoreHolding(document);
    const planned = await planTurnWindow({
      model: { ...model, thinking: true },
      memory,
      thinkingEnabled,
      attachedDocuments,
      vectorStore: store,
    });
    return { planned, execute };
  };

  it('raises the window to 8192 and passes the whole document it fits', async () => {
    expect((await turn(report)).planned).toEqual({
      memory: 'auto',
      stats: { tokens: 8192, reason: 'whole-document' },
      ceilingTokens: 8192,
      passesWholeDocument: true,
    });
  });

  it('goes back to 4096 on the next conversation turn after a document turn', async () => {
    await turn(report);

    expect((await turn([])).planned).toEqual({
      memory: 'auto',
      stats: { tokens: 4096, reason: 'no-document' },
      ceilingTokens: 4096,
      passesWholeDocument: false,
    });
  });

  it('keeps 4096 and retrieves passages for a document too large to pass whole', async () => {
    expect(
      (await turn(report, { document: 'tide '.repeat(20_000) })).planned
    ).toEqual({
      memory: 'auto',
      stats: { tokens: 4096, reason: 'document-too-large' },
      ceilingTokens: 4096,
      passesWholeDocument: false,
    });
  });

  it('passes a document that fits whole on High, where the window is already 8192', async () => {
    expect((await turn(report, { memory: 'high' })).planned).toEqual({
      memory: 'high',
      stats: { tokens: 8192, reason: 'whole-document' },
      ceilingTokens: 8192,
      passesWholeDocument: true,
    });
  });

  it.each([
    { name: 'Low', memory: 'low' as const, thinkingEnabled: false },
    { name: 'Medium', memory: 'medium' as const, thinkingEnabled: false },
    { name: 'thinking on', memory: 'auto' as const, thinkingEnabled: true },
  ])(
    'does not read the attached document when the window cannot rise: $name',
    async ({ memory, thinkingEnabled }) => {
      const { planned, execute } = await turn(report, {
        memory,
        thinkingEnabled,
      });

      expect(execute).not.toHaveBeenCalled();
      expect(planned.passesWholeDocument).toBe(false);
    }
  );

  it('does not pass a document whole when one of the attachments has no chunks', async () => {
    const { store } = vectorStoreHolding('', []);

    const planned = await planTurnWindow({
      model,
      memory: 'auto',
      thinkingEnabled: false,
      attachedDocuments: report,
      vectorStore: store,
    });

    expect(planned.stats.reason).toBe('document-too-large');
  });

  it('stops measuring a document once it is clearly past the budget', async () => {
    const formatted = jest.spyOn(contextUtils, 'formatContextChunks');
    const { store } = vectorStoreHolding('', [
      { id: '5:0', document: 'tide '.repeat(20_000) },
      { id: '5:1', document: 'cranes' },
    ]);

    await planTurnWindow({
      model,
      memory: 'auto',
      thinkingEnabled: false,
      attachedDocuments: report,
      vectorStore: store,
    });

    expect(formatted).not.toHaveBeenCalled();
    formatted.mockRestore();
  });

  it('reads one document by its key range rather than a LIKE scan', async () => {
    const { execute } = await turn(report);

    expect(execute).toHaveBeenCalledWith(
      'SELECT id, document FROM vectors WHERE id >= ? AND id < ?',
      ['5:', '5;']
    );
  });
});

describe('window in the per-turn stats', () => {
  it('prints the window and the reason beside the retrieval stats', () => {
    expect(
      retrievalStatsLines({
        window: { tokens: 8192, reason: 'whole-document' },
      })
    ).toEqual(['window: 8192 tokens, whole-document']);
  });
});

describe('the four levels on each phone and model', () => {
  const windowFor = (
    memory: ConversationMemory,
    deviceRamGB: number,
    modelCapacityTokens: number | undefined,
    extra: { thinking?: boolean; modelFitsDevice?: boolean } = {}
  ) =>
    getConversationWindowTokens(model, {
      thinking: false,
      deviceRamGB,
      modelCapacityTokens,
      memory,
      modelFitsDevice: true,
      ...extra,
    });

  it.each([
    {
      name: 'Low on a 12 GB phone is the base window',
      memory: 'low',
      ram: 11.3,
      capacity: 8192,
      expected: 2048,
    },
    {
      name: 'Low on a 4 GB phone is the base window',
      memory: 'low',
      ram: 3.7,
      capacity: 8192,
      expected: 2048,
    },
    {
      name: 'Low on a 6 GB phone is the base window',
      memory: 'low',
      ram: 5.6,
      capacity: 4096,
      expected: 2048,
    },
    {
      name: 'Low with a 2048 model is the base window',
      memory: 'low',
      ram: 11.3,
      capacity: 2048,
      expected: 2048,
    },
    {
      name: 'Low with unknown capacity is the base window',
      memory: 'low',
      ram: 11.3,
      capacity: undefined,
      expected: 2048,
    },
    {
      name: 'Medium on a 4 GB phone is the base window',
      memory: 'medium',
      ram: 3.7,
      capacity: 8192,
      expected: 2048,
    },
    {
      name: 'Medium on a 6 GB phone',
      memory: 'medium',
      ram: 5.6,
      capacity: 8192,
      expected: 4096,
    },
    {
      name: 'Medium on a 12 GB phone is still 4096',
      memory: 'medium',
      ram: 11.3,
      capacity: 8192,
      expected: 4096,
    },
    {
      name: 'Medium with a 2048 model is the base',
      memory: 'medium',
      ram: 11.3,
      capacity: 2048,
      expected: 2048,
    },
    {
      name: 'Medium with a 4096 model',
      memory: 'medium',
      ram: 11.3,
      capacity: 4096,
      expected: 4096,
    },
    {
      name: 'Medium with unknown capacity is the base',
      memory: 'medium',
      ram: 11.3,
      capacity: undefined,
      expected: 2048,
    },
    {
      name: 'High on a 4 GB phone is the base window',
      memory: 'high',
      ram: 3.7,
      capacity: 8192,
      expected: 2048,
    },
    {
      name: 'High on a 6 GB phone resolves to 4096',
      memory: 'high',
      ram: 5.6,
      capacity: 8192,
      expected: 4096,
    },
    {
      name: 'High on a 7 GB phone resolves to 4096',
      memory: 'high',
      ram: 6.6,
      capacity: 8192,
      expected: 4096,
    },
    {
      name: 'High on an 8 GB phone with an 8192 model',
      memory: 'high',
      ram: 7.5,
      capacity: 8192,
      expected: 8192,
    },
    {
      name: 'High on a 12 GB phone with a 16384 model',
      memory: 'high',
      ram: 11.3,
      capacity: 16384,
      expected: 8192,
    },
    {
      name: 'High with a 4096 model resolves to 4096',
      memory: 'high',
      ram: 11.3,
      capacity: 4096,
      expected: 4096,
    },
    {
      name: 'High with a 2048 model is the base',
      memory: 'high',
      ram: 11.3,
      capacity: 2048,
      expected: 2048,
    },
    {
      name: 'High with unknown capacity is the base',
      memory: 'high',
      ram: 11.3,
      capacity: undefined,
      expected: 2048,
    },
    {
      name: 'Auto on a 4 GB phone is the base',
      memory: 'auto',
      ram: 3.7,
      capacity: 8192,
      expected: 2048,
    },
    {
      name: 'Auto on a 6 GB phone',
      memory: 'auto',
      ram: 5.6,
      capacity: 8192,
      expected: 4096,
    },
    {
      name: 'Auto on a 12 GB phone starts at 4096',
      memory: 'auto',
      ram: 11.3,
      capacity: 8192,
      expected: 4096,
    },
  ] as const)('$name', ({ memory, ram, capacity, expected }) => {
    expect(windowFor(memory, ram, capacity)).toBe(expected);
  });

  it('Low is the base window with or without sources', () => {
    for (const carriesSources of [false, true]) {
      expect(
        getConversationWindowTokens(model, {
          thinking: false,
          deviceRamGB: 11.3,
          modelCapacityTokens: 8192,
          memory: 'low',
          carriesSources,
        })
      ).toBe(2048);
    }
  });

  it('thinking holds High and Medium at the base', () => {
    expect(windowFor('high', 11.3, 8192, { thinking: true })).toBe(2048);
    expect(windowFor('medium', 11.3, 8192, { thinking: true })).toBe(2048);
  });

  it('a model the footprint gate refuses gets High at 4096', () => {
    expect(windowFor('high', 11.3, 8192, { modelFitsDevice: false })).toBe(
      4096
    );
  });

  it('no level gives 8192 below 8 GB', () => {
    const rams = [0, 3.7, 5.6, 6.6, 7.0];
    for (const memory of CONVERSATION_MEMORY_LEVELS) {
      for (const ram of rams) {
        expect(
          getConversationWindowTokens(model, {
            thinking: false,
            deviceRamGB: ram,
            modelCapacityTokens: 16384,
            memory,
            ceilingTokens: LARGE_CONTEXT_WINDOW_TOKENS,
            modelFitsDevice: true,
          })
        ).toBeLessThan(LARGE_CONTEXT_WINDOW_TOKENS);
      }
    }
  });
});
