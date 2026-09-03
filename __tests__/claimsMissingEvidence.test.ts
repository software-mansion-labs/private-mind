import { claimsMissingEvidenceItHas } from '../utils/messageSources';

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
