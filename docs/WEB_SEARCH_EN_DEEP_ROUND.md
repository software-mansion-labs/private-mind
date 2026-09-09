# Głęboka runda angielska — co znalazła i czego nie

Angielski to najczęstszy język użytkowników (41 % ruchu), więc runda celowo
pomija wielojęzyczność i sprawdza jedną rzecz do dna: czy odpowiedź, którą
widzi użytkownik, zawiera to, co strona naprawdę napisała.

**Zestaw.** 46 pytań w 11 kategoriach — `define`, `place`, `spec`, `stat`,
`price`, `hours`, `date`, `compare`, `steps`, `list`, plus dwa pytania
`absent` o rzeczy, które nie istnieją, i cztery `current`, oceniane ręcznie,
bo ich odpowiedź zmienia się w czasie. Każde pytanie ma listę markerów
(wyrażeń regularnych) i próg, ile z nich musi paść, żeby uznać odpowiedź za
trafną. Markery są celowo pobłażliwe wobec formy, a wymagające wobec treści:
„how tall is the Burj Khalifa" zalicza `828`, nie zalicza opisu wieży.

## Jak w ogóle widać, co się dzieje

Build release usuwa każde `console.*` (`transform-remove-console` w
`babel.config.js`), więc logcat nie mówi nic. Runda opiera się na dwóch
plikach zapisywanych przez samą aplikację, za flagą `WEB_TRACE_TO_FILE`
(w repozytorium **wyłączoną**; test w `webSearchTrace.test.ts` tego pilnuje):

- `utils/web/searchTrace.ts` — każdy adres z SERP-a, tekst strony **przed**
  retrievalem, tekst **po** nim, budżet, offset, zapytania planera i finalny
  kontekst;
- `utils/answerTrace.ts` — surowa odpowiedź modelu, odpowiedź po `tidy`,
  wszystkie ponowienia i kształt tury (`generating`, `dangling`, `nudged`).

Ślady lądują w `ExternalDirectoryPath`, czyli `/sdcard/Android/data/<pkg>/files`,
skąd `adb` czyta je bez `run-as`. Dzięki temu, że ślad zawiera budżet i offset,
`webResultsToContext` odtwarza kontekst z urządzenia **co do bajtu** — 53 z 53
wyszukiwań — więc każdą zmianę w selekcji można zmierzyć offline, bez telefonu.

## Defekty i poprawki

| commit    | objaw na urządzeniu                                                                      | mechanizm                                                                                                                                                                             | dowód                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `83fe8c0` | „How tall is the Burj Khalifa" → **„8 meters (2,722 ft)"**                               | `splitIntoPassages` traktowało `.` w `829.8` jak koniec zdania, a wybrane pasaże są sklejane spacją                                                                                   | 7 z 82 wyszukiwań miało rozbite liczby; test regresyjny pokazuje **wysokość, której strona nigdy nie podała** — `585. 7 m`, złożoną z etykiety jednego wiersza i wartości drugiego               |
| `683132b` | brak — defekt strukturalny                                                               | prompt to 3312 znaków instrukcji na 1674 znaki dowodów; przy oknie 2048 tokenów model czyta dwa słowa polecenia na jedno słowo treści                                                 | te same reguły krócej: prompt systemowy 3066 → 2218 znaków; `ASSEMBLED_INSTRUCTION_CHARS` 3000 → 2500, więc oszczędność trafia do kontekstu: +23 % kontekstu, tekst stron 26,6 % → 32,5 %        |
| `07baf71` | „How do you make a soft boiled egg" gubi czas gotowania                                  | budżet dzielony wyłącznie po randze SERP: pierwsza pozycja dostawała 682 znaki na stronę, która się **nie pobrała**, a strona z całą metodą w 495 znakach dostawała 300               | budżet rozlewany do zapotrzebowania strony, krzywa rangi `1/√(rank+1)`; markery przeżywające selekcję 40/47 → 43/47                                                                              |
| `a5c605d` | „opening hours of the Museum of Imaginary Instruments" → **godziny Museum of Illusions** | reguła wykrywała brak podmiotu i dopisywała instrukcję, którą model 2B ignorował                                                                                                      | decyzja zamiast instrukcji: brak podmiotu = wyszukiwanie bez wyników; precyzja 2 trafienia na 82 ślady, 0 fałszywych, 0 odpaleń na 54 pytaniach w 9 językach                                     |
| `8b4651c` | godziny British Museum, sześć gazów szlachetnych, składniki margarity                    | **17 % pobranych stron (27/161)** trafiało do modelu puste, bo żaden ich fragment nie przeszedł progu podobieństwa; 22 z nich miały odpowiedź                                         | strona zachowuje swój najlepszy fragment, o ile dzieli z pytaniem choć jedno słowo                                                                                                               |
| `68bb02d` | „soft boiled egg" — model wypisuje trzy kroki i milknie                                  | z metody wypadło **jedno zdanie**: „Cook for 4-6 minutes", jedyne, które nie powtarza żadnego słowa z pytania, więc dostało zero punktów, choć zdania po obu stronach zostały wybrane | pasaż między dwoma wybranymi pasażami jest brany też; dziury wypełniane od najmocniejszych sąsiadów, bo w kolejności dokumentu miejsce zjadała klauzula „nasze treści mają charakter edukacyjny" |
| `441c3ce` | „What time does the Louvre open" → **„The museum is open until 1 hour before closing"**  | ta sama przyczyna, ale tabela godzin to dziewięć krótkich wierszy, więc luka między wybranymi pasażami była dziewięciokrotna i mostek jednopasażowy jej nie sięgał                    | cała seria wypadniętych pasaży brana razem, budżet mostka 200 → 320 znaków; na wejściach z rundy 21 → 23 pytania z odpowiedzią w jednym bloku, zero strat                                        |

