# Web search w dziewięciu językach

Runda 3. Poprzednia runda (`DEVICE_SMOKE_TEST_RESULTS_R2.md`) próbkowała języki
po jednym pytaniu i nie dało się z niej wyciągnąć wniosku mocniejszego niż
„czasem działa". Ta runda jest zaprojektowana tak, żeby wynik dało się czytać
jako macierz.

## Co zmierzono

**54 pytania: 9 języków × 6 kategorii**, każde w nowej rozmowie, z włączonym
web search, na tym samym modelu i tym samym urządzeniu.

|                                    |                                               |
| ---------------------------------- | --------------------------------------------- |
| urządzenie                         | Pixel 10 (`56211FDCR005KT`), Android 16       |
| model                              | Gemma 4 - 2B                                  |
| build bazowy                       | `versionCode=68`, bez poprawek z tej rundy    |
| języki                             | en, hi (Hinglish), de, es, fr, pt, it, tr, id |
| mediana czasu odpowiedzi           | 112 s                                         |
| komórki z faktycznym wyszukiwaniem | 54 / 54                                       |
| błędy narzędziowe                  | 0                                             |

Sześć kategorii jest wspólnych dla wszystkich języków, żeby dało się je
porównywać, i każda celuje w inne ryzyko:

| kategoria  | pytanie testowe                  | co sprawdza                                                  |
| ---------- | -------------------------------- | ------------------------------------------------------------ |
| population | liczba mieszkańców dużego miasta | trafienie w źródło z właściwego regionu, wyciągnięcie liczby |
| price      | cena iPhone 17 w danym kraju     | lokalna waluta i jej zapis                                   |
| weather    | pogoda dziś w stolicy            | strony renderowane JavaScriptem                              |
| current    | kto obecnie sprawuje urząd       | odróżnienie stanu bieżącego od listy historycznej            |
| list       | składniki dania narodowego       | czy wyliczanka dociera do modelu                             |
| hours      | godziny otwarcia zabytku         | konkret praktyczny, łatwy do zweryfikowania                  |

### Czego ta runda nie mierzy

- **Pisma niełacińskie w ogóle nie zostały dotknięte.** `adb shell input text`
  jest ASCII-only, `cmd clipboard` nie istnieje na tym Androidzie, a aplikacja
  nie ma odbiornika `ACTION_SEND`. Sprawdziłem wszystkie trzy drogi. To wyklucza
  hi (devanagari), ur, ar, ru, zh, fa — **około 27 % użytkowników**. Hinglish
  jest tu proxy dla hindi, a nie jego zamiennikiem.
- **Diakrytyki są zjadane przez stanowisko**, nie przez aplikację: „Muenchen"
  zamiast „München", „Espana" zamiast „España". To realny sposób pisania na
  telefonie, ale nie jedyny.
- **Jeden model, jedno urządzenie, jeden przebieg na komórkę.** Pojedyncza
  komórka to obserwacja, nie statystyka; wzorzec powtarzający się w dziewięciu
  językach to już coś więcej.

## Wynik

**25 dobrych, 14 słabych, 15 złych** na 54.

„Słaba" to odpowiedź, którą użytkownik dostanie i częściowo z niej skorzysta —
prawidłowa liczba w złym języku, trzy z czterech składników, pogoda bez
temperatury. „Zła" to odpowiedź bezużyteczna albo myląca.

| język | population | price   | weather | current | list    | hours   |
| ----- | ---------- | ------- | ------- | ------- | ------- | ------- |
| en    | dobra      | dobra   | dobra   | **zła** | **zła** | **zła** |
| hi    | dobra      | dobra   | słaba   | dobra   | **zła** | dobra   |
| de    | słaba      | dobra   | **zła** | **zła** | słaba   | **zła** |
| es    | dobra      | słaba   | słaba   | dobra   | **zła** | dobra   |
| fr    | dobra      | dobra   | **zła** | dobra   | dobra   | słaba   |
| pt    | dobra      | **zła** | dobra   | słaba   | **zła** | dobra   |
| it    | słaba      | słaba   | dobra   | **zła** | słaba   | dobra   |
| tr    | słaba      | **zła** | dobra   | dobra   | dobra   | dobra   |
| id    | **zła**    | słaba   | słaba   | **zła** | słaba   | dobra   |

Czytane po kolumnach:

