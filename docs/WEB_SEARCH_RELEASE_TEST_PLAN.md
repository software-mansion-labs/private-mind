# Web search — plan testów przed produkcją

Cel: zanim web search trafi do użytkowników, przejść go **szeroko** (wszystkie
rodzaje pytań, kilka języków, kilka modeli, złe warunki) i **głęboko** (długie
rozmowy, zmiany tematu i języka w trakcie), z dowodem z bazy i logu na każdą
turę. Ten plan uzupełnia `WEAK_MODEL_TEST_PLAN.md` (S1–S8, jeden model, jedna
sesja) i `WEAK_MODEL_TEST_MINIMAL.md` (11 tur po poprawkach). Tamte sprawdzają
konkretne commity; ten sprawdza, czy funkcja jest gotowa.

Zasady dowodowe są te same: pytania co do znaku, nowa rozmowa gdy plan tak
mówi, **Web włączony w każdej nowej rozmowie i po każdym reloadzie JS**
(przełącznik jest per rozmowa, w pamięci, domyślnie wyłączony), po turze log
(`Web search plan {…}` i `Web search outcome {…}` są JSON-em) i po serii
wyciąg bazy (`sourceDocuments[]`: `sourceQuery`, `read`, `used`, `passage`;
`groundingCaveats`; `content`). Bez dowodu tura jest "not graded".

## 1. Bramka wyjścia (release gate)

Liczby do ustalenia z zespołem; poniżej propozycja. Liczy się **na model**,
osobno dla modelu referencyjnego (Gemma 4 - 2B) i najsłabszego wspieranego.

| Metryka | Jak liczona | Próg |
|---|---|---|
| bramka: szuka, gdy trzeba | odsetek pytań z zestawu F (faktograficzne) z `needsSearch: true` | ≥ 90 % |
| bramka: nie szuka, gdy nie trzeba | odsetek pytań z zestawu C (rozmowa, recap, opinia, kod) z `needsSearch: false` | ≥ 90 % |
| zapytanie w języku rozmowy | `sourceQuery` w języku pytania (lub kod/nazwa własna) | ≥ 95 % |
| `expects` w języku użytkownika | z logu planu | ≥ 90 % |
| trafienie w źródło | co najmniej jedno `used: true` z `passage` zawierającym szukaną daną | ≥ 75 % na F |
| poprawna odpowiedź | dana z odpowiedzi = dana z `passage` | ≥ 70 % na F |
| **fabrykacja** | liczba/data w odpowiedzi, której nie ma w żadnym `passage` | **0** |
| odmowa mimo dowodu | "nie mam danych" gdy `passage` ma daną, po nudge'u nadal | ≤ 10 % |
| język odpowiedzi | = język pytania (po ewentualnym retry) | ≥ 95 % |
| artefakty w treści | `[Answers:`, `Źródło N`, tytuł strony jako "według …", `<think>` | **0** |
| trace po ponownym wejściu | tylko strony `read`/`used`, dokładnie tyle kroków, ile zapytań | 100 % |
| pusty ekran / crash / zawieszenie | dowolna tura | **0** |
| czas do pierwszego tokenu z szukaniem | mediana na Pixelu 10 | ≤ 45 s (do ustalenia) |

Zestaw F i C to 40 + 20 pytań z sekcji 3, oznaczonych w kolumnie "zestaw".

## 2. Matryca

Osie, które trzeba przeciąć. Nie każdą kombinację — sekcja 5 mówi, które.

**Rodzaj intencji** (`WEB_INTENT_KINDS`): `price`, `specs`, `comparison`,
`recommendation`, `news`, `date`, `fact`, `howto`, `place`, `person`, `event`,
`chat`. Każdy kind ma w sekcji 3 co najmniej trzy pytania w dwóch językach.

