import type { SQLiteDatabase } from 'expo-sqlite';
import { applyRefreshedCatalog } from '../database/catalogSync';
import { useModelStore } from '../store/modelStore';
import { getActiveCatalog, setActiveCatalog } from '../utils/modelCatalogState';
import { type CatalogModel } from '../utils/modelCatalogSchema';

const model = (modelName: string): CatalogModel => ({
  modelName,
  modelPath: `https://example.com/${modelName}.pte`,
  tokenizerPath: 'https://example.com/tokenizer.json',
  tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
  modelSize: 1,
  source: 'remote',
});

const makeDb = () => {
  const runAsync: jest.Mock = jest.fn(async () => ({ lastInsertRowId: 1 }));
  const withTransactionAsync = jest.fn(async (work: () => Promise<void>) =>
    work()
  );
  return {
    db: {
      runAsync,
      withTransactionAsync,
    } as Partial<SQLiteDatabase> as SQLiteDatabase,
    runAsync,
    withTransactionAsync,
  };
};

const insertedNames = (runAsync: jest.Mock): string[] =>
  runAsync.mock.calls
    .filter(([sql]) => String(sql).includes('INSERT OR IGNORE INTO models'))
    .map(([, params]) => (params as unknown[])[0] as string);

describe('applyRefreshedCatalog', () => {
  const loadModels = jest.fn(async () => {});

  beforeEach(() => {
    loadModels.mockClear();
    useModelStore.setState({ loadModels });
    setActiveCatalog([model('Old')]);
  });

  it('writes nothing when the refreshed catalog is the one already shown', async () => {
    const { db, runAsync } = makeDb();

    const applied = await applyRefreshedCatalog(
      db,
      [model('Old')],
      [model('Old')]
    );

    expect(applied).toBe(false);
    expect(runAsync).not.toHaveBeenCalled();
    expect(loadModels).not.toHaveBeenCalled();
  });

  it('adds a model published since the shown catalog and reloads the list', async () => {
    const { db, runAsync } = makeDb();

    const applied = await applyRefreshedCatalog(
      db,
      [model('Old')],
      [model('Old'), model('New')]
    );

    expect(applied).toBe(true);
    expect(insertedNames(runAsync)).toContain('New');
    expect(loadModels).toHaveBeenCalledTimes(1);
    expect(getActiveCatalog().map((m) => m.modelName)).toEqual(['Old', 'New']);
  });

  it('leaves a model that left the catalog in place until the next launch', async () => {
    const { db, runAsync } = makeDb();

    await applyRefreshedCatalog(
      db,
      [model('Old'), model('Gone')],
      [model('Old')]
    );

    const deletes = runAsync.mock.calls.filter(([sql]) =>
      String(sql).includes('DELETE FROM models')
    );
    expect(deletes).toHaveLength(0);
  });
});
