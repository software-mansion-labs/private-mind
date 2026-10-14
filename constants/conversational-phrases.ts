import type { WelcomeLanguage } from './opening-greetings';

export type PhraseKind =
  'greeting' | 'thanks' | 'farewell' | 'acknowledgement' | 'smallTalk';

export type ConversationalPhrase =
  | {
      readonly text: string;
      readonly kind: 'greeting';
      readonly answeredIn: WelcomeLanguage | null;
    }
  | {
      readonly text: string;
      readonly kind: Exclude<PhraseKind, 'greeting'>;
    };

interface GreetingGroup {
  readonly answeredIn: WelcomeLanguage | null;
  readonly phrases: readonly string[];
}

interface PhraseGroup {
  readonly kind: Exclude<PhraseKind, 'greeting'>;
  readonly phrases: readonly string[];
}

const GREETING_GROUPS: readonly GreetingGroup[] = [
  {
    answeredIn: 'en',
    phrases: [
      'hi',
      'hello',
      'hey',
      'hiya',
      'heya',
      'howdy',
      'yo',
      'greetings',
      'hi there',
      'hello there',
      'hey there',
      'good morning',
      'good afternoon',
      'good evening',
      'good day',
      'morning',
      'evening',
      'namaste',
      'namaskar',
      'pranam',
      'salam',
      'salaam',
      'assalam o alaikum',
      'assalamu alaikum',
      'assalam alaikum',
      'salam alaikum',
      'aadab',
    ],
  },
  {
    answeredIn: 'pl',
    phrases: [
      'cześć',
      'hejka',
      'hejo',
      'siema',
      'siemka',
      'siemanko',
      'elo',
      'witam',
      'witaj',
      'dzień dobry',
      'dobry wieczór',
    ],
  },
  {
    answeredIn: 'de',
    phrases: [
      'hallo',
      'hallöchen',
      'servus',
      'moin',
      'grüß gott',
      'grüß dich',
      'guten morgen',
      'guten tag',
      'guten abend',
    ],
  },
  {
    answeredIn: 'es',
    phrases: [
      'hola',
      'buenas',
      'buenos días',
      'buenas tardes',
      'buenas noches',
    ],
  },
  { answeredIn: 'fr', phrases: ['bonjour', 'bonsoir', 'salut', 'coucou'] },
  {
    answeredIn: 'pt',
    phrases: ['olá', 'oi', 'bom dia', 'boa tarde', 'boa noite'],
  },
  {
    answeredIn: 'ru',
    phrases: [
      'привет',
      'здравствуйте',
      'здравствуй',
      'доброе утро',
      'добрый день',
      'добрый вечер',
    ],
  },
  {
    answeredIn: 'hi',
    phrases: ['नमस्ते', 'नमस्कार', 'प्रणाम', 'हैलो', 'हेलो', 'हाय'],
  },
  { answeredIn: 'ur', phrases: ['السلام علیکم', 'ہیلو', 'ہائے', 'آداب'] },
  {
    answeredIn: 'ar',
    phrases: ['مرحبا', 'أهلا', 'اهلا', 'أهلا وسهلا', 'السلام عليكم'],
  },
  {
    answeredIn: null,
    phrases: ['hej', 'ciao', 'سلام', 'merhaba', 'halo', '你好'],
  },
];

const OTHER_GROUPS: readonly PhraseGroup[] = [
  {
    kind: 'thanks',
    phrases: [
      'thanks',
      'thank you',
      'thanks a lot',
      'thank you very much',
      'thx',
      'धन्यवाद',
      'शुक्रिया',
      'dhanyavad',
      'dhanyawad',
      'shukriya',
      'شکریہ',
      'danke',
      'danke schön',
      'vielen dank',
      'dzięki',
      'dziękuję',
      'obrigado',
      'obrigada',
      'gracias',
      'muchas gracias',
      'merci',
      'merci beaucoup',
      'спасибо',
      'شكرا',
      'grazie',
      'teşekkürler',
      'terima kasih',
      '谢谢',
    ],
  },
  {
    kind: 'farewell',
    phrases: [
      'good night',
      'bye',
      'goodbye',
      'see you',
      'अलविदा',
      'خدا حافظ',
      'khuda hafiz',
      'tschüss',
      'auf wiedersehen',
      'gute nacht',
      'dobranoc',
      'pa',
      'do widzenia',
      'tchau',
      'adiós',
      'au revoir',
      'пока',
      'مع السلامة',
    ],
  },
  {
    kind: 'acknowledgement',
    phrases: [
      'ok',
      'okay',
      'yes',
      'no',
      'sure',
      'cool',
      'great',
      'nice',
      'ठीक है',
      'ओके',
      'हाँ',
      'नहीं',
      'theek hai',
      'thik hai',
      'ٹھیک ہے',
      'ja',
      'nein',
      'tak',
      'nie',
    ],
  },
  {
    kind: 'smallTalk',
    phrases: [
      'how are you',
      'how are you doing',
      "how's it going",
      "what's up",
      'कैसे हो',
      'कैसे हैं आप',
      'kaise ho',
      'kaise hain aap',
      'کیسے ہو',
      'آپ کیسے ہیں',
      'aap kaise hain',
      'wie geht es dir',
      'wie geht es ihnen',
      "wie geht's",
      'jak leci',
      'jak się masz',
      'co słychać',
      'tudo bem',
      'qué tal',
      'ça va',
      'как дела',
      'كيف حالك',
    ],
  },
];

export const CONVERSATIONAL_PHRASES: readonly ConversationalPhrase[] = [
  ...GREETING_GROUPS.flatMap(({ answeredIn, phrases }) =>
    phrases.map((text): ConversationalPhrase => ({
      text,
      kind: 'greeting',
      answeredIn,
    }))
  ),
  ...OTHER_GROUPS.flatMap(({ kind, phrases }) =>
    phrases.map((text): ConversationalPhrase => ({ text, kind }))
  ),
];