**Język pytania**: polski, angielski, niemiecki, hiszpański, ukraiński
(cyrylica — test filtra pisma), japoński (CJK — test tokenizacji
`questionTerms`, kotwic i `sharesLanguageWith`), plus trzy warianty
"brudne": polski bez ogonków, literówki w nazwie modelu, pytanie po polsku o
byt anglojęzyczny ("Ile kosztuje MacBook Air M4?"). Zasada projektu: **żadna
poprawka nie może być listą słów dla jednego języka** — jeśli test pada w
jednym języku, szukamy reguły strukturalnej.

**Model**: Gemma 4 - 2B (referencja), najsłabszy wspierany (Qwen 3 - 1.7B lub
co jest w hubie poniżej 2B), jeden "thinking" (Qwen 3 - 4B z Think) — bo
`<think>` zmienia parser odpowiedzi i układ bańki. Na każdym modelu przynajmniej
smoke (sekcja 5.1) i 10 tur z sekcji 3.

**Urządzenie**: Pixel 10 (16 GB, pełna ścieżka z embeddingami), telefon
z 6–8 GB (`isMemoryConstrained` → `lowMemory`, bez embeddingów, snippety),
iPhone (inne IME, inna klawiatura, `SUPPORTS_USER_ACTION_MENU` false).

**Sieć**: Wi-Fi, LTE, offline od początku, offline w trakcie szukania,
wolna sieć (throttling w Android Studio / Network Link Conditioner) —
timeouty pobierania stron i `timeout` w trace.

## 3. Zestaw pytań (jednoturowe)

Każde pytanie: nowa rozmowa, Web on. Kolumna "PASS gdy" jest mierzalna
z bazy/logu. Zestaw F = faktograficzne (bramka ma odpalić), C = rozmowa
(nie ma).

### 3.1 `price` (F)

| Pytanie | Język | PASS gdy |
|---|---|---|
| Ile kosztuje LG OLED65B65LA? | pl | `kind: price`, `expects` po polsku, `passage` z kwotą w zł, odpowiedź z tą kwotą, bez `figure` w caveats |
| How much is the Sony WH-1000XM6 in the UK? | en | kwota w GBP z `passage`; brak konwersji walut z głowy |
| Was kostet das iPhone 17 Pro in Deutschland? | de | kwota w EUR; odpowiedź po niemiecku |
| ¿Cuánto cuesta la PlayStation 5 Pro en España? | es | kwota w EUR |
| Скільки коштує Samsung Galaxy S26 в Україні? | uk | `sourceQuery` cyrylicą; strony cyrylicą nie odrzucone przez filtr pisma; kwota w грн |
| Ile kosztuje MacBook Air M4? | pl o bycie en | `sourceQuery` po polsku z kodem "M4"; jeśli polskie sklepy → zł; jeśli 0 wyników → w logu druga runda z kotwic ("MacBook Air M4 …") |
| ile kosztuje rtx 5080 na x-kom | pl, małe litery, site | `siteRestriction: x-kom.com.pl`, wyniki tylko z tej domeny |

### 3.2 `specs` (F)

| Pytanie | Język | PASS gdy |
|---|---|---|
| Jaką częstotliwość odświeżania ma Samsung QE65QN90D? | pl | `kind: specs`; jeśli runda 1 = 0 wyników, w `outcome.rounds[0].queries` jest zapytanie z kotwic; odpowiedź z Hz |
| What is the battery capacity of the Pixel 10? | en | liczba w mAh z `passage` |
| Wie viel wiegt das Steam Deck OLED? | de | gramy/kg z `passage`, odpowiedź po niemiecku |
| Jaka czestotliwosc odswiezania ma Samsung QE65QN90D? | pl bez ogonków | jak wyżej **i** odpowiedź po polsku — 4 IX odpowiedź przyszła po francusku bez nudge'a; jeśli się powtórzy, `detectQuestionLanguage` bez diakrytyków to fixture |

### 3.3 `comparison` (F)