| kategoria  | dobre | słabe | złe   |
| ---------- | ----- | ----- | ----- |
| hours      | 6     | 1     | 2     |
| population | 5     | 3     | 1     |
| price      | 4     | 3     | 2     |
| weather    | 4     | 3     | 2     |
| current    | 4     | 1     | **4** |
| list       | 2     | 3     | **4** |

## Pięć wniosków

### 1. Dwie najgorsze kategorie sypią się także po angielsku

`list` i `current` to najsłabsze kolumny — i angielski nie wypada w nich lepiej
niż reszta. Po angielsku „What are the ingredients for a full English breakfast"
dostało **„the ingredients are not detailed in the provided sources"**, a
„What are the opening hours of the British Museum" — „I do not have the specific
opening hours", przy źródle o tytule _british museum hours of operation_.

To znaczy, że wielojęzyczność nie jest tu główną zmienną. Gdyby patrzeć tylko na
angielski, te same dwie dziury byłyby widoczne.

### 2. Wyliczanka ginie, zanim ktokolwiek ją oceni

Jedyne dwie poprawne listy składników w całej baterii — francuska quiche
lorraine i turecka zupa z soczewicy — pochodziły ze stron podających **ilości**
(„12 tranches de bacon", „1 su bardağı kırmızı mercimek"). Wszystkie pozostałe
siedem języków dostało prozę.

Przyczyna jest w ekstrakcji treści, nie w punktacji fragmentów. Filtr usuwający
paski nawigacji kasuje każdy ciąg ośmiu i więcej krótkich linii bez cyfr — czyli
dokładnie listę składników zapisaną bez ilości: „Zwiebeln, Butter, Sahne, Salz".
Lista z ilościami przeżywa, bo ma cyfry. Lista bez ilości jest usuwana z tekstu,
zanim model ją zobaczy.

### 3. „Kto teraz sprawuje urząd" prawie nigdy nie kończy się nazwiskiem

Cztery z dziewięciu odpowiedzi są złe, a tryby awarii są różne i wszystkie
prowadzą do tego samego:

| język | co wróciło                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------- |
| it    | **Fernando Tambroni** — premier Włoch w 1960 roku, wzięty z wikipedycznej listy wszystkich premierów |
| en    | nazwisko z listy „UK Prime Ministers in Order (1721-2026): All 59"                                   |
| de    | opis obowiązków **wicekanclerza** w zakresie informowania opinii publicznej                          |
| pt    | „39. prezydent od 1 stycznia 2023, z PT" — bez imienia i nazwiska                                    |
| id    | „nie mam informacji, kto jest prezydentem" — przy źródle _8 Urutan Presiden Indonesia_               |

Cztery z pięciu tych przypadków mają w źródłach listę historyczną. Piąty (de)
trafił w artykuł o samym urzędzie.

### 4. Kiedy detekcja języka zawiedzie, odpowiedź wraca po angielsku

Trzy komórki odpowiedziały po angielsku na pytanie zadane w innym języku:
`de/population`, `it/population`, `it/price`. To dokładnie te pytania, dla
których detektor języka nie zwrócił nic.

Zmierzone offline na tych samych 54 pytaniach: przed poprawką detektor nazywał
język w **40** przypadkach, po poprawce w **43**. Pozostałe 11 to głównie
Hinglish (6), którego żadna lista słów nie obejmuje.

### 5. Dwie ceny wyszły z błędem rzędu wielkości i nikt tego nie sprawdził

| język | odpowiedź       | co jest nie tak                             |
| ----- | --------------- | ------------------------------------------- |
| tr    | „3966 TRY"      | rząd wielkości za mało; prawdopodobnie rata |
| id    | „Rp17,249 juta" | 17 249 milionów rupii, czyli 17 miliardów   |

Weryfikacja liczb w obu przypadkach milczała, bo parser walut nie rozpoznawał
ani `₺`, ani kodu `TRY`, ani prefiksu `Rp`. Znał sześć symboli walut i tylko
zapis „symbol przed kwotą" albo „kod ISO po kwocie" — czyli ani „949,00 €", ani
„74.999 ₺", ani „R$ 7.499,00". Sprawdzone na dziewięciu lokalizacjach: **cztery
parsowały się, pięć nie**.

## Co naprawiono

