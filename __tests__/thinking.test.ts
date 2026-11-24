import {
  mapOutsideThink,
  unclosedThinkAsAnswer,
  withTemplateThinkOpener,
  createStrayThinkCloseFilter,
  cutAtStrayThinkClose,
  hasUnclosedThink,
} from '../utils/thinking';

describe('mapOutsideThink', () => {
  const upper = (segment: string) => segment.toUpperCase();

  it('transforms the visible text and leaves the think block untouched', () => {
    expect(mapOutsideThink('a<think>keep me</think>b', upper)).toBe(
      'A<think>keep me</think>B'
    );
  });

  it('keeps an unterminated think block verbatim', () => {
    expect(mapOutsideThink('a<think>still going', upper)).toBe(
      'A<think>still going'
    );
  });

  it('treats a bare closing marker as the end of an opening block', () => {
    expect(mapOutsideThink('thoughts</think>answer', upper)).toBe(
      '<think>thoughts</think>ANSWER'
    );
  });

  it('is the identity for text without markers', () => {
    expect(mapOutsideThink('plain', (segment) => segment)).toBe('plain');
  });
});

describe('a think block the model opened and never closed, with thinking off', () => {
  const answer =
    '**Photosynthesis**\n\nPlants turn light into chemical energy.';

  it('becomes the answer', () => {
    expect(unclosedThinkAsAnswer(`<think>\n\n${answer}`)).toBe(answer);
  });

  it('leaves a closed think block and its answer alone', () => {
    const closed = `<think>\n\n</think>\n\n${answer}`;
    expect(unclosedThinkAsAnswer(closed)).toBe(closed);
  });

  it('leaves an answer without a think block alone', () => {
    expect(unclosedThinkAsAnswer(answer)).toBe(answer);
  });
});

describe('withTemplateThinkOpener', () => {
  it('opens the block the chat template already opened in the prompt', () => {
    expect(withTemplateThinkOpener('\nreasoning</think>answer')).toBe(
      '<think>\nreasoning</think>answer'
    );
  });

  it('leaves text that opens its own block alone', () => {
    expect(withTemplateThinkOpener('<think>x</think>y')).toBe(
      '<think>x</think>y'
    );
  });
});

const pushAll = (
  filter: ReturnType<typeof createStrayThinkCloseFilter>,
  chunks: string[]
): string[] => chunks.map((chunk) => filter.push(chunk));

describe('a close tag no open tag precedes, with thinking off', () => {
  it('ends the answer there when the text after it says the same again', () => {
    expect(
      cutAtStrayThinkClose(
        'The capital of Australia is Canberra.</think>The capital is Canberra.'
      )
    ).toEqual({
      text: 'The capital of Australia is Canberra.',
      answerEnded: true,
    });
  });

  it('keeps both parts when the text before it was reasoning, not the answer', () => {
    expect(
      cutAtStrayThinkClose(
        'Okay, the user wants to know the capital of Australia. I should answer briefly.</think>The capital of Australia is Canberra.'
      )
    ).toEqual({
      text: 'Okay, the user wants to know the capital of Australia. I should answer briefly.The capital of Australia is Canberra.',
      answerEnded: false,
    });
  });

  it('keeps both parts when the text after it goes on to something new', () => {
    expect(
      cutAtStrayThinkClose(
        'Paris.</think>The capital of France is known for its museums, cafés, fashion houses and the Eiffel Tower.'
      )
    ).toEqual({
      text: 'Paris.The capital of France is known for its museums, cafés, fashion houses and the Eiffel Tower.',
      answerEnded: false,
    });
  });

  it('is only dropped when it falls inside a sentence', () => {
    expect(
      cutAtStrayThinkClose('Liście zmieniają kolor</think> jesienią.')
    ).toEqual({
      text: 'Liście zmieniają kolor jesienią.',
      answerEnded: false,
    });
  });

  it('is only dropped when nothing was said before it', () => {
    expect(cutAtStrayThinkClose(' \n</think>Canberra.')).toEqual({
      text: ' \nCanberra.',
      answerEnded: false,
    });
  });

  it('ends the answer at a second close tag after a closed block and a full sentence', () => {
    expect(
      cutAtStrayThinkClose(
        '<think>a</think>Bonn was the capital.</think>The capital was Bonn.'
      )
    ).toEqual({
      text: '<think>a</think>Bonn was the capital.',
      answerEnded: true,
    });
  });

  it('counts a sentence closed inside quotes as finished', () => {
    expect(
      cutAtStrayThinkClose(
        'The capital is "Canberra."</think>The capital is Canberra.'
      )
    ).toEqual({ text: 'The capital is "Canberra."', answerEnded: true });
  });

  it.each([
    ['a danda', 'भारत की राजधानी नई दिल्ली है।'],
    ['a double danda', 'भारत की राजधानी नई दिल्ली है॥'],
    ['an Urdu full stop', 'پاکستان کا دارالحکومت اسلام آباد ہے۔'],
    ['an Urdu question mark', 'کیا پاکستان کا دارالحکومت اسلام آباد ہے؟'],
  ])('counts a sentence ended with %s as finished', (_mark, sentence) => {
    expect(cutAtStrayThinkClose(`${sentence}</think>${sentence}`)).toEqual({
      text: sentence,
      answerEnded: true,
    });
  });

  it.each([
    ['bold', '**Canberra.**'],
    ['italics', '*Canberra.*'],
    ['underscores', '_Canberra._'],
    ['code', '`Canberra.`'],
  ])('counts a sentence in %s as finished', (_style, sentence) => {
    expect(cutAtStrayThinkClose(`${sentence}</think>Canberra.`)).toEqual({
      text: sentence,
      answerEnded: true,
    });
  });
});

