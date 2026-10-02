export type WelcomeLanguage =
  'en' | 'pl' | 'de' | 'es' | 'fr' | 'pt' | 'ru' | 'hi' | 'ur' | 'ar';

export const GREETING_ADDRESSEES: readonly string[] = [
  'there',
  'assistant',
  'ai',
  'bot',
  'private mind',
  'everyone',
];

export const OPENING_WELCOMES: Record<WelcomeLanguage, string> = {
  en: [
    "Hi! 👋 I'm your private assistant. I run entirely on this phone, so what you write stays with you.",
    'Here are a few things you can ask me:',
    [
      '- Explain a topic step by step',
      '- Write or polish a message, an email or a post',
      '- Summarize a document (tap **+** to attach one)',
    ].join('\n'),
    'What would you like to start with?',
  ].join('\n\n'),
  pl: [
    'Cześć! 👋 Jestem Twoim prywatnym asystentem. Działam w całości na tym telefonie, więc to, co piszesz, zostaje u Ciebie.',
    'Możesz mnie poprosić na przykład o:',
    [
      '- wyjaśnienie tematu krok po kroku',
      '- napisanie lub poprawienie wiadomości, maila albo posta',
      '- streszczenie dokumentu (dodasz go przyciskiem **+**)',
    ].join('\n'),
    'Od czego zaczynamy?',
  ].join('\n\n'),
  de: [
    'Hallo! 👋 Ich bin dein privater Assistent. Ich laufe vollständig auf diesem Handy, deshalb bleibt alles, was du schreibst, bei dir.',
    'Du kannst mich zum Beispiel bitten:',
    [
      '- ein Thema Schritt für Schritt zu erklären',
      '- eine Nachricht, eine E-Mail oder einen Beitrag zu schreiben oder zu verbessern',
      '- ein Dokument zusammenzufassen (mit **+** hängst du eines an)',
    ].join('\n'),
    'Womit möchtest du anfangen?',
  ].join('\n\n'),
  es: [
    '¡Hola! 👋 Soy tu asistente privado. Funciono por completo en este teléfono, así que lo que escribes se queda contigo.',
    'Puedes pedirme, por ejemplo:',
    [
      '- explicar un tema paso a paso',
      '- escribir o mejorar un mensaje, un correo o una publicación',
      '- resumir un documento (toca **+** para adjuntarlo)',
    ].join('\n'),
    '¿Por dónde empezamos?',
  ].join('\n\n'),
  fr: [
    'Bonjour ! 👋 Je suis votre assistant privé. Je fonctionne entièrement sur ce téléphone, donc ce que vous écrivez reste chez vous.',
    'Vous pouvez par exemple me demander :',
    [
      "- d'expliquer un sujet étape par étape",
      "- d'écrire ou d'améliorer un message, un e-mail ou une publication",
      '- de résumer un document (touchez **+** pour en joindre un)',
    ].join('\n'),
    'Par quoi voulez-vous commencer ?',
  ].join('\n\n'),
  pt: [
    'Olá! 👋 Sou seu assistente privado. Funciono inteiramente neste celular, então o que você escreve fica com você.',
    'Você pode me pedir, por exemplo:',
    [
      '- explicar um assunto passo a passo',
      '- escrever ou melhorar uma mensagem, um e-mail ou um post',
      '- resumir um documento (toque em **+** para anexar)',
    ].join('\n'),
    'Por onde começamos?',
  ].join('\n\n'),
  ru: [
    'Привет! 👋 Я ваш личный ассистент. Я работаю полностью на этом телефоне, поэтому всё, что вы пишете, остаётся у вас.',
    'Меня можно попросить, например:',
    [
      '- объяснить тему шаг за шагом',
      '- написать или улучшить сообщение, письмо или пост',
      '- кратко пересказать документ (нажмите **+**, чтобы прикрепить его)',
    ].join('\n'),
    'С чего начнём?',
  ].join('\n\n'),
  hi: [
    'नमस्ते! 👋 मैं आपका निजी सहायक हूँ। मैं पूरी तरह इसी फ़ोन पर चलता हूँ, इसलिए आप जो लिखते हैं वह आपके पास ही रहता है।',
    'आप मुझसे ये काम करवा सकते हैं, जैसे:',
    [
      '- किसी विषय को आसान चरणों में समझाना',
      '- कोई संदेश, ईमेल या पोस्ट लिखना या सुधारना',
      '- किसी दस्तावेज़ का सारांश बनाना (जोड़ने के लिए **+** दबाएँ)',
    ].join('\n'),
    'आप किससे शुरू करना चाहेंगे?',
  ].join('\n\n'),
  ur: [
    'السلام علیکم! 👋 میں آپ کا نجی معاون ہوں۔ میں مکمل طور پر اسی فون پر چلتا ہوں، اس لیے آپ جو کچھ لکھتے ہیں وہ آپ ہی کے پاس رہتا ہے۔',
    'آپ مجھ سے مثال کے طور پر یہ کام لے سکتے ہیں:',
    [
      '- کسی موضوع کو قدم بہ قدم سمجھانا',
      '- کوئی پیغام، ای میل یا پوسٹ لکھنا یا بہتر بنانا',
      '- کسی دستاویز کا خلاصہ بنانا (شامل کرنے کے لیے **+** دبائیں)',
    ].join('\n'),
    'آپ کہاں سے شروع کرنا چاہیں گے؟',
  ].join('\n\n'),
  ar: [
    'مرحبًا! 👋 أنا مساعدك الخاص. أعمل بالكامل على هذا الهاتف، لذلك يبقى ما تكتبه لديك.',
    'يمكنك أن تطلب مني مثلًا:',
    [
      '- شرح موضوع خطوة بخطوة',
      '- كتابة رسالة أو بريد إلكتروني أو منشور، أو تحسينه',
      '- تلخيص مستند (اضغط **+** لإرفاقه)',
    ].join('\n'),
    'بماذا تودّ أن نبدأ؟',
  ].join('\n\n'),
};

export const OPENING_WELCOME_INSTRUCTION =
  'The user has only greeted you, and this is the start of the chat. Reply with a short welcome of your own, written in the language of the example below: greet them back, say in one sentence that you are a private assistant running on their phone, offer three short examples of what you can help with as a list, and ask what they would like to start with. Keep to the length of the example. Do not answer a question that was not asked.';