| Pytanie | Język | PASS gdy |
|---|---|---|
| Porównaj kurs bitcoina i ethereum. | pl | dwa zapytania lub jedno z obiema nazwami; obie wartości w odpowiedzi z `passage`; brak nudge'a pokrycia albo nudge, który **dodaje** brakujący aspekt |
| Compare the Pixel 10 and iPhone 17 cameras. | en | co najmniej dwa źródła, dwa `used: true`, odpowiedź o obu |
| Was ist besser für Gaming: RTX 5070 oder RX 9070? | de | oba modele w `sourceQuery` |

### 3.4 `recommendation` (F)

| Pytanie | Język | PASS gdy |
|---|---|---|
| Jaki jest najlepszy telewizor OLED do salonu? | pl | odpowiedź nazywa model ze źródła; `dominantWebSource` lub cytat hostem |
| Which e-reader should I buy for reading in the sun? | en | konkretny model, nie lista cech |
| ¿Qué portátil me recomiendas para programar por menos de 1000 €? | es | model + cena z `passage`; cena ≤ 1000 |

### 3.5 `news`, `date`, `event` (F)

| Pytanie | Język | PASS gdy |
|---|---|---|
| Co się dziś dzieje w Sejmie? | pl | `kind: news`, źródło z datą dzisiejszą lub wczorajszą, odpowiedź bez "nie mam dostępu do bieżących" |
| Kiedy odbył się ostatni lot testowy Starship? | pl | `kind: date/event`, data w `passage` **i** w odpowiedzi; brak → nudge "claims silent" |
| When is the next Apple event? | en | data lub "not announced" ze źródła, nie z pamięci |
| Wann ist die nächste Bundestagswahl? | de | rok w zapytaniu zgodny z `regroundYears` (nie 2021) |
| いつ次のオリンピックが開催されますか？ | ja | `sourceQuery` po japońsku; strony japońskie; odpowiedź po japońsku |

### 3.6 `fact`, `person`, `place`, `howto` (F)

| Pytanie | Język | PASS gdy |
|---|---|---|
| Jaka jest populacja Warszawy? | pl | liczba z `passage`, bez odmowy "na podstawie kontekstu" |
| Who is the current prime minister of the United Kingdom? | en | osoba ze źródła, nie z pamięci modelu (pułapka na stale prior) |
| Kto jest prezesem NBP? | pl | `kind: person`, nazwisko z `passage` |
| Gdzie jest najbliższy urząd pocztowy w Krakowie i w jakich godzinach jest otwarty? | pl | `kind: place`; adres lub godziny z `passage` |
| Wie komme ich vom Flughafen München in die Innenstadt? | de | `kind: howto/place`; odpowiedź po niemiecku z opcją ze źródła |
| How do I reset a Fritz!Box 7590 to factory settings? | en | `kind: howto`; kroki ze źródła, kod modelu w `sourceQuery` |
| Jaki jest kurs euro do złotego? | pl | kurs z `passage` (NBP/bankier); jeśli `passage` bez kursu → not graded + zapis, że selektor nie wyciął liczby |

### 3.7 Zestaw C — bramka ma **nie** szukać

| Pytanie | Język | PASS gdy |
|---|---|---|
| Czego dotyczyła ta rozmowa? (po dowolnej turze) | pl | `needsSearch: false`, intent recap |
| Was the first answer you gave me in Polish? | en | bez szukania; odpowiedź zgodna z bazą |
| Napisz funkcję w Pythonie sortującą listę słowników po kluczu. | pl | bez szukania |
| Explain how transformers work in simple terms. | en | bez szukania (wiedza ogólna) |
| Dzięki, to wszystko. | pl | small talk, bez szukania, bez "Answered without searching" w bańce |
| Co sądzisz o pracy zdalnej? | pl | opinia, bez szukania |
| Przetłumacz "dobranoc" na niemiecki. | pl | bez szukania |
| Streść mi to: <wklejony akapit> | pl | bez szukania; odpowiedź o wklejonym tekście |
| Was ist 17 % von 2 350 €? | de | bez szukania (liczby ≥ 3 cyfr **nie** wymuszają szukania, gdy to arytmetyka — to test `hasHardSearchSignal`) |
| Which is bigger, 2^10 or 1000? | en | jak wyżej |

