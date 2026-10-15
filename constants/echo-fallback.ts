import type { WelcomeLanguage } from './opening-greetings';

export const ECHO_FALLBACK: Record<WelcomeLanguage, string> = {
  en: "I couldn't come up with an answer to that. Could you ask it another way, with a bit more detail?",
  pl: 'Nie udało mi się na to odpowiedzieć. Możesz zapytać inaczej, z odrobiną więcej szczegółów?',
  de: 'Darauf habe ich keine Antwort gefunden. Kannst du die Frage anders stellen, mit etwas mehr Details?',
  es: 'No he podido responder a eso. ¿Puedes preguntarlo de otra forma, con un poco más de detalle?',
  fr: "Je n'ai pas réussi à répondre à cela. Peux-tu reformuler la question avec un peu plus de détails ?",
  pt: 'Não consegui responder a isso. Pode perguntar de outra forma, com um pouco mais de detalhe?',
  ru: 'Мне не удалось на это ответить. Можете спросить иначе и чуть подробнее?',
  hi: 'मैं इसका जवाब नहीं दे पाया। क्या आप यह सवाल थोड़े और विवरण के साथ दूसरे तरीके से पूछ सकते हैं?',
  ur: 'میں اس کا جواب نہیں دے سکا۔ کیا آپ یہ سوال تھوڑی مزید تفصیل کے ساتھ کسی اور طرح پوچھ سکتے ہیں؟',
  ar: 'لم أتمكن من الإجابة عن ذلك. هل يمكنك طرح السؤال بطريقة أخرى مع قليل من التفاصيل؟',
};
