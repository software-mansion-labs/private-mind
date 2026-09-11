import conversations from './fixtures/deviceConversations.json';
import { truncateAtRepeatedClause } from '../utils/loopDetection';
import {
  isCircularNonAnswer,
  isDanglingListAnswer,
  isQuestionEchoAnswer,
} from '../utils/messageSources';
import { carryReferentIntoQuery } from '../utils/web/buildSearchQuery';

type Turn = { role: string; content: string };

const corpus = conversations as { model: string; turns: Turn[] }[];

const MEASURED_MODEL = 'Qwen 3 - 1.7B';

const answersWithQuestions = corpus.flatMap((conversation) =>
  conversation.turns.flatMap((turn, index) =>
    turn.role === 'assistant'
      ? [
          {
            answer: turn.content,
            question: conversation.turns
              .slice(0, index)
              .reverse()
              .find((earlier) => earlier.role === 'user')?.content,
          },
        ]
      : []
  )
);

const followUps = [
  ...new Set(
    corpus.flatMap((conversation) =>
      conversation.turns.flatMap((turn, index) =>
        turn.role === 'user' && index > 0 ? [turn.content] : []
      )
    )
  ),
];

const firing = <T>(items: T[], predicate: (item: T) => boolean): T[] =>
  items.filter(predicate);

const label = (text: string): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, 80);

describe('real device answers — how often each guard fires', () => {
  it('says which model produced it, so the numbers are not read as universal', () => {
    const models = [
      ...new Set(corpus.map((conversation) => conversation.model)),
    ];
    expect(models).toEqual([MEASURED_MODEL]);
  });

  it('has the corpus it claims to have', () => {
    expect(corpus.length).toBe(178);
    expect(answersWithQuestions.length).toBe(259);
    expect(followUps.length).toBe(64);
  });

  it('truncates only answers that actually loop', () => {
    const cut = firing(
      answersWithQuestions,
      ({ answer }) => truncateAtRepeatedClause(answer).length < answer.length
    );
    expect(cut.map(({ answer }) => label(answer))).toHaveLength(12);
    for (const { answer } of cut) {
      expect(truncateAtRepeatedClause(answer).length).toBeGreaterThan(100);
    }
  });

  it('leaves every other answer byte-for-byte alone', () => {
    const untouched = answersWithQuestions.filter(
      ({ answer }) => truncateAtRepeatedClause(answer) === answer
    );
    expect(untouched).toHaveLength(247);
  });

  it('flags a question echo about as often as one really happens', () => {
    const echoed = firing(answersWithQuestions, ({ answer, question }) =>
      isQuestionEchoAnswer(answer, question)
    );
    expect(echoed.map(({ answer }) => label(answer))).toHaveLength(9);
  });

  it('flags a source-only non-answer rarely, and never a well-cited one', () => {
    const circular = firing(answersWithQuestions, ({ answer }) =>
      isCircularNonAnswer(answer)
    );
    expect(circular.map(({ answer }) => label(answer))).toHaveLength(2);
    for (const wellCited of [
      'Aktualne ceny miedzi i cyny można porównać zgodnie ze źródłami: - **Miedź**: Cena wynosi **684,80 zł** (źródło 1), **Cyna**: **32 500 zł** (źródło 2), zgodnie ze źródłem 3.',
      'Najtańszy bilet oferuje linia lotnicza przedstawiana w źródle 2, źródło 3 i źródło 4 podają to samo, a źródło 5 potwierdza.',
    ]) {
      expect(isCircularNonAnswer(wellCited)).toBe(false);
    }
  });

  it('finds no dangling list in the corpus at all', () => {
    const dangling = firing(answersWithQuestions, ({ answer }) =>
      isDanglingListAnswer(answer)
    );
    expect(dangling.map(({ answer }) => label(answer))).toEqual([]);
  });
});

describe('real device follow-ups — which ones get their referent back', () => {
  const namedEntityHistory = [{ role: 'user', content: 'Zzz Qqq' }];
  const resolved = followUps.filter(
    (question) =>
      carryReferentIntoQuery(question, namedEntityHistory) !== question
  );

  it('resolves the follow-ups that point back instead of naming', () => {
    expect(resolved.map(label)).toHaveLength(22);
  });

  it('leaves a self-contained question alone', () => {
    for (const question of [
      'Ile kosztuje aktualnie cyna?',
      'A ile to jest 10 razy 10?',
      'Jaka jest dzisiejsza pogoda w Warszawie?',
      'Jakie są najważniejsze wydarzenia na świecie w tym tygodniu?',
    ]) {
      expect(followUps).toContain(question);
      expect(resolved).not.toContain(question);
    }
  });

  it('resolves the shapes that made a live search fail', () => {
    for (const question of [
      'A jaki ma aparat?',
      'Czy jest dostępny w kolorze czarnym?',
      'Ile ma pamięci RAM i jakiego ma procesora?',
      'Porównaj je i daj mi wyniki',
      'Who was the top scorer in that game?',
    ]) {
      expect(followUps).toContain(question);
      expect(resolved).toContain(question);
    }
  });
});