Ostatnie dwa są celowo na granicy: `hasHardSearchSignal` wymusza szukanie
przy tokenie z cyframi. Jeśli szuka — zapisz, to dane do decyzji, czy reguła
zostaje.

## 4. Rozmowy złożone

Każda rozmowa to jeden ciąg tur w **tej samej** rozmowie, Web on. Po każdej
turze zapis `sourceQuery`, po całości wyciąg bazy. Rozmowy R1–R4 na Gemmie i
na najsłabszym modelu; R5–R8 przynajmniej na Gemmie.

### R1 — referent i zawężanie (pl, 7 tur)

1. `Jaki jest najlepszy telewizor OLED do salonu?`
2. `Ile kosztuje?` → `sourceQuery` zawiera model z tury 1, **tylko** model (nic więcej z odpowiedzi nie wycieka), po polsku
3. `Jakie ma parametry techniczne?` → ten sam model
4. `Czy sprawdzi się w jasnym salonie z dużymi oknami?` → odpowiedź z kontekstu **lub** szukanie o tym modelu; bez zmiany modelu
5. `Znajdź tańszy model spełniający te wymagania.` → `sourceQuery` z "OLED" (kotwica tematu), odpowiedź nazywa **inny** model i cenę
6. `A który z tych dwóch ma lepszy HDR?` → oba modele w zapytaniu
7. `Czego dotyczyła ta rozmowa?` → bez szukania, streszczenie o telewizorach

PASS: 2/3/5/6 z właściwym podmiotem; 7 bez szukania. Znany słaby punkt:
tura 5 (S2.5 — "nie mogę wskazać" mimo strony z tańszymi modelami).

### R2 — zmiana tematu i powrót (pl, 6 tur)

1. `Ile kosztuje karnet dzienny w Zakopanem w sezonie 2026/27?`
2. `Jaka będzie tam pogoda w weekend?` → "tam" = Zakopane w zapytaniu
3. `A tak w ogóle, kto wygrał wczoraj mecz Legii?` → zmiana tematu; zapytanie **bez** Zakopanego
4. `Wracając do karnetu — czy dzieci mają zniżkę?` → powrót: zapytanie z Zakopanem/karnetem, nie z Legią
5. `Ile to wszystko wyjdzie dla rodziny 2+2 na 3 dni?` → arytmetyka z danych z tur 1 i 4; jeśli szuka, zapytanie o cennik, nie o "rodzinę 2+2"; **żadnej kwoty spoza `passage`**
6. `Podsumuj, co ustaliliśmy.` → bez szukania

### R3 — zmiana języka w trakcie (pl → en → de → pl, 6 tur)

1. `Jaka jest populacja Warszawy?` (pl)
2. `And Berlin?` (en) → `sourceQuery` po angielsku ("Berlin population"), odpowiedź po angielsku
3. `Und Wien?` (de) → po niemiecku
4. `Które z tych trzech miast jest największe?` (pl) → bez szukania lub szukanie; odpowiedź po polsku z liczbami z poprzednich tur
5. `Was your second answer in English?` (en) → bez szukania, "yes"
6. `Dzięki.` → small talk

PASS: język `sourceQuery` = język **bieżącej** tury (`languageReferenceFor`
bierze ostatnią wiadomość, nie całą rozmowę); język odpowiedzi = język tury;
żadnego "Refining…" pętli (max jeden retry na turę).

### R4 — wieloaspektowe i wieloczęściowe (pl, 4 tury)

