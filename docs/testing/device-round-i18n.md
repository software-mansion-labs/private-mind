# Runda 2 — web search w językach użytkowników (nie po polsku)

Runda 1 (`DEVICE_SMOKE_TEST_PLAN.md`) sprawdzała stabilność po polsku, który
ma 3,6 % użytkowników. Ta runda sprawdza, czy web search działa w językach,
którymi ludzie faktycznie piszą do aplikacji.

## 1. Rozkład języków (użytkownicy, stan na 2026-09-07)

| poziom | język            | kod | udział | pismo               | pisanie na Androidzie przez Argent |
| ------ | ---------------- | --- | ------ | ------------------- | ---------------------------------- |
| A      | angielski        | en  | 41,0 % | łacińskie           | tak                                |
| A      | hindi            | hi  | 12,8 % | devanagari          | nie (Hinglish w łacince: tak)      |
| A      | urdu             | ur  | 5,3 %  | arabskie, RTL       | nie                                |
| A      | niemiecki        | de  | 4,9 %  | łacińskie + ä ö ü ß | tylko ascii                        |
| B      | portugalski (BR) | pt  | 3,7 %  | łacińskie + ã ç é   | tylko ascii                        |
| B      | hiszpański       | es  | 3,3 %  | łacińskie + ñ á ¿   | tylko ascii                        |
| B      | francuski        | fr  | 3,1 %  | łacińskie + é è ç   | tylko ascii                        |
| B      | rosyjski         | ru  | 2,9 %  | cyrylica            | nie                                |
| B      | arabski          | ar  | 2,6 %  | arabskie, RTL       | nie                                |
| B      | chiński          | zh  | 2,2 %  | han, bez spacji     | nie                                |
| C      | indonezyjski     | id  | 1,7 %  | łacińskie           | tak                                |
| C      | turecki          | tr  | 1,7 %  | łacińskie + ı ş ğ ç | tylko ascii                        |
| C      | włoski           | it  | 1,6 %  | łacińskie + è à     | tylko ascii                        |
| C      | perski (farsi)   | fa  | ogon   | arabskie, RTL       | nie                                |

Poziom A = pięć pytań, B = trzy, C = dwa. Razem 4·5 + 6·3 + 4·2 = 46 tur
z Web na parę (urządzenie, model).

## 2. Co w kodzie zależy od języka (cele testu)

| mechanizm                                                             | pokrycie                          | ryzyko do sprawdzenia                                                                                                   |
| --------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `detectQuestionLanguage` → instrukcja „odpowiadaj w języku X”         | alfabet + stopwords               | mylenie ur/ar/fa (to samo pismo), pt/es, id/ms; Hinglish wykrywany jako en                                              |
| stopwords w `queryTerms.ts`                                           | 14 języków, **brak zh**           | dla zh zapytanie do wyszukiwarki i ranking leksykalny bez segmentacji słów                                              |
| `QUESTION_WANTS_DATE` / `QUESTION_WANTS_AMOUNT` w `messageSources.ts` | pl en de fr es pt ru hi           | dla ur ar fa zh id tr it nudge „brakuje liczby/daty” nigdy nie startuje — odpowiedź bez liczby przejdzie bez „Refining” |
| `isWrongLanguageAnswer` → `focusedRetry`                              | oba kierunki                      | model 0.6B/1.2B odpowiada po angielsku na hindi/urdu → czy retry naprawia i ile kosztuje                                |
| `carryReferentIntoQuery` / `conversationSubject`                      | heurystyki znaków                 | zmiana języka w środku rozmowy: temat z tury polskiej doklejony do pytania angielskiego                                 |
| `detectTopicLanguage` (TLD hosta)                                     | lista TLD                         | wynik .in/.pk/.br/.sa — czy źródła są w języku pytania, czy anglojęzyczne                                               |
| `charset.ts`                                                          | utf-8, cp1252, cp1250, iso-8859-2 | strony w cp1251 (ru), windows-1256 (ar), gbk (zh) mogą przyjść jako krzaki                                              |
| UI: trace, karta Sources, badge, cytaty                               | LTR                               | RTL dla ur/ar/fa: wyrównanie, kolejność ikon, obcięcia; devanagari i han: łamanie linii, wysokość wiersza               |
| `calendarFacts` (nazwy dni)                                           | `Intl` po kodzie języka           | „dziś/jutro” w hi/ur/ar — czy data w odpowiedzi jest poprawna                                                           |

## 3. Urządzenia i modele

