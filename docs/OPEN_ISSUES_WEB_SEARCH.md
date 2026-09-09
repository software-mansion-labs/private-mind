# Otwarte, nienaprawione — web search

Dwie rzeczy z listy słabych punktów zostały świadomie niezrobione, bo obie są
większe niż poprawka promptu i wymagają własnej decyzji projektowej. Dowody:
`docs/WEAK_POINTS_AFTER_FIXES.md`, `docs/test-evidence/pixel-r3/`.

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