## Wynik na urządzeniu

Pixel 10, Gemma 4 – 2B, build z commitami do `65d7aa9` (bez `441c3ce`, który
powstał z traceʼów tej rundy). Poprzednia runda: **25/42 = 60 %**. Ta:
**30/42 = 71 %**. Sparowane pytanie po pytaniu: **+8, −3, 31 bez zmian**.

| kategoria               | poprzednio | teraz   |
| ----------------------- | ---------- | ------- |
| `place`, `spec`, `stat` | 4/4        | 4/4     |
| `date`                  | 2/4        | 3/4     |
| `hours`                 | 3/4        | 3/4     |
| `define`                | 4/4        | 3/4     |
| `price`                 | 3/4        | 3/4     |
| `list`                  | **0/4**    | **3/4** |
| `absent`                | **0/2**    | **1/2** |
| `steps`                 | 1/4        | 1/4     |
| `compare`               | 1/4        | 1/4     |

Cztery pytania `current` ocenione ręcznie, wszystkie trafne i tym razem
jednoznaczne — poprzednio jedno odpowiadało „Starmer/Burnham", teraz samym
nazwiskiem.

**Co się zmieniło w odpowiedziach:**

| pytanie                         | przed                                                        | teraz                                                                                                     | commit                |
| ------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------- |
| Burj Khalifa                    | „8 meters (2,722 ft)"                                        | „828 metres (2,717 ft)"                                                                                   | `83fe8c0`             |
| British Museum                  | „I do not have the specific opening hours"                   | „Daily: 10:00 to 17:00"                                                                                   | `8b4651c`             |
| Museum of Imaginary Instruments | „The opening hours are Monday-Sunday 10:00-19:00"            | „I do not have verified current information regarding…"                                                   | `a5c605d`             |
| full English breakfast          | „everyday ingredients that can be cooked in one or two pans" | „Eggs, Bacon, Sausages, Baked beans"                                                                      | `683132b` + `07baf71` |
| margarita                       | „are three ingredients"                                      | „tequila, orange liqueur (typically Cointreau or triple sec), and fresh lime juice"                       | jw.                   |
| Greek salad                     | „ingredients that stay true to the traditional Greek salad"  | „tomato, sliced cucumber, green pepper, sliced red onion, Kalamata olives"                                | jw.                   |
| cold brew                       | „the detailed steps… are not included"                       | „Steep and refrigerate for 16 hours. Strain through a fine-mesh sieve and a coffee filter or cheesecloth" | jw.                   |

**Trzy straty i co je spowodowało:**

