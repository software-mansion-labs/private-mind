# Otwarte, nienaprawione — web search

Dwie rzeczy z listy słabych punktów zostały świadomie niezrobione, bo obie są
większe niż poprawka promptu i wymagają własnej decyzji projektowej. Dowody:
`docs/rounds/2026-09-07-weak-points.md` i lokalny `docs/test-evidence/pixel-r3/`.

## 1. Strony renderowane po stronie klienta wracają puste

**Objaw.** Pytanie trafia w dokładnie właściwą stronę i nie dostaje z niej nic.

| pytanie                                         | źródło                                       | odpowiedź                                   |
| ----------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| „Jaka bedzie pogoda w weekend w Zakopanem?"     | strona pogodowa                              | „Nie ma informacji o pogodzie"              |
| „Jaka jest aktualnie pogoda w waszyngtonie?"    | „Pogoda w Waszyngtonie dziś i na 14 dni"     | „nie jest możliwe podanie aktualnej pogody" |
| „Kiedy gra kolejny mecz Lech Poznań?"           | „Lech Poznań terminarz — pełne kalendarium"  | „nie jest możliwe określenie daty"          |
| „Jaki jest wynik ostatniego meczu?"             | „Lech Poznań wyniki meczów i wyniki na żywo" | „nie jest możliwe określenie wyniku"        |
| „Jakie są mecze w tym miesiącu w ekstraklasie?" | „Tabela ekstraklasy 2026"                    | „nie mam wystarczających informacji"        |

Pogoda, terminarze i wyniki na żywo to jednocześnie **najczęstsze** pytania w
aplikacji i **najsłabiej** obsługiwana kategoria.

**Przyczyna.** `webViewScrapeProvider` pobiera HTML, a te strony wstawiają dane
JavaScriptem po załadowaniu. `extractArticle` dostaje szkielet: nawigację,
stopkę, adres. `webResultsToContext` ma już fallback na snippet z wyszukiwarki,
ale snippet strony pogodowej rzadko niesie samą prognozę.

**Możliwe kierunki, w kolejności kosztu:**

1. Poczekać na render przed pobraniem treści — WebView już jest, chodzi o to,
   żeby czytać po `load` plus krótkim opóźnieniu, a nie z surowego HTML. Trzeba
   zmierzyć, ile to dokłada do i tak długiego TTFT (dziś 30–40 s z Web).
2. Wykryć pustą ekstrakcję i przejść do kolejnej strony z listy wyników,
   zamiast oddawać model do odpowiedzi z pustym kontekstem.
3. Dla pogody preferować źródła, które podają dane w HTML.

Bez tego żadna zmiana promptu ani rankingu nie pomoże — treści po prostu nie ma.

## 2. Zadania szkolne: wyszukiwanie trafia w opracowania lektur

**Objaw.** „Kim byli krzyzacy? Napisz krotkie wypracowanie na jezyk polski"

| tryb          | źródło                                              | wynik                                                |
| ------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Web włączony  | „Krzyżacy — opracowanie, problematyka, bohaterowie" | odpowiedź o **powieści Sienkiewicza**, nie o zakonie |
| Web wyłączony | —                                                   | poprawne, sensowne wypracowanie o zakonie krzyżackim |

Wcześniej to samo pytanie trafiało w „Grand Encampment of Knights Templar,
U.S.A." — czyli dwa różne pudła pod rząd.

**Przyczyna.** Zapytanie „krzyżacy wypracowanie" jest dla wyszukiwarki wprost
zapytaniem o **lekturę**: portale edukacyjne dominują wyniki, bo dokładnie na
takie zapytania są zoptymalizowane. Model dostaje kontekst o powieści i,
zgodnie z instrukcją odpowiadania wyłącznie ze źródeł, pisze o powieści.

**Możliwe kierunki:**

1. Nie wyszukiwać przy prośbie o formę pisemną na temat, który nie wymaga
   świeżych faktów. Planer ma już `needs_search: false` dla „rewriting" i
   „timeless general knowledge" — brakuje reguły, że wypracowanie o wydarzeniu
   historycznym też się tam mieści.
