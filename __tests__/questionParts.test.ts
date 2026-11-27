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

describe('splitQuestionParts with three parts', () => {
  it.each([
    [
      'Who directs the film, when does it premiere and how much did it cost?',
      [
        'Who directs the film',
        'when does film premiere',
        'how much did film cost',
      ],
    ],
    [
      'Who directs the film, when does it premiere, and how much did it cost?',
      [
        'Who directs the film',
        'when does film premiere',
        'how much did film cost',
      ],
    ],
    [
      'Kto wyreżyserował film, kiedy jest premiera i ile kosztował?',
      [
        'Kto wyreżyserował film',
        'kiedy jest premiera film',
        'ile kosztował film',
      ],
    ],
    [
      '¿Quién dirige la película, cuándo se estrena y cuánto costó?',
      [
        'Quién dirige la película',
        'cuándo se estrena película',
        'cuánto costó película',
      ],
    ],
    [
      'फिल्म का निर्देशक कौन है, यह कब रिलीज़ होगी और इसकी लागत कितनी है?',
      [
        'फिल्म का निर्देशक कौन है',
        'फिल्म निर्देशक कब रिलीज़ होगी',
        'इसकी लागत कितनी है फिल्म निर्देशक',
      ],
    ],
  ])(
    'asks every clause of "%s" about the subject of the first',
    (question, expected) => {
      expect(splitQuestionParts(question)).toEqual(expected);
    }
  );

  it.each([
    [
      'What is the population of Warsaw, Kraków and Gdańsk?',
      [
        'What is the population of Warsaw',
        'What is the population of Kraków',
        'What is the population of Gdańsk',
      ],
    ],
    [
      'What is the population of Warsaw and Kraków and Gdańsk?',
      [
        'What is the population of Warsaw',
        'What is the population of Kraków',
        'What is the population of Gdańsk',
      ],
    ],
    [
      'Who won the 2025 Nobel Prizes in Physics, in Chemistry and in Medicine?',
      [
        'Who won the 2025 Nobel Prizes in Physics',
        'Who won the 2025 Nobel Prizes in Chemistry',
        'Who won the 2025 Nobel Prizes in Medicine',
      ],
    ],
    [
      'Which films won Best Picture, Best Director and Best Actress at the 2025 Oscars?',
      [
        'Which films won Best Picture at the 2025 Oscars',
        'Which films won Best Director at the 2025 Oscars',
        'Which films won Best Actress at the 2025 Oscars',
      ],
    ],
    [
      'What is the price of gold, silver and platinum today?',
      [
        'What is the price of gold today',
        'What is the price of silver today',
        'What is the price of platinum today',
      ],
    ],
    [
      'Jaka jest cena biletu w Warszawie, w Krakowie i w Gdańsku?',
      [
        'Jaka jest cena biletu w Warszawie',
        'Jaka jest cena biletu w Krakowie',
        'Jaka jest cena biletu w Gdańsku',
      ],
    ],
    [
      'Wer hat 2025 den Nobelpreis für Physik, für Chemie und für Medizin gewonnen?',
      [
        'Wer hat 2025 den Nobelpreis für Physik gewonnen',
        'Wer hat 2025 den Nobelpreis für Chemie gewonnen',
        'Wer hat 2025 den Nobelpreis für Medizin gewonnen',
      ],
    ],
    [
      '¿Quién ganó el Nobel 2025 de física, de química y de medicina?',
      [
        'Quién ganó el Nobel 2025 de física',
        'Quién ganó el Nobel 2025 de química',
        'Quién ganó el Nobel 2025 de medicina',
      ],
    ],
    [
      'भौतिकी, रसायन और चिकित्सा में नोबेल पुरस्कार किसने जीता?',
      [
        'भौतिकी में नोबेल पुरस्कार किसने जीता',
        'रसायन में नोबेल पुरस्कार किसने जीता',
        'चिकित्सा में नोबेल पुरस्कार किसने जीता',
      ],
    ],
    [
      'भौतिकी में, रसायन में और चिकित्सा में 2025 का नोबेल पुरस्कार किसने जीता?',
      [
        'भौतिकी में 2025 का नोबेल पुरस्कार किसने जीता',
        'रसायन में 2025 का नोबेल पुरस्कार किसने जीता',
        'चिकित्सा में 2025 का नोबेल पुरस्कार किसने जीता',
      ],
    ],
    [
      'لاہور، کراچی اور پشاور کی آبادی کتنی ہے؟',
      [
        'لاہور کی آبادی کتنی ہے',
        'کراچی کی آبادی کتنی ہے',
        'پشاور کی آبادی کتنی ہے',
      ],
    ],
    [
      'لاہور, کراچی اور پشاور کی آبادی کتنی ہے؟',
      [
        'لاہور کی آبادی کتنی ہے',
        'کراچی کی آبادی کتنی ہے',
        'پشاور کی آبادی کتنی ہے',
      ],
    ],
    [
      'Fizik, kimya ve tıp Nobel ödülünü 2025 kim kazandı?',
      [
        'Fizik Nobel ödülünü 2025 kim kazandı',
        'kimya Nobel ödülünü 2025 kim kazandı',
        'tıp Nobel ödülünü 2025 kim kazandı',
      ],
    ],
    [
      '물리학, 화학 및 의학 노벨상 수상자는 누구인가요?',
      [
        '물리학 노벨상 수상자는 누구인가요',
        '화학 노벨상 수상자는 누구인가요',
        '의학 노벨상 수상자는 누구인가요',
      ],
    ],
    [
      'من فاز بجائزة نوبل في الفيزياء، في الكيمياء و في الطب؟',
      [
        'من فاز بجائزة نوبل في الفيزياء',
        'من فاز بجائزة نوبل في الكيمياء',
        'من فاز بجائزة نوبل في الطب',
      ],
    ],
    [
      'من فاز بجائزة نوبل في الفيزياء و في الكيمياء و في الطب؟',
      [
        'من فاز بجائزة نوبل في الفيزياء',
        'من فاز بجائزة نوبل في الكيمياء',
        'من فاز بجائزة نوبل في الطب',
      ],
    ],
  ])(
    'searches every item of "%s" with the context they share',
    (question, expected) => {
      expect(splitQuestionParts(question)).toEqual(expected);
    }
  );

  it('keeps a thousands separator inside its number instead of reading it as a list comma', () => {
    expect(
      splitQuestionParts(
        'What is the price of 1,000 shares of Apple, Google and Microsoft?'
      )
    ).toEqual([
      'What is the price of 1,000 shares of Apple',
      'What is the price of 1,000 shares of Google',
      'What is the price of 1,000 shares of Microsoft',
    ]);
  });

  it.each([
    'What is the population of Warsaw, Kraków, Gdańsk and Poznań?',
    'Who directs the film, who stars in it, when does it premiere and how much did it cost?',
  ])(
    'leaves "%s" to the planner because it lists more than three parts',
    (question) => {
      expect(splitQuestionParts(question)).toEqual([]);
    }
  );

  it.each([
    'How do you play rock, paper and scissors with kids?',
    'Who were Crosby, Stills and Nash?',
    'When did Earth, Wind and Fire play in Warsaw?',
    'How old are Tom, Dick and Harry?',
    'Who directed the Good, the Bad and the Ugly?',
    'What is the population of Jamaica, Trinidad and Tobago?',
    'What is the capital of Poland and of Trinidad and Tobago?',
    'What happened in 1914, 1939 and 1989?',
    'Who won, who lost and why?',
  ])(
    'leaves "%s" as one search because the list names one thing or has no shared context',
    (question) => {
      expect(splitQuestionParts(question)).toEqual([]);
    }
  );

  it.each([
    [
      'What happened on June 5, 2025 and who was there?',
      ['What happened on June 5, 2025', 'who was there June 5, 2025'],
    ],
    [
      'What is the weather in Springfield, Illinois and Columbus, Ohio?',
      [
        'What is the weather in Springfield, Illinois',
        'What is the weather in Columbus, Ohio',
      ],
    ],
    [
      'In 2025, who won the Nobel Prize in Physics and in Chemistry?',
      [
        'In 2025, who won the Nobel Prize in Physics',
        'In 2025, who won the Nobel Prize in Chemistry',
      ],
    ],
  ])(
    'keeps the comma of a date, an address or an opening phrase inside its part of "%s"',
    (question, expected) => {
      expect(splitQuestionParts(question)).toEqual(expected);
    }
  );
});

describe('partQueriesFor with three parts', () => {
  const keep = (text: string) => text;

  it('gives each of three parts its own query that never names the other two', () => {
    const parts = partQueriesFor(
      'Who won the 2025 Nobel Prizes in Physics, in Chemistry and in Medicine?',
      'Who won the 2025 Nobel Prizes in Physics, in Chemistry and in Medicine',
      keep
    );
    const fields = ['Physics', 'Chemistry', 'Medicine'];
    expect(parts).toHaveLength(fields.length);
    parts.forEach((part, index) => {
      expect(fields.filter((field) => part.includes(field))).toEqual([
        fields[index],
      ]);
    });
  });
});
