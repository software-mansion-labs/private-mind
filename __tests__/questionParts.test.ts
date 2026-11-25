import { partQueriesFor, splitQuestionParts } from '../utils/web/questionParts';

describe('splitQuestionParts', () => {
  it.each([
    [
      'Who won the 2025 Nobel Prizes in Physics and in Chemistry?',
      [
        'Who won the 2025 Nobel Prizes in Physics',
        'Who won the 2025 Nobel Prizes in Chemistry',
      ],
    ],
    [
      "Who won the 2025 Ballon d'Or for men and for women?",
      [
        "Who won the 2025 Ballon d'Or for men",
        "Who won the 2025 Ballon d'Or for women",
      ],
    ],
    [
      "Who won the 2025 Wimbledon men's and women's singles titles?",
      [
        "Who won the 2025 Wimbledon men's singles titles",
        "Who won the 2025 Wimbledon women's singles titles",
      ],
    ],
    [
      'Which films won Best Picture and Best Animated Feature at the 2025 Oscars?',
      [
        'Which films won Best Picture at the 2025 Oscars',
        'Which films won Best Animated Feature at the 2025 Oscars',
      ],
    ],
    [
      "Who won the 2025 Formula 1 Drivers' Championship, and who finished second?",
      [
        "Who won the 2025 Formula 1 Drivers' Championship",
        "who finished second 2025 Formula 1 Drivers' Championship",
      ],
    ],
    [
      'When was the Eiffel Tower built and who designed it?',
      ['When was the Eiffel Tower built', 'who designed Eiffel Tower built'],
    ],
    [
      'What is the population of Warsaw and Kraków?',
      ['What is the population of Warsaw', 'What is the population of Kraków'],
    ],
    [
      'Jaka jest cena biletu w Warszawie i w Krakowie?',
      ['Jaka jest cena biletu w Warszawie', 'Jaka jest cena biletu w Krakowie'],
    ],
  ])('splits "%s" into one search per part', (question, expected) => {
    expect(splitQuestionParts(question)).toEqual(expected);
  });

  it.each([
    'Who wrote Pride and Prejudice?',
    'Where can I buy a Tesla Model 3?',
    'Who won Eurovision 2025, for which country, and with which song?',
    'How much does the iPhone 17 Pro cost and is it worth it?',
    'Co wiesz o Marsie?',
    'Who won the game and why?',
    'What is the capital of France?',
    'where can i renew my passport',
    'where can i renew my passport and my ID card online',
    'What is the population of Trinidad and Tobago?',
    'What is the capital of Bosnia and Herzegovina?',
    'What is the plot of Romeo and Juliet?',
    'What is the history of rock and roll music?',
    'Who won the 2025 Wimbledon final and was it close?',
  ])('leaves "%s" as one search', (question) => {
    expect(splitQuestionParts(question)).toEqual([]);
  });
});

describe('partQueriesFor', () => {
  const keep = (text: string) => text;

  it('carries the year and names the planner resolved from the conversation into every part', () => {
    expect(
      partQueriesFor(
        'What about Physics and Chemistry?',
        '2025 Nobel Prize Physics Chemistry',
        keep
      )
    ).toEqual([]);
    expect(
      partQueriesFor(
        'And who won in Physics and in Chemistry?',
        '2025 Nobel Prize Physics Chemistry winners',
        keep
      )
    ).toEqual([
      'And who won in Physics 2025 Nobel Prize',
      'And who won in Chemistry 2025 Nobel Prize',
    ]);
  });

  it('keeps the phrase whole when the planner rewrote the question and kept it together', () => {
    expect(
      partQueriesFor(
        'What is the population of Warsaw and Kraków?',
        'population Warsaw and Kraków 2025',
        keep
      )
    ).toEqual([]);
  });

  it('splits when the planned query is the question itself', () => {
    expect(
      partQueriesFor(
        'What is the population of Warsaw and Kraków?',
        'What is the population of Warsaw and Kraków',
        keep
      )
    ).toEqual([
      'What is the population of Warsaw',
      'What is the population of Kraków',
    ]);
  });

  it('never adds the other part back from the planned query', () => {
    const [physics, chemistry] = partQueriesFor(
      'Who won the 2025 Nobel Prizes in Physics and in Chemistry?',
      'Who won the 2025 Nobel Prizes in Physics and in Chemistry',
      keep
    );
    expect(physics).not.toContain('Chemistry');
    expect(chemistry).not.toContain('Physics');
  });
});