2. Odseparować temat od formy: szukać samego tematu („zakon krzyżacki
   historia"), a formę zostawić instrukcji odpowiedzi. Słowo „wypracowanie" nie
   powinno trafiać do wyszukiwarki.

Kierunek 2 jest lepszy dla zadań, które **wymagają** faktów z sieci („napisz
artykuł o wczorajszym meczu"), i to on jest wart zrobienia.

## 3. Ostrzeżenie o liczbie nie daje użytkownikowi nic do zrobienia

**Objaw.** Kiedy `figureGrounding` wykryje liczbę bez pokrycia w źródłach,
pod odpowiedzią pojawia się „A number here couldn't be confirmed against the
sources" i na tym się kończy. Użytkownik wie, że odpowiedź może być zmyślona,
i nie ma żadnego przycisku — musi ręcznie przepisać pytanie.

**Propozycja.** Zamienić odznakę w kontrolkę: obok tekstu akcja, która ponawia
tę samą turę z promptem naprawczym, bez ponownego wyszukiwania. Materiał już
jest — `sourceDocuments[].passage` zapisane przy wiadomości niosą treść stron,
a `focusedRetrySystemPrompt` i `focusedEvidencePrompt` w `promptUtils.ts` to
gotowa maszyneria „odpowiedz wyłącznie z tych zdań", której dziś używa
automatyczny nudge.

**Do rozstrzygnięcia przed implementacją:**

1. Czy poprawiona odpowiedź zastępuje starą, czy dopisuje się jako kolejna
   wiadomość. Zastąpienie jest czystsze, ale kasuje dowód, że model się mylił.
2. Co zrobić, gdy druga próba też wypadnie bez pokrycia — druga odznaka bez
   akcji, czy komunikat, że źródła po prostu tej liczby nie mają.
3. Osobne prompty dla trzech rodzajów zastrzeżeń (`figure`, `trend`,
   `conversion`) czy jeden wspólny.

**Warunek wstępny.** Runda `2026-09-10-pixel-weak-models.md` pokazała, że
mechanizm milczy tam, gdzie powinien mówić: przy tym samym źródle
(`idealo`, `€ 794,90`) LLaMA 3.2 – 1B dostała ostrzeżenie, a Qwen 3 – 0.6B
przy równie niezgodnej liczbie nie. Przycisk naprawy na odznace, która pojawia
się losowo, sprzedaje użytkownikowi fałszywe poczucie kontroli — najpierw
trzeba domknąć wykrywanie.

## 4. Świeżość wyników po usunięciu listy słów

`datedForCurrentState` dopisywał bieżący rok do zapytania, gdy pytanie
zawierało „aktualnie", „obecnie", „currently" i kilka innych fraz — czyli
działał dla dwóch języków z czternastu. Został usunięty razem z
`ASKS_CURRENT_STATE`, a jego rolę przejęły dwa sygnały neutralne językowo:
`namesATimePeriod` (rok albo liczba rzymska w pytaniu) decyduje, czy pytanie
dotyczy teraźniejszości, a `freshYear` w rankingu **premiuje** stronę nazywającą
bieżący rok, nigdy nie karząc pozostałych.

Nie zmierzono tego na urządzeniu. Do najbliższej rundy: powtórzyć pytania o
osobę pełniącą urząd w kilku językach i sprawdzić, czy strona o teraźniejszości
nadal wygrywa z listą historyczną bez dopisywania roku do zapytania.

## 5. Goła lista bez nagłówka wymaga planera

`listHeadingAnswers` rozpoznaje listę po nagłówku z dwukropkiem, trzech krótkich
wierszach pod nim i terminie z pytania, którego nie ma w tytule strony. Strona,
która wysypuje wyliczankę bez żadnego nagłówka, po akapicie powtarzającym słowa
pytania, nadal wymaga `intent: 'howto'` od planera — czyli nie zadziała dla
modeli chodzących verbatim.

**Zmierzona skala, na 155 unikalnych pytaniach z urządzeń.** Pytań o listę jest
12 na 271 tur (4,4 %), ale większość z nich — „lista porad na dobry sen",
„7 rzeczy do spakowania", „5 tips for staying focused" — w ogóle nie idzie do
sieci, bo planer odrzuca je jako wiedzę ogólną. Do selekcji fragmentów strony
trafiają dwa: przepis na sernik i składniki aktywne w kosmetykach. To **około
1,3 % tur z wyszukiwaniem**.

**Sprawdzone i odrzucone.** Liczebnik w pytaniu („podaj 5 rzeczy") wygląda na
darmowy sygnał notacyjny, ale na tym samym korpusie łapie 15 pytań, z czego 10
to fałszywe trafienia: „iPhone 17 Pro 256GB", „Legion 5 Pro", „ile to jest 10
razy 10", „na 15 dni". Dwie trzecie błędu — nie do użycia.

**Co zrobić zamiast zgadywania.** Najpierw zmierzyć brakującą liczbę: ile stron
w rundzie ma listę bez nagłówka. Dziś tego nie wiemy, bo trace tego nie zapisuje.
Dodać do zapisu rundy udział wierszy listowych i to, czy znaleziono nagłówek.

Jeśli okaże się, że to realny odsetek, najtańszą naprawą **nie** jest klasyfikacja
pytania, tylko rezerwacja budżetu: kiedy dokument ma wyraźny region listowy,
zagwarantować mu kawałek kontekstu obok prozy i zostawić wybór modelowi. To
usuwa problem klasyfikacji i nie kosztuje dodatkowej generacji — w przeciwieństwie
do dopytania modelu „czy to pytanie o listę", które dokłada rundę na telefonie
przy każdej turze, żeby obsłużyć jedną na sto.

## Znane, drobniejsze, nierozwiązane

- **Fałszywe „A number here couldn't be confirmed against the sources"** —
  nadal wychodzi na liczbach, które odpowiedź wprost przypisuje cytowanej
  stronie (2 na 20 tur na S25, powtórzone na Pixelu przy cenach wędek), mimo
  poprawki `a5e798a`.
- **Zakres cen zamiast wyliczanki** — przy siedmiu znalezionych cenach model
  wypisał wszystkie siedem, choć `getRangeHint` każe podać sam zakres przy
  trzech lub więcej.
- **Sprostowanie gospodarza imprezy** — instrukcja o sprawdzeniu roku, miejsca
  i składu dopuszcza sprostowanie, ale go nie wymaga; „turniej w Brazylii w
  2026" przeszło bez komentarza, choć rok się zgadzał, a miejsce nie.
