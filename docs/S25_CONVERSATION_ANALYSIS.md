# Galaxy S25 — analiza rozmowy na buildzie z poprawkami

Zebrane 2026-09-07 z Galaxy S25 (`RFCYA14A94T`, SM-S931B, 10,9 GB RAM),
build `versionCode=68`, `lastUpdateTime=2026-09-07 16:24` — **z** poprawkami
R1–R9 i trzema poprawkami z dokumentu kompatybilności. Model: **Gemma 4 - 2B**,
web search włączony. Na telefonie jest jedna rozmowa, 20 tur.

Zapis: `docs/test-evidence/s25-r3/s25-chat-1.txt`.
Statystyki prędkości są w Ustawieniach wyłączone, więc ttft/tps nie ma.

## Co działa

**20 pytań, 20 odpowiedzi.** Żadnej pustej bańki, żadnej zgubionej tury,
żadnej podwójnej. To pierwszy zebrany materiał, który to potwierdza na
buildzie z R1/R2.

**Temat nie przecieka między wątkami mimo ośmiu przeskoków.** Rozmowa idzie:
pogoda → wędki → rower → MTB → ubezpieczenie MTB → inwestycje → mundial →
ekstraklasa → ciasto marchewkowe → Zabłocie → **z powrotem** ciasto → **z
powrotem** Zabłocie → znowu ciasto. Każde pytanie dostało odpowiedź na swój
temat, w tym powroty do tematu sprzed kilku tur. To jest dokładnie to, co
psuło się na Pixelu (Kraków w rozmowie o Zakopanem) i co naprawia `9038274`.

**Odniesienia w obrębie tematu działają.** „Chce mtb co musze wziac pod uwage"
→ MTB; „Jakie są to aspekty" → te same aspekty; „Jakie ubezpieczenie wybrać do
jazdy na rowerxe mtb" → ubezpieczenia MTB. Literówki („rowerxe", „zacxąć",
„oststni", „moesiacu") nie przeszkodziły.

## Problemy

### 1. Halucynacja z fałszywym źródłem pod podrzuconą nieprawdę — NAJPOWAŻNIEJSZE

| tura | pytanie | odpowiedź |
| --- | --- | --- |
| 12 | „Kto wygrał oststni mundial?" | Argentyna, 2022, Katar — **poprawnie**, źródło: lista mistrzów od 1930 |
| 13 | „Oststni turnej był w brazylii w2026 roku kto go wygrał?" | „**Hiszpania wygrała mistrzostwo świata 2026, pokonując Argentynę 1:0 po dogrywce**", źródło: „Kto wygrał mundial 2026? Wynik finału… \| Akademia Wygrywania" |

Użytkownik podał nieprawdziwą przesłankę, model ją przyjął bez zastrzeżenia i
odpowiedział zmyślonym wynikiem — **z podpiętym źródłem**, więc odpowiedź
wygląda na ugruntowaną. Wyszukiwarka pod zapytanie o „mundial 2026" znalazła
stronę SEO, a model potraktował ją jak fakt. Odpowiedź z poprzedniej tury
(Argentyna 2022) została po cichu porzucona.

To łączy dwa mechanizmy naraz: uleganie przesłance użytkownika i brak
weryfikacji, czy źródło w ogóle może mówić o zdarzeniu, które jeszcze nie
zaszło. Nic w kodzie tego dziś nie łapie — `findUngroundedFigures` sprawdza
liczby, nie zdarzenia.

### 2. Ostrzeżenie „A number here couldn't be confirmed" na liczbach wprost ze źródła

Dwa wystąpienia na 20 tur, oba wyglądają na fałszywy alarm:

| odpowiedź | liczba | źródło |
| --- | --- | --- |
| „solidne wędki dla początkujących najczęściej kosztują od 90 zł do 250 zł" | 90–250 zł | „Ile kosztują wędki — Sprawdź, ile wydać na sprzęt" |
| „mediana ceny mieszkań wynosi 709 815 zł, a średnia 20 962 zł/m²" | 709 815 / 20 962 | „Ceny mieszkań i domów — Zabłocie, Kraków \| RealAdvisor" |

W obu przypadkach liczba jest w odpowiedzi wprost przypisana do cytowanej
strony. Poprawka `fc62a39` rozszerzyła `PRICE_STATEMENT` o czasowniki wartości,
ale to najwyraźniej nie wystarcza — 10 % tur dostaje ostrzeżenie, które
podważa poprawną odpowiedź.

### 3. Zapytanie gubi przedmiot pytania na rzecz okoliczności

„Chce kupic **wedke** na prezent koledze ile kosztuja takie rzeczy?" → źródło
**„Zegarków na prezent • 18019 modeli • Fabrykazegarkow.pl"** i odpowiedź
„Przekazana informacja nie dotyczy kosztu prezentu dla kolegi. Istniejące
źródła dotyczą sprzedaży zegarków". Zapytanie poszło za słowem „prezent",
zgubiło „wędkę". Użytkownik musiał zapytać jeszcze raz, prościej („Ile kosztują
wedki?"), żeby dostać sensowną odpowiedź.

