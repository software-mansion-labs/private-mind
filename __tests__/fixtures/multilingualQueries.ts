export type LangCode =
  | 'en'
  | 'hi'
  | 'ur'
  | 'de'
  | 'pt'
  | 'pl'
  | 'es'
  | 'fr'
  | 'ru'
  | 'ar'
  | 'zh'
  | 'id'
  | 'tr'
  | 'it'
  | 'fa';

export interface MultilingualScenario {
  id: string;
  lang: LangCode;
  share: number;
  query: string;
  answer: string;
  marker: string;
  content: string;
  snippet: string;
  terminator: string;
  nonLatinTerminator: boolean;
}

interface LangSpec {
  share: number;
  terminator: string;
  filler: string[];
  queries: [string, string][];
}

const SPECS: Record<LangCode, LangSpec> = {
  en: {
    share: 41.0,
    terminator: '.',
    filler: [
      'Readers often check this page several times a day for the latest update',
      'The information below is compiled from official sources and refreshed regularly',
      'Local conditions can vary and the figures are indicative rather than binding',
    ],
    queries: [
      [
        'what is the weather in Chicago today',
        'The temperature in Chicago today reached {N} degrees under clear skies',
      ],
      [
        'gold price today per ounce',
        'Gold is trading at {N} dollars per ounce in today session',
      ],
      [
        'who won the Champions League final',
        'The Champions League final ended {N} after extra time',
      ],
      [
        'how to reset an iPhone to factory settings',
        'A full factory reset on iPhone takes about {N} minutes to complete',
      ],
      [
        'what time does the supermarket close today',
        'The supermarket closes today at {N} in the evening',
      ],
      [
        'current inflation rate',
        'The annual inflation rate now stands at {N} percent',
      ],
      [
        'bitcoin price right now',
        'Bitcoin is changing hands at {N} dollars right now',
      ],
      [
        'when is the next solar eclipse',
        'The next total solar eclipse is visible in {N} according to astronomers',
      ],
      [
        'how to remove a red wine stain',
        'Blot the red wine stain within {N} minutes for the best result',
      ],
      [
        'what is the exchange rate for the euro',
        'The euro exchange rate is quoted at {N} today',
      ],
      [
        'average electricity price per kwh',
        'Households now pay {N} cents per kilowatt hour on average',
      ],
      [
        'how long does a passport application take',
        'A standard passport application is processed in {N} weeks',
      ],
    ],
  },
  hi: {
    share: 12.8,
    terminator: '।',
    filler: [
      'इस पृष्ठ को हर दिन बड़ी संख्या में पाठक ताज़ा जानकारी के लिए देखते हैं',
      'नीचे दी गई जानकारी आधिकारिक स्रोतों से ली गई है और नियमित रूप से अद्यतन की जाती है',
      'स्थानीय परिस्थितियाँ भिन्न हो सकती हैं इसलिए ये आँकड़े केवल संकेतक हैं',
    ],
    queries: [
      [
        'दिल्ली में आज का मौसम कैसा है',
        'दिल्ली में आज का तापमान {N} डिग्री दर्ज किया गया',
      ],
      ['आज सोने का भाव क्या है', 'आज सोने का भाव {N} रुपये प्रति दस ग्राम रहा'],
      [
        'पेट्रोल की कीमत आज कितनी है',
        'आज पेट्रोल की कीमत {N} रुपये प्रति लीटर है',
      ],
      [
        'आधार कार्ड कैसे डाउनलोड करें',
        'आधार कार्ड डाउनलोड करने में लगभग {N} मिनट लगते हैं',
      ],
      [
        'भारत का अगला क्रिकेट मैच कब है',
        'भारत का अगला क्रिकेट मैच {N} तारीख को खेला जाएगा',
      ],
      [
        'रेलवे टिकट ऑनलाइन कैसे बुक करें',
        'रेलवे टिकट बुक करने के लिए {N} रुपये शुल्क लगता है',
      ],
      ['आज डॉलर का रेट क्या है', 'आज डॉलर का रेट {N} रुपये पर पहुँच गया'],
      [
        'पीएम किसान की अगली किस्त कब आएगी',
        'पीएम किसान की अगली किस्त {N} तारीख को जारी होगी',
      ],
      [
        'दिल्ली में प्रदूषण का स्तर आज',
        'दिल्ली में वायु गुणवत्ता सूचकांक आज {N} दर्ज किया गया',
      ],
      [
        'बिजली का बिल ऑनलाइन कैसे भरें',
        'बिजली का बिल ऑनलाइन भरने पर {N} रुपये की छूट मिलती है',
      ],
    ],
  },
  ur: {
    share: 5.3,
    terminator: '۔',
    filler: [
      'اس صفحے کو ہر روز بہت سے قارئین تازہ ترین معلومات کے لیے دیکھتے ہیں',
      'ذیل میں دی گئی معلومات سرکاری ذرائع سے لی گئی ہیں اور باقاعدگی سے اپ ڈیٹ کی جاتی ہیں',
      'مقامی حالات مختلف ہو سکتے ہیں اس لیے یہ اعداد و شمار صرف اشاراتی ہیں',
    ],
    queries: [
      [
        'لاہور میں آج موسم کیسا ہے',
        'لاہور میں آج درجہ حرارت {N} ڈگری ریکارڈ کیا گیا',
      ],
      ['آج سونے کی قیمت کیا ہے', 'آج سونے کی قیمت {N} روپے فی تولہ رہی'],
      ['ڈالر کا آج کا ریٹ کیا ہے', 'آج ڈالر کا ریٹ {N} روپے تک پہنچ گیا'],
      [
        'پاکستان کا اگلا کرکٹ میچ کب ہے',
        'پاکستان کا اگلا کرکٹ میچ {N} تاریخ کو ہوگا',
      ],
      [
        'بجلی کا بل آن لائن کیسے جمع کرائیں',
        'بجلی کا بل آن لائن جمع کرانے پر {N} روپے رعایت ملتی ہے',
      ],
      [
        'شناختی کارڈ کی تجدید کیسے کریں',
        'شناختی کارڈ کی تجدید میں تقریباً {N} دن لگتے ہیں',
      ],
      ['پٹرول کی قیمت آج کتنی ہے', 'آج پٹرول کی قیمت {N} روپے فی لیٹر ہے'],
      [
        'کراچی میں ٹریفک کی صورتحال',
        'کراچی میں آج {N} مقامات پر ٹریفک جام کی اطلاع ہے',
      ],
    ],
  },
  de: {
    share: 4.9,
    terminator: '.',
    filler: [
      'Diese Seite wird täglich von vielen Leserinnen und Lesern aufgerufen',
      'Die folgenden Angaben stammen aus amtlichen Quellen und werden regelmäßig aktualisiert',
      'Örtliche Gegebenheiten können abweichen, die Werte sind daher Richtwerte',
    ],
    queries: [
      [
        'wie ist das Wetter in Berlin heute',
        'In Berlin wurden heute {N} Grad gemessen',
      ],
      [
        'aktueller Goldpreis pro Unze',
        'Der Goldpreis liegt heute bei {N} Euro je Unze',
      ],
      [
        'wann ist das nächste Bundesliga Spiel',
        'Das nächste Bundesliga Spiel findet am {N} statt',
      ],
      [
        'wie beantrage ich einen Personalausweis',
        'Die Beantragung eines Personalausweises kostet {N} Euro',
      ],
      [
        'Strompreis pro Kilowattstunde',
        'Haushalte zahlen derzeit {N} Cent je Kilowattstunde',
      ],
      [
        'wie hoch ist die Inflation',
        'Die Inflationsrate beträgt aktuell {N} Prozent',
      ],
      ['was kostet Benzin heute', 'Ein Liter Benzin kostet heute {N} Euro'],
    ],
  },
  pt: {
    share: 3.7,
    terminator: '.',
    filler: [
      'Esta página é consultada diariamente por muitos leitores em busca de atualizações',
      'As informações abaixo vêm de fontes oficiais e são atualizadas regularmente',
      'As condições locais podem variar, portanto os valores são apenas indicativos',
    ],
    queries: [
      [
        'como está o tempo em São Paulo hoje',
        'A temperatura em São Paulo chegou hoje a {N} graus',
      ],
      ['cotação do dólar hoje', 'O dólar é negociado hoje a {N} reais'],
      [
        'quando é o próximo jogo do campeonato',
        'O próximo jogo do campeonato acontece no dia {N}',
      ],
      [
        'como tirar a segunda via da conta de luz',
        'A segunda via da conta de luz sai em até {N} minutos',
      ],
      ['preço da gasolina hoje', 'O litro da gasolina custa hoje {N} reais'],
      [
        'como declarar o imposto de renda',
        'A declaração do imposto de renda leva cerca de {N} minutos',
      ],
      [
        'qual o valor do salário mínimo',
        'O salário mínimo está fixado em {N} reais',
      ],
    ],
  },
  pl: {
    share: 3.6,
    terminator: '.',
    filler: [
      'Tę stronę codziennie odwiedza wielu czytelników szukających aktualnych informacji',
      'Poniższe dane pochodzą ze źródeł urzędowych i są regularnie aktualizowane',
      'Warunki lokalne mogą się różnić, dlatego podane wartości mają charakter orientacyjny',
    ],
    queries: [
      [
        'jaka jest pogoda w Krakowie dzisiaj',
        'W Krakowie zanotowano dzisiaj {N} stopni',
      ],
      ['kurs euro dzisiaj', 'Kurs euro wynosi dzisiaj {N} złotych'],
      [
        'kiedy jest następny mecz reprezentacji',
        'Następny mecz reprezentacji odbędzie się {N}',
      ],
      [
        'jak założyć profil zaufany',
        'Założenie profilu zaufanego zajmuje około {N} minut',
      ],
      ['cena paliwa dzisiaj', 'Litr paliwa kosztuje dzisiaj {N} złotych'],
      [
        'ile wynosi płaca minimalna',
        'Płaca minimalna wynosi {N} złotych brutto',
      ],
      [
        'jak rozliczyć PIT przez internet',
        'Rozliczenie PIT przez internet trwa około {N} minut',
      ],
    ],
  },
  es: {
    share: 3.3,
    terminator: '.',
    filler: [
      'Esta página la consultan cada día muchos lectores que buscan datos actualizados',
      'La información siguiente procede de fuentes oficiales y se actualiza con regularidad',
      'Las condiciones locales pueden variar, por lo que las cifras son orientativas',
    ],
    queries: [
      [
        'qué tiempo hace hoy en Madrid',
        'En Madrid se han alcanzado hoy {N} grados',
      ],
      ['precio del oro hoy', 'El oro cotiza hoy a {N} euros la onza'],
      [
        'cuándo es el próximo partido de liga',
        'El próximo partido de liga se juega el día {N}',
      ],
      [
        'cómo pedir cita para el DNI',
        'La cita para el DNI se obtiene en unos {N} minutos',
      ],
      [
        'precio de la gasolina hoy',
        'El litro de gasolina cuesta hoy {N} euros',
      ],
      [
        'cuál es el salario mínimo',
        'El salario mínimo está fijado en {N} euros',
      ],
      [
        'cómo hacer la declaración de la renta',
        'La declaración de la renta se completa en unos {N} minutos',
      ],
    ],
  },
  fr: {
    share: 3.1,
    terminator: '.',
    filler: [
      'Cette page est consultée chaque jour par de nombreux lecteurs',
      'Les informations ci-dessous proviennent de sources officielles et sont mises à jour régulièrement',
      'Les conditions locales peuvent varier, ces valeurs sont donc indicatives',
    ],
    queries: [
      [
        "quel temps fait-il à Paris aujourd'hui",
        'À Paris on a relevé aujourd hui {N} degrés',
      ],
      [
        "cours de l'or aujourd'hui",
        'L or se négocie aujourd hui à {N} euros l once',
      ],
      [
        'quand est le prochain match de championnat',
        'Le prochain match de championnat aura lieu le {N}',
      ],
      [
        "comment faire une carte d'identité",
        'La carte d identité est délivrée en {N} jours',
      ],
      [
        'prix du carburant aujourd hui',
        'Le litre de carburant coûte aujourd hui {N} euros',
      ],
      [
        'quel est le montant du salaire minimum',
        'Le salaire minimum est fixé à {N} euros',
      ],
      [
        'comment déclarer ses impôts en ligne',
        'La déclaration en ligne prend environ {N} minutes',
      ],
    ],
  },
  ru: {
    share: 2.9,
    terminator: '.',
    filler: [
      'Эту страницу ежедневно посещают многие читатели в поисках свежих данных',
      'Приведённые ниже сведения взяты из официальных источников и регулярно обновляются',
      'Местные условия могут отличаться, поэтому цифры носят справочный характер',
    ],
    queries: [
      [
        'какая сегодня погода в Москве',
        'В Москве сегодня зафиксировано {N} градусов',
      ],
      ['курс доллара сегодня', 'Курс доллара сегодня составляет {N} рублей'],
      [
        'когда следующий матч чемпионата',
        'Следующий матч чемпионата состоится {N} числа',
      ],
      ['как получить загранпаспорт', 'Загранпаспорт оформляется за {N} дней'],
      ['цена на бензин сегодня', 'Литр бензина стоит сегодня {N} рублей'],
      [
        'какая минимальная зарплата',
        'Минимальная зарплата установлена на уровне {N} рублей',
      ],
    ],
  },
  ar: {
    share: 2.6,
    terminator: '.',
    filler: [
      'يزور هذه الصفحة يوميا عدد كبير من القراء بحثا عن أحدث المعلومات',
      'المعلومات أدناه مأخوذة من مصادر رسمية ويتم تحديثها بانتظام',
      'قد تختلف الظروف المحلية لذلك فإن الأرقام استرشادية فقط',
    ],
    queries: [
      [
        'كيف حال الطقس في القاهرة اليوم',
        'سجلت القاهرة اليوم درجة حرارة {N} درجة',
      ],
      ['ما هو سعر الذهب اليوم', 'بلغ سعر الذهب اليوم {N} جنيها للجرام'],
      ['سعر صرف الدولار اليوم', 'وصل سعر صرف الدولار اليوم إلى {N}'],
      ['متى المباراة القادمة للدوري', 'تقام المباراة القادمة للدوري يوم {N}'],
      ['كيفية استخراج جواز السفر', 'يستغرق استخراج جواز السفر نحو {N} أيام'],
      ['كم سعر البنزين اليوم', 'يبلغ سعر لتر البنزين اليوم {N} جنيها'],
    ],
  },
  zh: {
    share: 2.2,
    terminator: '。',
    filler: [
      '每天都有大量读者访问本页面查看最新信息',
      '以下信息来自官方渠道并会定期更新',
      '各地情况可能有所不同因此数据仅供参考',
    ],
    queries: [
      ['北京今天天气怎么样', '北京今天的气温达到了{N}度'],
      ['今天黄金价格是多少', '今天黄金价格为每克{N}元'],
      ['美元汇率今天多少', '今天美元汇率为{N}'],
      ['怎么办理护照', '办理护照大约需要{N}个工作日'],
      ['今天油价多少钱一升', '今天汽油价格为每升{N}元'],
      ['下一场联赛比赛什么时候', '下一场联赛比赛将在{N}号举行'],
    ],
  },
  id: {
    share: 1.7,
    terminator: '.',
    filler: [
      'Halaman ini dikunjungi setiap hari oleh banyak pembaca yang mencari informasi terbaru',
      'Informasi di bawah ini berasal dari sumber resmi dan diperbarui secara berkala',
      'Kondisi setempat dapat berbeda sehingga angka ini hanya bersifat indikatif',
    ],
    queries: [
      [
        'bagaimana cuaca di Jakarta hari ini',
        'Suhu di Jakarta hari ini mencapai {N} derajat',
      ],
      ['harga emas hari ini', 'Harga emas hari ini adalah {N} rupiah per gram'],
      ['kurs dolar hari ini', 'Kurs dolar hari ini berada di {N} rupiah'],
      [
        'cara membuat KTP online',
        'Pembuatan KTP online memakan waktu sekitar {N} hari',
      ],
      ['harga BBM hari ini', 'Harga BBM hari ini adalah {N} rupiah per liter'],
    ],
  },
  tr: {
    share: 1.7,
    terminator: '.',
    filler: [
      'Bu sayfa güncel bilgi arayan çok sayıda okuyucu tarafından her gün ziyaret edilir',
      'Aşağıdaki bilgiler resmi kaynaklardan alınmıştır ve düzenli olarak güncellenir',
      'Yerel koşullar değişebileceği için rakamlar yalnızca yol göstericidir',
    ],
    queries: [
      [
        'bugün İstanbulda hava nasıl',
        'İstanbulda bugün sıcaklık {N} dereceye ulaştı',
      ],
      [
        'bugün altın fiyatı ne kadar',
        'Bugün altının gram fiyatı {N} lira oldu',
      ],
      ['dolar kuru bugün ne kadar', 'Dolar kuru bugün {N} lira seviyesinde'],
      [
        'kimlik kartı nasıl alınır',
        'Kimlik kartı başvurusu yaklaşık {N} gün sürüyor',
      ],
      ['bugün benzin fiyatı ne kadar', 'Benzinin litre fiyatı bugün {N} lira'],
    ],
  },
  it: {
    share: 1.6,
    terminator: '.',
    filler: [
      'Questa pagina è consultata ogni giorno da molti lettori in cerca di aggiornamenti',
      'Le informazioni seguenti provengono da fonti ufficiali e sono aggiornate regolarmente',
      'Le condizioni locali possono variare quindi i valori sono solo indicativi',
    ],
    queries: [
      ['che tempo fa oggi a Roma', 'A Roma oggi si sono raggiunti {N} gradi'],
      ["prezzo dell'oro oggi", 'L oro è quotato oggi a {N} euro all oncia'],
      [
        'quando è la prossima partita di campionato',
        'La prossima partita di campionato si gioca il {N}',
      ],
      [
        "come richiedere la carta d'identità",
        'La carta d identità viene rilasciata in {N} giorni',
      ],
      ['prezzo della benzina oggi', 'Un litro di benzina costa oggi {N} euro'],
    ],
  },
  fa: {
    share: 1.6,
    terminator: '.',
    filler: [
      'این صفحه هر روز توسط بسیاری از خوانندگان برای دریافت آخرین اطلاعات بازدید می شود',
      'اطلاعات زیر از منابع رسمی گرفته شده و به طور منظم به روز می شود',
      'شرایط محلی ممکن است متفاوت باشد بنابراین این ارقام تنها جنبه راهنما دارند',
    ],
    queries: [
      [
        'آب و هوای تهران امروز چطور است',
        'دمای هوای تهران امروز به {N} درجه رسید',
      ],
      ['قیمت طلا امروز چند است', 'قیمت هر گرم طلا امروز {N} تومان است'],
      ['نرخ دلار امروز', 'نرخ دلار امروز به {N} تومان رسید'],
      ['چگونه پاسپورت بگیریم', 'صدور پاسپورت حدود {N} روز طول می کشد'],
      ['قیمت بنزین امروز', 'قیمت هر لیتر بنزین امروز {N} تومان است'],
    ],
  },
};

