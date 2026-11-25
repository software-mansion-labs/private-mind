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

describe('splitQuestionParts in other languages', () => {
  it.each([
    [
      'भौतिकी और रसायन में नोबेल पुरस्कार किसने जीता?',
      [
        'भौतिकी में नोबेल पुरस्कार किसने जीता',
        'रसायन में नोबेल पुरस्कार किसने जीता',
      ],
    ],
    [
      'भौतिकी में और रसायन में 2025 का नोबेल पुरस्कार किसने जीता?',
      [
        'भौतिकी में 2025 का नोबेल पुरस्कार किसने जीता',
        'रसायन में 2025 का नोबेल पुरस्कार किसने जीता',
      ],
    ],
    [
      'पिछला चैंपियंस लीग फाइनल किसने जीता और वह कहाँ खेला गया?',
      [
        'पिछला चैंपियंस लीग फाइनल किसने जीता',
        'पिछला चैंपियंस लीग फाइनल जीता कहाँ खेला गया',
      ],
    ],
    [
      'لاہور اور کراچی کی آبادی کتنی ہے؟',
      ['لاہور کی آبادی کتنی ہے', 'کراچی کی آبادی کتنی ہے'],
    ],
    [
      'Wer hat 2025 den Nobelpreis für Physik und für Chemie gewonnen?',
      [
        'Wer hat 2025 den Nobelpreis für Physik gewonnen',
        'Wer hat 2025 den Nobelpreis für Chemie gewonnen',
      ],
    ],
    [
      'Кто получил Нобелевскую премию 2025 по физике и по химии?',
      [
        'Кто получил Нобелевскую премию 2025 по физике',
        'Кто получил Нобелевскую премию 2025 по химии',
      ],
    ],
    [
      'Fizik ve kimya Nobel ödülünü 2025 kim kazandı?',
      [
        'Fizik Nobel ödülünü 2025 kim kazandı',
        'kimya Nobel ödülünü 2025 kim kazandı',
      ],
    ],
    [
      'Quem ganhou o Nobel de 2025 de física e de química?',
      [
        'Quem ganhou o Nobel de 2025 de física',
        'Quem ganhou o Nobel de 2025 de química',
      ],
    ],
    [
      'Chi ha vinto il Nobel 2025 per la fisica e per la chimica?',
      [
        'Chi ha vinto il Nobel 2025 per la fisica',
        'Chi ha vinto il Nobel 2025 per la chimica',
      ],
    ],
    [
      'من فاز بجائزة نوبل في الفيزياء و في الكيمياء؟',
      ['من فاز بجائزة نوبل في الفيزياء', 'من فاز بجائزة نوبل في الكيمياء'],
    ],
    [
      'چه کسی جایزه نوبل فیزیک و شیمی را برد؟',
      ['چه کسی جایزه نوبل فیزیک را برد', 'چه کسی جایزه نوبل شیمی را برد'],
    ],
    [
      '물리학 및 화학 노벨상 수상자는 누구인가요?',
      ['물리학 노벨상 수상자는 누구인가요', '화학 노벨상 수상자는 누구인가요'],
    ],
  ])('splits "%s" into one search per part', (question, expected) => {
    expect(splitQuestionParts(question)).toEqual(expected);
  });

  it.each([
    'फ्रांस की राजधानी क्या है?',
    'Wer hat das Spiel gewonnen und warum?',
    '谁获得了物理和化学诺贝尔奖？',
    'Czy jest otwarte i do której?',
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