### 4. Strony dynamiczne = „nie ma informacji" mimo trafionego źródła

Cztery tury z rzędu trafiły we właściwą stronę i nie dostały z niej nic:

| pytanie | źródło | odpowiedź |
| --- | --- | --- |
| pogoda w Waszyngtonie | „Pogoda w Waszyngtonie dziś i na 14 dni" | „nie jest możliwe podanie aktualnej pogody" |
| mecze w ekstraklasie w tym miesiącu | „Tabela ekstraklasy 2026 \| Aktualne wyniki" | „nie mam wystarczających informacji" |
| kiedy gra Lech Poznań | „Lech Poznań terminarz — pełne kalendarium meczów" | „nie jest możliwe określenie daty" |
| wynik ostatniego meczu Lecha | „Lech Poznań wyniki meczów i wyniki na żywo" | „nie jest możliwe określenie wyniku" |

Retrieval trafia bezbłędnie, a treść nie dociera — strony z wynikami na żywo,
terminarzami i pogodą renderują dane po stronie klienta. To nie jest problem
modelu ani planera zapytań, tylko `extractArticle` na stronach JS-owych.

### 5. Odpowiedź zamiast treści referuje listę stron

„Podaj przepis na ciasto marchewkowe" → nie przepis, tylko przegląd: „przyslij-
przepis.pl oferuje…", „aniagotuje.pl mówi o…", „kwestiasmaku.com mówi o…",
„poprostupycha.com.pl przedstawia…". Dopiero po powtórzeniu pytania z jawną
strukturą („1. Skladniki 2. Przepis krok po kroku") przyszedł przepis — ale z
przemieszaną numeracją: pod „1. Składniki" są **czynności**, a nie lista
składników, a „2. Przepis krok po kroku" powtarza te same trzy zdania. Trzecia
próba („Podaj liste skladnikow") urwała się po pierwszym zdaniu.

Ten sam wzorzec co na Pixelu przy krzyżakach i dzieciach prezydenta: Gemma 4 2B
referuje źródła zamiast odpowiadać.

### 6. Powtórzenia wewnątrz jednej odpowiedzi

W odpowiedzi o inwestycjach zwrot „zależy od celów inwestycyjnych i preferencji
użytkownika" pada trzy razy, w tym w zapętlonej formie „ponieważ to zależy od
celów inwestycyjnych i preferencji użytkownika". W ciekawostkach o Zabłociu
zdanie „Zabłocie to dynamicznie rozwijająca się dzielnica Krakowa, łącząca
historię, przemysł i kulturę" pada dwa razy, w tym jako ostatni z dziesięciu
punktów. `truncateAtRepeatedClause` łapie powtórzenia dosłowne — te są
parafrazami.

### 7. Drobne

- Prefiks po angielsku w polskiej odpowiedzi: „**According to** sklep-rybny.pl,
  popularny segment średni…", podczas gdy tura wcześniej użyła „Według".
- Halucynacja w ciekawostkach: „Zabłocie… przyciąga uwagę, podobnie jak
  dzielnica **Windsor w Australijskim Melbourne**".
- Urwany nawias w odpowiedzi o inwestycjach: „(o ile można mówić o stanie...)".

## Podsumowanie

| # | problem | gdzie leży |
| --- | --- | --- |
| 1 | zmyślony wynik mundialu 2026 z podpiętym źródłem | brak weryfikacji przesłanki użytkownika + śmieciowe źródło |
| 2 | fałszywe „A number couldn't be confirmed" (2/20 tur) | `figureGrounding`, mimo `fc62a39` |
| 3 | „wędka na prezent" → sklep z zegarkami | `buildSearchQuery` — okoliczność wypiera przedmiot |
| 4 | strony JS-owe zwracają pustkę (4 tury) | `extractArticle` |
| 5 | referowanie stron zamiast odpowiedzi | prompt odpowiedzi / Gemma 4 2B |
| 6 | powtórzenia parafrazowane | `loopDetection` łapie tylko dosłowne |
| 7 | „According to" w polskiej odpowiedzi | prompt językowy |

Dwa najcenniejsze wnioski dla tego brancha: **poprawki R1/R2 i izolacja tematu
działają** (20/20 tur, osiem przeskoków tematu bez przecieku), a **weryfikator
liczb nadal daje fałszywe alarmy** mimo `fc62a39`.

### Uwaga metodologiczna

Pierwsze przejście zbierające dało zapis, w którym brakowało sześciu pytań
użytkownika, przez co odpowiedzi wyglądały na przemieszane między turami.
To był błąd sklejania ekranów w narzędziu, nie aplikacji. Powyższa analiza
opiera się na drugim przejściu (30 ekranów zapisanych osobno, sklejanie
offline), w którym każda z 20 odpowiedzi stoi pod własnym pytaniem.