1. `Wypisz funkcje, parametry techniczne i wady Samsunga QE65S99H.` → 3 aspekty; jeśli draft ma 1, nudge pokrycia; **finalna nie krótsza niż draft** (S3.2)
2. `Podaj cenę iPhone 17 Pro w złotych i w euro.` → dwa zapytania; obie waluty z `passage` lub jawne "brak źródła dla EUR"; brak `[Answers:`
3. `Porównaj go z Galaxy S26 Ultra pod kątem aparatu, baterii i ceny.` → "go" = iPhone 17 Pro; 3 aspekty
4. `Który byś wybrał i dlaczego?` → bez szukania lub szukanie; uzasadnienie z danych z tur 2–3

### R5 — długa rozmowa pod presją okna (pl, 15+ tur)

Okno kontekstu to 2048 tokenów i **nie zmienia się**. Cel: sprawdzić digest
(`chatSettings.digest`), `carryReferentIntoQuery` z digestu i to, czy po
15 turach zapytania nadal trafiają w temat.

Skrypt: R1 (7 tur) + R2 (6 tur) w jednej rozmowie + 3 tury:
15. `Wróćmy do telewizora — jaki to był model?` → bez szukania, model z tury 1 (digest)
16. `Ile kosztował?` → zapytanie z tym modelem
17. `Czego dotyczyła ta rozmowa?` → oba wątki w streszczeniu

Do zapisu: `digest` z bazy po turze 8 i 16; `[prompt-tokens]` z logu
(czy prompt zmieścił się bez `budgetScale: 0.5`); TTFT na turze 16 vs 2.

### R6 — dokument + web (pl, 4 tury)

1. Załącz PDF (np. instrukcja obsługi) i zapytaj: `Jak zresetować to urządzenie?` → RAG z dokumentu, web **nie** startuje (`RAG_PRIORITY_OVER_WEB_SEARCH`), toast "Using your documents…"
2. `Ile kosztuje nowy model tego urządzenia?` → tu web powinien mieć sens; zapisz, co się dzieje (priorytet dokumentu blokuje?) — **decyzja produktowa do podjęcia**
3. Usuń dokument z rozmowy (jeśli UI pozwala) i powtórz 2.
4. `Czego dotyczyła ta rozmowa?`

### R7 — obraz + web (pl, 3 tury; model z wizją)

1. Zdjęcie tabliczki znamionowej urządzenia + `Co to za model?` → bez web (obraz)
2. `Ile kosztuje?` → web z nazwą modelu rozpoznaną z obrazu, jeśli model wizyjny ją podał
3. `Gdzie kupić najtaniej?` → `kind: price/place`

### R8 — użytkownik poprawia asystenta (pl, 4 tury)

1. `Kto jest prezesem NBP?`
2. `To nieprawda, sprawdź jeszcze raz.` → ponowne szukanie; zapytanie **inne** niż w turze 1 (rekonstrukcja albo inna fraza), nie dosłowne "to nieprawda sprawdź jeszcze raz"
3. `A od kiedy?` → `kind: date`, referent = ta osoba
4. `Ok, dzięki.`

## 5. Warunki brzegowe i nieszczęśliwe ścieżki

### 5.1 Smoke (30 minut, każdy model, każde urządzenie)

Jedna rozmowa: 3.1 wiersz 1, 3.6 wiersz 1, 3.7 wiersz 1, R1 tury 1–2. Do
tego: przycisk Stop w trakcie szukania (trace ma "stopped", brak pustej
bańki, brak zawieszonego `isSearchingWeb`), Stop w trakcie generacji, wyjście
z rozmowy i powrót w trakcie generacji (`generatingForChatId` — odpowiedź
ląduje w tej rozmowie), przełączenie modelu w trakcie szukania.

### 5.2 Sieć