- **Louvre** i **rower** — inne strony z SERP-a, nie regres kodu. Sprawdzone
  przez przepuszczenie **poprzednich** wejść przez dzisiejszy kod: Louvre nadal
  daje „9:00 am to 6:00 pm". Słabsza strona odsłoniła za to dziurę w selekcji,
  którą naprawia `441c3ce`.
- **quantitative easing** — model skrócił do „an unconventional monetary
  policy". Prawda, ale bez treści, której wymaga próg.

**Co runda rozstrzygnęła o granicy modelu.** Jajko na miękko jest teraz
dowodem, że wyszukiwanie zrobiło swoje: kontekst zawiera „Cook for 4–6
minutes" i „ice bath", a model wypisuje trzy kroki i milknie. Druga
fabrykacja (iPhone 19) też nie jest już problemem wyszukiwania — strony
faktycznie **nazywają** „iPhone" i „Pro Max", więc reguła nienazwanego
podmiotu słusznie nie odpala; to strony wymyślone dla telefonu, który nie
istnieje.

## Zmierzone i odrzucone

Wyniki negatywne są tu po to, żeby nikt nie powtarzał tej pracy.

- **„Przyszła data = produkt nie istnieje".** Strony o iPhone 19 piszą „is
  expected to be released on September 2027". Detektor „rok > bieżący przy
  intencji `price`/`specs`" odpala na 5 pytaniach z 46 i trafia w 1. Fałszywe
  trafienia to `spec-1` (rok 2030) i `spec-3` (rok 2064) — obie odpowiedzi
  **poprawne**, bo strony specyfikacji rutynowo podają odległe daty.
- **Kara dla pasażu powtarzającego pytanie.** Hipoteza była taka, że zdanie SEO
  („the ingredients needed to make a Full English Breakfast") wygrywa
  rankingiem, bo ma komplet igieł przy zerowej treści. Odebranie mu
  `LEAD_BONUS` nie zmieniło **niczego**: 43/47 przed i po. Blurb nie wygrywa
  rankingiem — on po prostu stoi wyżej w dokumencie, a pasaże są emitowane w
  kolejności dokumentu.
- **Przestawianie pasaży wg wyniku.** Działa na metryce pozycji (mediana
  offsetu pierwszego markera 362 → 288 przy niezmienionym recall), ale wsuwa
  śmieciowy fragment **pomiędzy krok 2 i krok 3 procedury**. Wariant
  zachowujący ciągłe serie daje 302 bez tego ryzyka i czeka na walidację.
- **Kolejność bloków wg tego, jak dobrze odpowiadają.** 84 % odpowiedzi
  pokrywa się najbardziej z blokiem 1, a blok 1 sam zawiera odpowiedź w 33
  przypadkach na 47, podczas gdy jakiś blok ją ma w 43. Wyglądało to na
  dziesięć pytań do odzyskania. Nie jest: ranking po najlepszym pasażu daje
  35/47, a spójna wersja, w której i budżet, i kolejność idą za tym rankingiem,
  daje 33/47 i **gorszy** recall. Ranking wyszukiwarki jest lepszym predyktorem
  tego, która strona odpowiada, niż nasz własny scoring pasaży.
- **Uprzedzenie retrievalu do początku strony.** Wybrany fragment zaczyna się w
  pierwszych 20 % strony w 34 przypadkach na 40 — ale marker odpowiedzi też
  leży w pierwszych 20 % w 35 przypadkach na 38. To nie jest błąd.

## Co zostaje otwarte

- **Synteza z dwóch źródeł.** „How do I factory reset a Nintendo Switch":
  wikiHow ma „system settings menu", thetechgorilla ma „Select Initialize
  Console", żaden blok nie ma obu. Model odpowiada z jednego.
- **Kroki pod długim wstępem.** Na stronach how-to retrieval wybiera akapit
  wprowadzający („a factory reset wipes the console…"), bo to on jest podobny
  do pytania, a numerowane kroki leżą 5000 znaków niżej.
- **`intentKind` planera zawodzi mniej więcej w jednej czwartej procedur** —
  „What are the six noble gases" wychodzi jako `fact`, nie `howto`. Bramki
  oparte na kategorii pytania mają tam dziurę; sygnał lokalny (kształt
  pasażu) jest pewniejszy.
