import {
  answerUsesNoRetrievedEvidence,
  claimsMissingEvidenceItHas,
  distinctiveEvidence,
} from '../utils/messageSources';

const NBP_CONTEXT =
  'Kurs euro Kurs InternetowyKantor.pl Nasz kurs | Kurs NBP Kurs kupna EUR InternetowyKantor.pl 4,3327 | Zmiana kursu średniego';
const SKI_CONTEXT =
  'Karnet normalny 150,00 PLN, karnet dwudniowy 285,00 PLN, karnet sezonowy 995,00 PLN.';
const STARSHIP_CONTEXT =
  'Starship zaliczył pierwszy w pełni udany lot. Minionej nocy, z 26 na 27 sierpnia, SpaceX przeprowadził dziesiąty lot testowy.';

describe('an answer that claims absence while the block holds the figure', () => {
  it('catches a refusal about a rate the context states', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Na podstawie dostarczonych źródeł nie ma informacji o kursie wymiany euro za złoty.',
        'Jaki jest kurs euro do zlotego?',
        NBP_CONTEXT
      )
    ).toBe(true);
  });

  it('catches a refusal about a price the context lists', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Na podstawie dostarczonych źródeł nie jest podana informacja o cenie karnetu.',
        'Ile kosztuje karnet narciarski w Zakopanem?',
        SKI_CONTEXT
      )
    ).toBe(true);
  });

  it('catches a refusal about a date the context carries', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Zgodnie ze źródłami nie ma informacji o pierwszym w pełni udanym locie.',
        'Kiedy odbyl sie pierwszy w pelni udany lot Starship?',
        STARSHIP_CONTEXT
      )
    ).toBe(true);
  });

  it('catches the English form', () => {
    expect(
      claimsMissingEvidenceItHas(
        'The sources contain no information about the price.',
        'How much does a ski pass cost?',
        SKI_CONTEXT
      )
    ).toBe(true);
  });

  it('leaves a refusal alone when the block really holds no figure', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Na podstawie dostarczonych źródeł nie ma informacji o cenie karnetu.',
        'Ile kosztuje karnet narciarski w Zakopanem?',
        'Kup skipass online. Ważny na wyciągach Tatry Super Ski w Białce i Bukowinie.'
      )
    ).toBe(false);
  });

  it('does not fire when the question asks for neither a date nor an amount', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Źródła nie zawierają informacji na ten temat.',
        'Kto jest prezesem SpaceX?',
        SKI_CONTEXT
      )
    ).toBe(false);
  });

  it('does not fire on an answer that actually answers', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Karnet normalny kosztuje 150,00 PLN.',
        'Ile kosztuje karnet narciarski w Zakopanem?',
        SKI_CONTEXT
      )
    ).toBe(false);
  });

  it('needs a context to compare against', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Nie ma informacji o cenie.',
        'Ile to kosztuje?',
        ''
      )
    ).toBe(false);
  });
});

describe('refusals measured on the Pixel 10, Gemma 4 - 2B', () => {
  const GOLD_CONTEXT =
    'Gold Price in US Today: per oz 4,438.55 United States dollars. United States gold price today at livepriceofgold.com.';

  it('catches "nie jestem w stanie okreslic" over a context that states the price', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Zgodnie z informacjami zawartymi w dostarczonych źródłach, nie jestem w stanie określić aktualnej ceny uncji złota w dolarach.',
        'Ile kosztuje uncja zlota w dolarach?',
        GOLD_CONTEXT
      )
    ).toBe(true);
  });

  it('catches "nie mam dostepu" when the sources carry the figure', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Przepraszam, ale nie mam dostępu do aktualnych i dynamicznych informacji o cenach.',
        'Ile kosztuje uncja zlota w dolarach?',
        GOLD_CONTEXT
      )
    ).toBe(true);
  });

  it('leaves the same refusal alone when no source carries a figure', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Przepraszam, ale nie mam dostępu do aktualnych informacji o cenach.',
        'Ile kosztuje uncja zlota w dolarach?',
        'Sprawdz cene zlota za uncje, gram lub kilogram na naszym wykresie.'
      )
    ).toBe(false);
  });
});

describe('an answer that uses none of the evidence retrieved', () => {
  const CAMERA_CONTEXT = [
    'Nikon Coolpix P1100 oferuje zoom optyczny 125x oraz matryce CMOS 16 MP.',
    'Canon PowerShot V1 nagrywa wideo w 4K 60p i kosztuje 3499 zlotych.',
    'Sony ZV-1 II pozostaje wyborem dla vlogerow, cena to 2899 zlotych.',
    'Ranking obejmuje rowniez Panasonic Lumix TZ200 oraz Fujifilm X100VI.',
  ].join(' ');

  it('fires on a refusal written in a language no phrase list covers', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Ich habe keine Informationen, die den Preis des Samsung Galaxy S25 Ultra betreffen, in den bereitgestellten Quellen gefunden.',
        'Ile kosztuje Samsung Galaxy S25 Ultra?',
        CAMERA_CONTEXT
      )
    ).toBe(true);
  });

  it('fires on a Polish phrasing that no list happened to carry', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Informacje zawarte w dostarczonych źródłach nie precyzują, ile dokladnie trzeba zaplacic za ten model aparatu.',
        'Ile kosztuje ten aparat?',
        CAMERA_CONTEXT
      )
    ).toBe(true);
  });

  it('stays quiet when the answer quotes something the sources carry', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Canon PowerShot V1 kosztuje 3499 zlotych i nagrywa w 4K 60p.',
        'Ile kosztuje ten aparat?',
        CAMERA_CONTEXT
      )
    ).toBe(false);
  });

  it('stays quiet when barely anything was retrieved', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Na podstawie dostarczonych źródeł nie moge tego ustalic w tej chwili.',
        'Ile kosztuje ten aparat?',
        'Koszyk jest pusty.'
      )
    ).toBe(false);
  });

  it('ignores a one-line reply that was never an answer attempt', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Dziękuję bardzo.',
        'Dzieki za pomoc.',
        CAMERA_CONTEXT
      )
    ).toBe(false);
  });

  it('does not credit a name the question already carried', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Nikon nie zostal opisany w zrodlach w sposob pozwalajacy na odpowiedz.',
        'Co wiesz o Nikon?',
        CAMERA_CONTEXT
      )
    ).toBe(true);
  });

  it('reads figures written in another numeral system', () => {
    expect(distinctiveEvidence('कीमत १२५ रुपये').has('125')).toBe(true);
  });
});