describe('a close tag no open tag precedes, while the answer streams', () => {
  it('holds back what follows it until it can tell whether it repeats', () => {
    const filter = createStrayThinkCloseFilter();

    expect(
      pushAll(filter, [
        'The capital of Australia is Canberra.',
        '</think>The capital',
        ' is Canberra.',
      ])
    ).toEqual(['The capital of Australia is Canberra.', '', '']);
    expect(filter.answerEnded()).toBe(false);
    expect(filter.finish()).toBe('');
    expect(filter.answerEnded()).toBe(true);
  });

  it('ends the answer without waiting for the generation once enough of it repeats', () => {
    const filter = createStrayThinkCloseFilter();
    const head = 'Two major rivers in Europe are the Danube and the Rhine.';

    pushAll(filter, [
      head,
      '</think>Two major rivers in Europe are the Danube River and the Rhine',
    ]);
    expect(filter.answerEnded()).toBe(false);

    filter.push(' River');
    expect(filter.answerEnded()).toBe(true);
    expect(filter.push(', which flow into the sea.')).toBe('');
  });

  it('shows what it held back, without the tag, once it turns out to be new', () => {
    const filter = createStrayThinkCloseFilter();
    const answer =
      'The capital of Australia is Canberra, a planned city in the Australian Capital Territory that was chosen as a compromise between Sydney and Melbourne.';

    const shown = pushAll(filter, [
      'Okay, the user wants the capital of Australia. I should answer briefly.',
      `</think>${answer}`,
    ]);

    expect(shown[1]).toBe(answer);
    expect(filter.answerEnded()).toBe(false);
  });

  it('shows what it held back when the generation ends before it can tell', () => {
    const filter = createStrayThinkCloseFilter();

    pushAll(filter, [
      'Okay, the user greets me. I should greet back.',
      '</think>Hi!',
    ]);

    expect(filter.finish()).toBe('Hi!');
    expect(filter.answerEnded()).toBe(false);
  });

  it('recognises a tag split across chunks', () => {
    const filter = createStrayThinkCloseFilter();

    expect(pushAll(filter, ['Canberra.</th', 'ink>Canberra.'])).toEqual([
      'Canberra.',
      '',
    ]);
    expect(filter.finish()).toBe('');
    expect(filter.answerEnded()).toBe(true);
  });

  it('drops a tag split across chunks inside a sentence', () => {
    const filter = createStrayThinkCloseFilter();

    expect(
      pushAll(filter, ['Liście zmieniają kolor</', 'thi', 'nk> jesienią.'])
    ).toEqual(['Liście zmieniają kolor', '', ' jesienią.']);
  });

  it('shows the start of a tag that never completes once the generation ends', () => {
    const filter = createStrayThinkCloseFilter();

    expect(filter.push('Use a <')).toBe('Use a ');
    expect(filter.finish()).toBe('<');
  });
});

describe('a close tag that closes a block', () => {
  it('is kept with the block it closes', () => {
    expect(cutAtStrayThinkClose('<think>why</think>answer')).toEqual({
      text: '<think>why</think>answer',
      answerEnded: false,
    });
  });

  it('is kept when the block was opened in an earlier chunk', () => {
    const filter = createStrayThinkCloseFilter();

    expect(pushAll(filter, ['<think>so', 'me more</think>answer'])).toEqual([
      '<think>so',
      'me more</think>answer',
    ]);
  });

  it('does not count text inside the block as an answer', () => {
    expect(cutAtStrayThinkClose('<think>a</think></think>b')).toEqual({
      text: '<think>a</think>b',
      answerEnded: false,
    });
  });
});

describe('hasUnclosedThink', () => {
  it('is true only while an open tag has no close', () => {
    expect(hasUnclosedThink('<think>so far')).toBe(true);
    expect(hasUnclosedThink('<think>done</think>answer')).toBe(false);
    expect(hasUnclosedThink('plain')).toBe(false);
  });
});