| urządzenie  | model          | zakres języków                              | powód                                                                     |
| ----------- | -------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| iPhone 17   | LFM 2.5 - 1.2B | wszystkie 14                                | `keyboard` na iOS wpisuje Unicode; embeddingi dostępne (gate 6,5 GB)      |
| iPhone 17   | Qwen 3 - 1.7B  | wszystkie 14                                | najlepszy z dostępnych w zh/hi; porównanie z LFM na tych samych pytaniach |
| S20 FE      | Qwen 3 - 0.6B  | en, id, Hinglish + ascii: de pt es fr tr it | tylko ascii przez `adb input`; brak embeddingów (gate)                    |
| S20 FE      | LFM 2.5 - 1.2B | jak wyżej                                   | —                                                                         |
| iPhone SE 3 | LFM 2.5 - 1.2B | en, hi, ur, de (poziom A)                   | 4 GB RAM; Qwen 0.6B odpadł w rundzie 1 (NOT READY)                        |
| Pixel 10    | Gemma 4 - 2B   | poziom A, ręcznie z Gboard                  | Pixel zostaje dla właściciela; `paste` nie działa na fizycznym Androidzie |

Kolejność: iPhone 17 (oba modele) → S20 FE (Qwen 0.6B, potem LFM) → iPhone SE.
Sesje jak w rundzie 1: jedna iOS, jedna Android, Sonnet, oszczędnie.

## 4. Scenariusze

Każda tura: nowa rozmowa, Web włączony i potwierdzony, pytanie wpisane co do
znaku (iOS) albo w ascii z adnotacją (Android). Zapisujesz: język pytania,
język odpowiedzi (po alfabecie i po tym, czy pojawiają się angielskie
zdania), zapytanie, które poszło do wyszukiwarki (rozwiń „Searched the web”),
TLD/język dominującego źródła, czas szukania, ttft, tps, czy był „Refining…”,
czy odpowiedź zawiera liczbę z pytania.

### L1 — pięć typów pytań w języku (A: 5, B: pierwsze 3, C: pierwsze 2)

Kolejność typów: fakt z liczbą, cena w lokalnej walucie, pogoda w lokalnym
mieście, wiadomość dnia, godziny otwarcia miejsca.

**en**

1. What is the population of London?
2. How much does the iPhone 17 cost in the US?
3. What's the weather in New York today?
4. What happened in the UK Parliament today?
5. What are the opening hours of the British Museum?

**hi** (devanagari; na Androidzie zamiast tego Hinglish z L3)

1. मुंबई की जनसंख्या कितनी है?
2. भारत में iPhone 17 की कीमत क्या है?
3. आज दिल्ली में मौसम कैसा है?
4. आज लोकसभा में क्या हुआ?
5. ताजमहल के खुलने का समय क्या है?

**ur** (RTL)

1. کراچی کی آبادی کتنی ہے؟
2. پاکستان میں iPhone 17 کی قیمت کیا ہے؟
3. آج لاہور میں موسم کیسا ہے؟
4. آج قومی اسمبلی میں کیا ہوا؟
5. بادشاہی مسجد کے کھلنے کے اوقات کیا ہیں؟

**de**

1. Wie viele Einwohner hat Berlin?
2. Was kostet das iPhone 17 in Deutschland?
3. Wie ist das Wetter heute in München?
4. Was ist heute im Bundestag passiert?
5. Wann hat das Deutsche Museum geöffnet?

**pt (BR)**

1. Quantos habitantes tem São Paulo?
2. Quanto custa o iPhone 17 no Brasil?
3. Como está o tempo hoje no Rio de Janeiro?

**es**

1. ¿Cuántos habitantes tiene Madrid?
2. ¿Cuánto cuesta el iPhone 17 en España?
3. ¿Qué tiempo hace hoy en Ciudad de México?

**fr**

1. Combien d'habitants compte Paris ?
2. Combien coûte l'iPhone 17 en France ?
3. Quel temps fait-il aujourd'hui à Lyon ?

**ru**

1. Сколько жителей в Москве?
2. Сколько стоит iPhone 17 в России?
3. Какая сегодня погода в Санкт-Петербурге?

**ar**

1. كم عدد سكان الرياض؟
2. كم سعر iPhone 17 في السعودية؟
3. كيف حال الطقس اليوم في القاهرة؟

**zh**

1. 上海有多少人口？
2. iPhone 17 在中国的价格是多少？
3. 今天北京的天气怎么样？

**id**

1. Berapa jumlah penduduk Jakarta?
2. Berapa harga iPhone 17 di Indonesia?

**tr**

1. İstanbul'un nüfusu kaç?
2. Türkiye'de iPhone 17 ne kadar?

**it**

1. Quanti abitanti ha Roma?
2. Quanto costa l'iPhone 17 in Italia?

**fa**

1. جمعیت تهران چقدر است؟
2. قیمت iPhone 17 در ایران چقدر است؟

Kryterium tury: odpowiedź w języku pytania, źródło dominujące w języku
pytania albo anglojęzyczne z sensowną treścią, liczba z pytania obecna.
Odmowa lub odpowiedź po angielsku na pytanie w innym języku to obserwacja
jakości, nie błąd stabilności — chyba że towarzyszy jej pusta bańka albo
zawieszenie.

### L2 — zmiana języka w rozmowie (topic carry × język)

Jedna rozmowa, Web włączony:

1. Ile kosztuje Samsung Galaxy S25 w Polsce?
2. And how much is it in Germany?
3. Wie ist das Wetter heute in Berlin?
4. What did I ask about first?

Sprawdzasz: zapytanie z tury 2 przenosi „Samsung Galaxy S25”, a z tury 3 już
nie (regresja „GB Czarny” z rundy 1); język każdej odpowiedzi; brak
„Refining…” z powodu złego języka. Na każdej parze.

### L3 — Hinglish i pisma mieszane (kluczowe dla 12,8 % hi na Androidzie)

Pytania w łacince, jak piszą użytkownicy z Indii:

1. Mumbai ki population kitni hai?
2. iPhone 17 ka price India me kya hai?
3. Aaj Delhi me mausam kaisa hai?

Do zapisania, nie do oceniania: wykryty język (zapewne en), język odpowiedzi
(en czy hi), czy zapytanie do wyszukiwarki zostało przepisane na angielski
albo hindi. Na iPhone 17 dodatkowo tura mieszana: „iPhone 17 की कीमत in
India?”.

### L4 — RTL i pisma niełacińskie w UI (tylko iPhone 17)

Po turach ur/ar/fa oraz hi/zh z L1: zrzut pełnej bańki z rozwiniętym trace
i kartą Sources. Oceniasz: wyrównanie tekstu odpowiedzi, kolejność „badge –
tytuł” w źródłach, obcięte tytuły, wysokość wierszy w devanagari, łamanie
chińskiego bez spacji, podświetlenie cytatu (`citationHighlight`) — czy
zaznacza właściwy fragment.

### L5 — brak liczby w odpowiedzi w języku bez word listy

Dla ur, ar, zh, id, tr, fa: pytanie o cenę z L1. Jeśli odpowiedź nie zawiera
liczby, a passage ją ma (rozwiń źródło), zapisz „brak nudge” — to potwierdza
lukę `QUESTION_WANTS_AMOUNT`. Nie naprawiaj.

### L6 — strona w kodowaniu spoza listy

Po jednej turze ru, ar, zh: rozwiń dominujące źródło i przeczytaj cytat.
Krzaki (Ð Ñ, Ø§, æ–‡) = błąd dekodowania, zapisz URL. To jedyny scenariusz,
w którym zapisujesz adres strony.

### L7 — stabilność: 6 tur z rzędu w piśmie niełacińskim (iPhone 17)

hi albo ur, Qwen 3 1.7B: sześć pytań z L1 i L3 bez nowej rozmowy. Jak S5
w rundzie 1: obserwujesz crash, pustą bańkę, spadek tps względem tury 1.

## 5. Metryki i werdykt

Na język (zsumowane po parach): odsetek odpowiedzi w języku pytania, odsetek
źródeł w języku pytania, mediana czasu szukania, liczba „Refining…”, liczba
odmów, liczba incydentów stabilności.

| werdykt  | warunek                                                                                       |
| -------- | --------------------------------------------------------------------------------------------- |
| OK       | ≥ 4/5 (A) albo wszystkie (B, C) odpowiedzi w języku pytania, źródła sensowne, brak incydentów |
| DEGRADED | odpowiedzi po angielsku albo źródła nietrafne, ale bez incydentów                             |
| BROKEN   | pusta bańka, zawieszenie, krzaki w cytacie, albo odmowa w co najmniej połowie tur             |
| N/A      | pisma nie da się wpisać na urządzeniu (Android, niełacińskie)                                 |

Tabela końcowa: język × (iPhone 17 LFM, iPhone 17 Qwen 1.7B, S20 FE Qwen
0.6B, S20 FE LFM, iPhone SE LFM) z werdyktem i jedną linią uwag.

## 6. Ograniczenia narzędzi (do promptu testera)

- Android: `keyboard` idzie przez `adb input text` — tylko ascii. Pisma
  niełacińskie i diakrytyki: nie da się, `paste` nie działa na fizycznym
  telefonie. Wpisujesz wariant ascii (`Istanbul'un nufusu kac?`) z adnotacją
  `ascii`.
- iOS: `keyboard` wpisuje Unicode, RTL też. Po wpisaniu zrób zrzut pola przed
  wysłaniem — raz na język, żeby potwierdzić, że znaki nie zostały zjedzone.
- `describe` na fizycznym iPhone zwraca puste drzewo dla naszej aplikacji:
  zrzuty i `await-ui-element` na tekst „Thinking”/„Refining”.
- Pytania po angielsku o ceny w USD porównaj z rundą 1 (LFM podał „799 USD”
  na pytanie o PLN — sprawdź, czy to była wina języka źródła).

## 7. Czas

46 tur L1 + 4 L2 + 4 L3 + 6 L7 ≈ 60 tur na parę na iPhone 17 ≈ 75 min z Web;
S20 FE i SE mają zestaw obcięty do łacinki ≈ 25 tur ≈ 35 min. Razem około
4 h czasu urządzeń, dwie sesje równolegle ≈ 2,5 h.
