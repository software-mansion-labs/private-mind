import {
  attributeSourcesByBlock,
  splitIntoBlocks,
} from '../utils/attributeSources';
import type { SourceDocument } from '../database/chatRepository';

const web = (name: string, passage: string): SourceDocument => ({
  kind: 'web',
  name,
  url: `https://${name.toLowerCase().replace(/\W+/g, '')}.example`,
  passage,
  used: true,
});

const gold = web(
  'Gold Price Today',
  'Gold price today per troy ounce is 4812.50 dollars, updated live from the bullion market.'
);
const bitcoin = web(
  'Bitcoin price today, BTC to USD',
  'Bitcoin price today is 96240 USD with a 24 hour trading volume of 41 billion dollars.'
);

describe('splitIntoBlocks', () => {
  it('splits paragraphs on blank lines', () => {
    expect(splitIntoBlocks('First one.\n\nSecond one.')).toEqual([
      'First one.',
      'Second one.',
    ]);
  });

  it('keeps a numbered list together as one block', () => {
    const blocks = splitIntoBlocks(
      'Oto lista:\n\n1. Paszport\n2. Bilet\n3. Ładowarka'
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toContain('1. Paszport');
    expect(blocks[1]).toContain('3. Ładowarka');
  });

  it('keeps a fenced code block whole, blank lines and all', () => {
    const blocks = splitIntoBlocks(
      'Try this:\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n\nDone.'
    );
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toBe('```ts\nconst a = 1;\n\nconst b = 2;\n```');
  });

  it('keeps a table together', () => {
    const blocks = splitIntoBlocks(
      'Porównanie:\n\n| a | b |\n| - | - |\n| 1 | 2 |'
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[1]!.split('\n')).toHaveLength(3);
  });
});

describe('attributeSourcesByBlock', () => {
  it('gives each paragraph the source it actually rests on', () => {
    const answer =
      'Złoto kosztuje 4812.50 dollars za uncję troy według bullion market.\n\n' +
      'Bitcoin price today is 96240 USD z wolumenem 41 billion.';
    const blocks = attributeSourcesByBlock(answer, [gold, bitcoin]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.source?.name).toBe(gold.name);
    expect(blocks[1]!.source?.name).toBe(bitcoin.name);
  });

  it('merges neighbouring blocks that rest on the same source', () => {
    const answer =
      'Gold price today per troy ounce is 4812.50 dollars.\n\n' +
      'Ta cena bullion market jest aktualizowana live.';
    const blocks = attributeSourcesByBlock(answer, [gold, bitcoin]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source?.name).toBe(gold.name);
  });

  it('leaves a block with nothing to match on unattributed', () => {
    const blocks = attributeSourcesByBlock('Oto szczegóły:', [gold, bitcoin]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source).toBeNull();
  });

  it('lets a continuation inherit the source of the block before it', () => {
    const answer =
      'Gold price today per troy ounce is 4812.50 dollars from the bullion market.\n\n' +
      'Warto o tym pamiętać.';
    const blocks = attributeSourcesByBlock(answer, [gold, bitcoin]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source?.name).toBe(gold.name);
  });

  it('ignores the think block, which surveys every source', () => {
    const answer =
      '<think>gold bullion bitcoin USD trading volume</think>\n\nOto szczegóły:';
    const blocks = attributeSourcesByBlock(answer, [gold, bitcoin]);
    expect(blocks[0]!.text).toBe('Oto szczegóły:');
    expect(blocks[0]!.source).toBeNull();
  });

  it('attributes nothing when there are no usable web sources', () => {
    const answer = 'Gold price today per troy ounce is 4812.50 dollars.';
    expect(attributeSourcesByBlock(answer, [])[0]!.source).toBeNull();
    expect(
      attributeSourcesByBlock(answer, [{ ...gold, used: false }])[0]!.source
    ).toBeNull();
  });

  it('keeps a list as one block with one source, not one per item', () => {
    const answer =
      'Ceny:\n\n- Gold price today per troy ounce is 4812.50 dollars\n- Bullion market updated live\n- Troy ounce reference';
    const blocks = attributeSourcesByBlock(answer, [gold, bitcoin]);
    const listBlock = blocks.find((block) => block.text.includes('- Gold'));
    expect(listBlock).toBeDefined();
    expect(listBlock!.source?.name).toBe(gold.name);
  });
});