| Scenariusz | PASS gdy |
|---|---|
| tryb samolotowy przed wysłaniem | trace "No internet — answered without the web", odpowiedź bez odmowy "nie mam internetu" w treści, `telemetry.skippedReason: offline` |
| sieć znika w trakcie czytania stron | `fetchFailures` w outcome, trace z notą o błędach, odpowiedź z tego, co było |
| wolna sieć (200 ms RTT, 1 Mb/s) | `timeout` w trace najpóźniej po limicie; TTFT do zapisu |
| wyszukiwarka zwraca 0 wyników (np. zapytanie z losowym ciągiem `Ile kosztuje QZX-99817-B?`) | `outcome.rounds[0]` ma zapytanie z kotwic; jeśli nadal 0 — odpowiedź uczciwa, trace bez "Reading the pages" |
| wszystkie strony 403/paywall (pytanie o artykuł z wyborcza.pl) | `fetchFailures` z `host:reason`, `recovery` w telemetrii, odpowiedź ze snippetów albo uczciwa odmowa |
| strona-olbrzym (Wikipedia "Polska") | brak zawieszenia UI, pobranie w limicie, `passage` ≤ budżet |
| strony innym pismem dla pytania łacińskiego (pytanie po polsku, wyniki z .ru) | filtr pisma zostawia ≥ `WEB_MIN_SAME_SCRIPT_RESULTS` łacińskich |

### 5.3 Pamięć

Telefon 6–8 GB lub Pixel z dużym modelem (Qwen 3 - 8B): `lowMemory` →
bez embeddingów, `retrieval: null`, toast "Not enough memory…" gdy model za
duży. PASS: żadnego OOM/crashu przy szukaniu z załadowanym modelem, jakość
odpowiedzi ze snippetów zapisana osobno (to inna ścieżka rankingu).

Do tego jeden przypadek z 4 IX na Pixelu 10: po trzech reloadach JS (Fast
Refresh) z załadowaną Gemmą i modelem embeddingowym system zabił aplikację
**na pierwszym planie** z powodem `LOW_MEMORY` (`dumpsys activity exit-info`,
`importance=100`). Do sprawdzenia w tej rundzie bez reloadów: czy 30 minut
szukania w jednej sesji nie rośnie w RSS (`dumpsys meminfo
com.swmansion.privatemind` co 5 tur) — ostrzeżenie "synchronous unload on
TextEmbeddingsModule" pojawia się przy każdym szukaniu.

### 5.4 UI w trakcie szukania i generacji (Pixel + iPhone)

Nagranie `screen-recording` na każdą pozycję, 5 powtórzeń tam, gdzie
"stabilnie":

| Co | PASS gdy |
|---|---|
| pierwszy token | nazwa modelu stoi od początku tury, "Thinking…" znika w miejscu, w którym zaczyna się odpowiedź; nic nad odpowiedzią nie skacze — **5/5** |
| pierwsza linia widoczna | pierwsza linia odpowiedzi w całości pod nagłówkiem, nie pod paskiem — **5/5**, także po wysyłce z dołu długiej rozmowy z otwartą klawiaturą |
| trace na żywo | "Deciding…" → "Searching …" (po jednym na zapytanie) → "Reading the pages" → "Done"/"Didn't find much"; rozwijanie w trakcie bez skoku listy |
| "Refining…" | draft stoi, etykieta pod nim, przenikanie, bez pustego kadru |
| klawiatura | po wysłaniu pasek schodzi razem z klawiaturą; po powrocie z tła / share sheet / dialogu uprawnień pasek **nie** wisi na wysokości klawiatury (bug z 4 IX, otwarty) |
| przycisk Web | stan widoczny przed wysyłką; po reloadzie JS wraca do off — **decyzja produktowa**: czy ma pamiętać wybór między rozmowami |
| badge / Sources | "Searched the web" ↔ arkusz Sources z tymi samymi stronami; host, nie tytuł, jako nazwa |
| ponowne wejście do rozmowy | trace z bazy: kroki = zapytania, strony = `read`/`used`, bez animacji wejścia |
| pusta bańka / biały ekran | nigdy (bug "conversation goes blank" — kapturowanie opisane w STATUS) |

## 6. Co da się zautomatyzować, a co zostaje ręczne

