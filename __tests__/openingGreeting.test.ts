import { CONVERSATIONAL_PHRASES } from '../constants/conversational-phrases';
import { OPENING_WELCOMES } from '../constants/opening-greetings';
import {
  greetingLanguageOf,
  isGreetingOnly,
  openingWelcomeFor,
} from '../utils/openingGreeting';
import { normalizePhrase } from '../utils/conversationalPhrases';

const firstTurn = (message: string) =>
  openingWelcomeFor({
    message,
    earlierRoles: [],
    hasAttachment: false,
    customInstructions: '',
  });

describe('greetingLanguageOf', () => {
  it.each([
    ['hi', 'en'],
    ['Hello!', 'en'],
    ['hey there 👋', 'en'],
    ['HELLO', 'en'],
    ['good morning', 'en'],
    ['hi, hello', 'en'],
    ['hello Private Mind', 'en'],
    ['cześć', 'pl'],
    ['Dzień dobry!', 'pl'],
    ['siema', 'pl'],
    ['hallo', 'de'],
    ['Guten Abend', 'de'],
    ['¡Hola!', 'es'],
    ['buenos días', 'es'],
    ['Bonjour', 'fr'],
    ['olá', 'pt'],
    ['Привет', 'ru'],
    ['नमस्ते', 'hi'],
    ['السلام علیکم', 'ur'],
    ['مرحباً', 'ar'],
    ['السلام عليكم', 'ar'],
  ])('reads %s as a greeting answered in %s', (message, language) => {
    expect(greetingLanguageOf(message)).toBe(language);
  });

  it.each(['hiii', 'heyyy', 'hellooo!!!'])(
    'hears %s as the greeting it stretches',
    (message) => {
      expect(greetingLanguageOf(message)).toBe('en');
    }
  );

  it('answers a romanised South Asian greeting in English', () => {
    expect(greetingLanguageOf('namaste')).toBe('en');
    expect(greetingLanguageOf('Assalamu alaikum')).toBe('en');
  });

  it.each([
    'hi, what is the capital of France?',
    'hello world in python',
    'hey can you help me',
    'good morning, summarize this',
    'hi how are you',
    'how are you',
    'thanks',
    'ok',
    'there',
    'assistant',
    '',
    '   ',
    '👋',
    '2+2',
    'hi '.repeat(40),
  ])('leaves %j to the model', (message) => {
    expect(isGreetingOnly(message)).toBe(false);
  });

  it('keeps a greeting several languages share out of the answered ones', () => {
    for (const shared of ['hej', 'ciao', 'سلام', 'salve']) {
      for (const phrase of CONVERSATIONAL_PHRASES) {
        if (phrase.text === shared && phrase.kind === 'greeting') {
          expect(phrase.answeredIn).toBeNull();
        }
      }
      expect(greetingLanguageOf(shared)).toBeNull();
    }
  });

  it('files every phrase under one kind and one language only', () => {
    const texts = CONVERSATIONAL_PHRASES.map(({ text }) =>
      normalizePhrase(text)
    );
    expect(texts.filter((text, at) => texts.indexOf(text) !== at)).toEqual([]);
  });

  it('recognises every greeting it lists in the language it is answered in', () => {
    for (const phrase of CONVERSATIONAL_PHRASES) {
      if (phrase.kind === 'greeting' && phrase.answeredIn) {
        expect([phrase.text, greetingLanguageOf(phrase.text)]).toEqual([
          phrase.text,
          phrase.answeredIn,
        ]);
      }
    }
  });

  it('reads a greeting written without its diacritics', () => {
    expect(greetingLanguageOf('czesc')).toBe('pl');
    expect(greetingLanguageOf('dzien dobry')).toBe('pl');
    expect(greetingLanguageOf('buenos dias')).toBe('es');
  });
});

describe('openingWelcomeFor', () => {
  it('welcomes a greeting that opens the chat, in the language it came in', () => {
    expect(firstTurn('hi')).toBe(OPENING_WELCOMES.en);
    expect(firstTurn('Cześć!')).toBe(OPENING_WELCOMES.pl);
    expect(firstTurn('नमस्ते')).toBe(OPENING_WELCOMES.hi);
  });

  it('starts normal work as soon as the first message carries a task', () => {
    expect(firstTurn('hi, write me a haiku')).toBeNull();
  });

  it('stays out of a conversation that is already under way', () => {
    expect(
      openingWelcomeFor({
        message: 'hi',
        earlierRoles: ['user', 'assistant'],
        hasAttachment: false,
        customInstructions: '',
      })
    ).toBeNull();
  });

  it('does not count a system event as a turn already taken', () => {
    expect(
      openingWelcomeFor({
        message: 'hi',
        earlierRoles: ['event'],
        hasAttachment: false,
        customInstructions: '',
      })
    ).toBe(OPENING_WELCOMES.en);
  });

  it('lets the model look at an attachment sent with a greeting', () => {
    expect(
      openingWelcomeFor({
        message: 'hi',
        earlierRoles: [],
        hasAttachment: true,
        customInstructions: '',
      })
    ).toBeNull();
  });

  it('leaves the greeting to the persona the user wrote', () => {
    expect(
      openingWelcomeFor({
        message: 'hi',
        earlierRoles: [],
        hasAttachment: false,
        customInstructions: 'You are a pirate.',
      })
    ).toBeNull();
  });

  it('offers the same three starting points in every language', () => {
    for (const welcome of Object.values(OPENING_WELCOMES)) {
      expect(welcome.match(/^- /gm)).toHaveLength(3);
      expect(welcome).toContain('**+**');
    }
  });
});