Dziewięć poprawek. Żadna nie dokłada listy słów per język — wszystkie są albo
notacyjne (zapis liczb, walut, godzin, ASCII-owy zapis diakrytyków), albo
opierają się o klasyfikację planera, który czyta pytanie w dowolnym języku.

| #   | commit    | co naprawia                                                                                    | pomiar                                       |
| --- | --------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | `f84d603` | detekcja języka: odmiana wyrazu, ASCII-owy zapis umlautów, remis rozstrzygany dłuższym dowodem | 40/54 → 43/54                                |
| 2   | `c02eb1c` | waluty: symbol po kwocie, cała klasa `\p{Sc}`, kody ISO rynków aplikacji, cyfry rodzime        | 4/9 → 9/9 lokalizacji                        |
| 3   | `0f4e369` | liczby porównywane wartością, nie napisem                                                      | „9,188,200" = „9.188.200"; „10:00" = „10.00" |
| 4   | `cd98431` | premia za wyliczankę uzbrajana przez `kind: howto` z planu                                     | dowolny język                                |
| 5   | `8c9f151` | instrukcje kształtu odpowiedzi uzbrajane z planu                                               | de: 0/3 → 2/3, tr: 0/3 → 2/3                 |
| 6   | `0537cd8` | lista historyczna rozpoznawana po roku w tytule                                                | „seit 1949", „desde 1889"                    |
| 7   | `45e915a` | filtr menu przestaje kasować listy składników bez ilości                                       | rozróżnia po linkach                         |
| 8   | `ba15f59` | pytanie o urząd ma być odpowiedziane nazwiskiem                                                | dotyczy wszystkich języków                   |
| 9   | `bae32d4` | zapasowa instrukcja językowa mówi wprost: nierozpoznany ≠ angielski                            | dotyczy 11 pytań bez detekcji                |

### Pomiar, który uzasadnia poprawki 4, 5 i 6

Przed zmianą instrukcje sterujące kształtem odpowiedzi były zamknięte za
regexami polskich i angielskich słów. Zmierzone przez zbudowanie promptu dla
pytań z baterii:

| pytanie    | przed   | po            |
| ---------- | ------- | ------------- |
| de/current | —       | current-state |
| de/list    | —       | procedure     |
| tr/current | —       | current-state |
| tr/list    | —       | procedure     |
| id/list    | —       | procedure     |
| es/current | —       | current-state |
| en, pl     | komplet | komplet       |

Niemiecki, turecki i indonezyjski użytkownik nie dostawał **żadnej** z tych
instrukcji. Hiszpański, francuski, włoski i portugalski dostawały jedną, i to
przypadkiem — słowo „ingredient" ma wspólny rdzeń łaciński.

## Weryfikacja po poprawkach

Ten sam telefon, ten sam model, build z kompletem dziewięciu poprawek,
19 pytań: wszystkie dziewięć komórek `current`, wszystkie dziewięć `list`
oraz `de/population`. Jeden przebieg na komórkę, zero usterek narzędziowych.

### Czego ta weryfikacja nie ustala

**Nie sprawdzam, czy nazwisko jest prawdziwe.** Nie mam niezależnego źródła
prawdy na wrzesień 2026, więc oceniam wyłącznie _tryb awarii_: czy odpowiedź
w ogóle podaje osobę i czy pochodzi ze strony o obecnym stanie, czy z listy
historycznej. Jedyny przypadek, który mogę nazwać wprost błędnym, to bazowe
„Fernando Tambroni" — premier z 1960 roku nie może być obecny.

### `current` — tryb awarii zniknął w czterech komórkach

Najmocniejszy dowód jest w źródłach, nie w odpowiedziach: ranking przestał
wybierać listy historyczne.

| komórka | źródło przed                                              | źródło po                                                | odpowiedź po                  |
| ------- | --------------------------------------------------------- | -------------------------------------------------------- | ----------------------------- |
| en      | „List of UK Prime Ministers in Order (1721-2026): All 59" | „Prime Minister of the United Kingdom \| Current Leader" | Keir Starmer                  |
| de      | „Bundeskanzler (Deutschland) — Wikipedia"                 | „Das Bundeskabinett im Überblick \| Bundesregierung"     | Friedrich Merz                |
| id      | „8 Urutan Presiden Indonesia"                             | „President of Indonesia \| Current Leader"               | Joko Widodo                   |
| hi      | „List of All Prime Ministers of India (1947-2026)"        | „Prime Minister of India"                                | Narendra Modi, **w Hinglish** |