**Offline, w jest (do zrobienia przed rundą):**

- Golden set planera: 60 pytań z sekcji 3 → oczekiwane `needsSearch`,
  `kind`, język `sourceQuery`. Odtwarzany z zapisanych odpowiedzi planera
  (surowy JSON z logu `Web search plan` — trzeba dodać zapis surowego tekstu
  planera pod `__DEV__`, dziś logujemy tylko sparsowany plan). Wynik: tabela
  pass/fail na model bez urządzenia.
- Fixtures z realnych `passage` z bazy (S1.7 pogoda Onet, S1.8 Zakopane,
  S3.2 MediaExpert, S2.5 "najtańsze OLED") → `claimsMissingEvidenceItHas`,
  `aspectsMissingFromAnswer`, `groundingCaveats` — każde znalezisko z rundy
  urządzeniowej kończy się fixture'em.
- Zero-result i fetch-failure: `MockProvider` z pustą mapą / stronami 403 →
  rundy ratunkowe, trace, telemetria.

**Na urządzeniu, powtarzalnie (Argent):**

- `argent-qa-flows`: sekcja 5.4 jako nagrane przepływy z kryteriami
  (pierwszy token, trace, ponowne wejście) — uruchamiane po każdej zmianie w
  `MessageItem`/`Messages`/`WebSearchBlock`.
- Nocna runda na Pixelu: 5.1 smoke + 10 pytań z sekcji 3 na Gemmie, wynik
  do `docs/test-evidence/<data>/` (baza + log). Skrypt: ten sam prompt co
  `WEAK_MODEL_TEST_PROMPT.md`, zestaw pytań z tego pliku.

**Ręcznie (model testujący lub człowiek):** rozmowy R1–R8, języki inne niż
pl/en (wpisywanie diakrytyków/CJK przez Argent jest bolesne — patrz notatka
o Gboard w wynikach), sieć i pamięć, iPhone.

## 7. Kolejność i czas

| Etap | Zakres | Czas | Kiedy |
|---|---|---|---|
| 0 | golden set planera + fixtures z rundy 4 IX w jest | 1 dzień dev | przed rundą |
| 1 | smoke 5.1 na 3 modelach × Pixel | 1,5 h | dzień 1 |
| 2 | sekcja 3 (60 pytań) na Gemmie | 4 h | dzień 1–2 |
| 3 | sekcja 3 podzbiór 20 pytań na najsłabszym modelu i na thinking | 3 h | dzień 2 |
| 4 | rozmowy R1–R8 na Gemmie, R1–R4 na najsłabszym | 4 h | dzień 3 |
| 5 | sieć, pamięć, UI 5.2–5.4 | 3 h | dzień 3–4 |
| 6 | iPhone: smoke + 5.4 + R3 | 2 h | dzień 4 |
| 7 | zebranie metryk z sekcji 1, decyzja go/no-go, fixtures z każdego FAIL | 0,5 dnia | dzień 5 |

Każdy FAIL z etapów 2–6 dostaje wpis w `WEB_SEARCH_RAG_STATUS.md`
(mechanizm, nie objaw) i fixture w jest, zanim wróci do kolejnej rundy —
inaczej regresje wracają, co ten branch już przerabiał trzy razy (trace po
przełączeniu rozmowy, etykiety w treści, pasek klawiatury).

## 8. Otwarte decyzje przed rundą

1. Czy przełącznik Web ma pamiętać wybór między rozmowami (dziś: per
   rozmowa, w pamięci, off). Runda 4 IX straciła przez to 7 z 11 tur; realny
   użytkownik straci tak samo.
2. Czy `hasHardSearchSignal` (token z cyframi ≥ 3) ma wymuszać szukanie przy
   arytmetyce (3.7, dwa ostatnie wiersze).
3. Priorytet dokumentu nad web (R6 tura 2): blokada czy łączenie.
4. Progi z sekcji 1 — propozycja wyżej, do zatwierdzenia.