const MIN_BODY_CHARS = 1900;

const buildBody = (spec: LangSpec, answer: string): string => {
  const t = spec.terminator;
  const half: string[] = [];
  let i = 0;
  while (half.join(t + ' ').length < MIN_BODY_CHARS / 2) {
    half.push(spec.filler[i % spec.filler.length]);
    i += 1;
  }
  return [...half, answer, ...half].join(t + ' ') + t;
};

export const MULTILINGUAL_SCENARIOS: MultilingualScenario[] = Object.entries(
  SPECS
).flatMap(([code, spec]) => {
  const lang = code as LangCode;
  return spec.queries.map(([query, answerTemplate], index) => {
    const marker = String(
      10000 + Object.keys(SPECS).indexOf(code) * 100 + index
    );
    const answer = answerTemplate.replace('{N}', marker);
    return {
      id: `${lang}-${index}`,
      lang,
      share: spec.share,
      query,
      answer,
      marker,
      content: buildBody(spec, answer),
      snippet: spec.filler[0],
      terminator: spec.terminator,
      nonLatinTerminator: !'.!?\n'.includes(spec.terminator),
    };
  });
});

export const SCENARIOS_BY_LANG = (lang: LangCode): MultilingualScenario[] =>
  MULTILINGUAL_SCENARIOS.filter((s) => s.lang === lang);

export const ALL_LANGS = Object.keys(SPECS) as LangCode[];