Trzy z tych czterech nie podawały wcześniej żadnej osoby albo brały ją z listy.
Czwarta (hi) odpowiadała po angielsku, teraz odpowiada w języku pytania.

Komórki, które już działały — `es`, `fr`, `tr` — zachowały **te same źródła**
i te same odpowiedzi. Zmiana nie zepsuła niczego przy okazji.

Dwie nadal nie działają:

- **`it`** — źródło się nie zmieniło („Presidenti del Consiglio dei ministri
  della Repubblica Italiana", wikipedyczna lista). Tytuł nie zawiera roku, więc
  reguła „rok starszy niż pokolenie" go nie łapie. Odpowiedź przestała jednak
  podawać premiera z 1960 roku i brzmi teraz „La persona attualmente è il
  Presidente del Consiglio dei ministri" — zdanie okrężne, które nie odpowiada.
- **`pt`** — źródło bez zmian, odpowiedź nadal bez nazwiska („39. prezydent,
  z PT, od 1 stycznia 2023").

### `de/population` — naprawione

Przed: odpowiedź po angielsku. Po: „Laut Quelle 2 zählt München aktuell über
1,6 Millionen Einwohner", ze strony statystycznej miasta.

### `list` — bez poprawy, i to trzeba powiedzieć wprost

Sześć z ośmiu komórek dostało **dokładnie te same źródła** co poprzednio i
odpowiedzi praktycznie bez zmian. Poprawka filtra menu nie ruszyła tej
kategorii.

| komórka        | zmiana                                                               |
| -------------- | -------------------------------------------------------------------- |
| de             | jedyna poprawa: zamiast zdania prozą wróciła lista, ale dwupozycyjna |
| fr             | bez zmian, nadal poprawna (strona podaje ilości)                     |
| en, es, hi, it | bez zmian, nadal złe albo niepełne                                   |
| tr             | **gorzej**: „malzemeler anlatılmaktadır" („składniki są opisane")    |
| id             | **gorzej**: wróciły _narzędzia_ kuchenne zamiast składników          |

W `tr` i `id` wyszukiwarka zwróciła **inne strony** niż w przebiegu bazowym
(turecka — wersja z filmem, indonezyjska — poradnik o sprzęcie). Tych dwóch
pogorszeń nie da się więc przypisać zmianie; da się natomiast powiedzieć, że
kategoria się nie poprawiła.

**Wniosek roboczy:** przyczyna, którą naprawiłem — kasowanie listy przez filtr
menu — jest realna i potwierdzona testem jednostkowym, ale nie jest przyczyną
dominującą. Na tych stronach lista składników albo nie trafia do pobranego
tekstu w ogóle, albo siedzi w danych strukturalnych (`schema.org/Recipe`,
pole `recipeIngredient`), których ekstrakcja dziś nie czyta. To jest następny
krok i ma konkretny adres: `collectJsonLdText` już istnieje jako fallback,
ale nie sięga po `recipeIngredient`.

## Co zostaje otwarte

- **Pisma niełacińskie (~27 % użytkowników) nadal nieprzetestowane.** Droga,
  która zadziała: emulator Androida zamiast telefonu — tam `paste` z Argenta
  działa i wpuszcza Unicode. Na telefonie fizycznym potrzebny byłby IME typu
  ADBKeyboard, czyli instalacja obcej aplikacji na prywatnym urządzeniu.
- **Pogoda ze stron renderowanych JavaScriptem** — bez zmian względem
  `OPEN_ISSUES_WEB_SEARCH.md`. Niemiecka i francuska komórka dostały opis tego,
  co strona oferuje, zamiast prognozy.
- **Jednostki w pogodzie** nadal tylko po polsku i angielsku. Sygnał istnieje —
  planer zwraca `expects` w języku użytkownika („temperatura w °C") — ale to pole
  nie dociera do budowania promptu.
- **Sprzeczne źródła bez rozstrzygnięcia**: turecka populacja Ankary dostała trzy
  różne liczby i zdanie „nie podano, które źródło uznać za poprawne".
- **`de/hours` odpowiedziało cennikiem biletów** zamiast godzinami otwarcia —
  zły aspekt tej samej strony, nie zbadane.
