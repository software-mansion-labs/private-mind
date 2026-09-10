# 2026-09-10 — Pixel 10, słabe modele, języki niepolskie

Runda domyka lukę z `2026-09-07-smoke-r2.md`, gdzie języki ascii przetestowano
po jednym pytaniu, a portugalski wyszedł BROKEN. Cel: pełniejsza bateria na
najmniejszych modelach oraz sprawdzenie, czy tamte werdykty się odtwarzają.

**Urządzenie.** Pixel 10 `56211FDCR005KT`, build release `versionCode=68`,
`lastUpdateTime 2026-09-09 10:03:27`. Nie jest to HEAD gałęzi: build powstał
przed poprawką osieroconej tury i przed refaktorem parametrów trace'u. Dla
zachowań językowych te commity nic nie zmieniają.

**Metoda.** Każda tura to nowa rozmowa z ręcznie włączonym Web. Odczyt
z drzewa dostępności, nie ze zrzutów. Pytania w ascii, bo `keyboard` na
Androidzie idzie przez `adb input text`.

## Próg modelu działa i został potwierdzony po obu stronach

| model                      | parametry | Web               |
| -------------------------- | --------- | ----------------- |
| Qwen 2.5 – 0.5B            | 0,49 B    | **odmowa**        |
| Qwen 3 – 0.6B              | 0,75 B    | dozwolony, 13 tur |
| LLaMA 3.2 – 1B – SpinQuant | 1,24 B    | dozwolony, 4 tury |

Przy Qwen 2.5 – 0.5B przełącznik nie daje się włączyć, a aplikacja pokazuje
komunikat: _„This model cannot use web results reliably — pick a larger one."_

Ta sama tura puszczona offline na tym modelu tłumaczy, po co ta bramka
istnieje. Na pytanie o cenę iPhone'a w Niemczech model odpowiedział o
„Preisgrenze… für ein Buchstück" i wypunktował pięć wariantów zdania
„Gewinn von €700 oder höher”. Odpowiedź jest gramatycznie niemiecka i
całkowicie pozbawiona sensu.

## Qwen 3 – 0.6B — 13 tur

| język | pytanie          | liczba w odpowiedzi         | źródło           | ttft | tps   | werdykt  |
| ----- | ---------------- | --------------------------- | ---------------- | ---- | ----- | -------- |
| de    | cena             | 1099 EUR                    | apple.com DE     | 4784 | 14,01 | PASS     |
| de    | pogoda           | 11–17 °C, 7–21 km/h         | niemieckie       | 5290 | 16,72 | PASS     |
| de    | wiadomość dnia   | brak treści dnia            | bundestag.de     | 5342 | 12,95 | DEGRADED |
| de    | godziny otwarcia | data zamiast godzin         | Deutsches Museum | 4299 | 20,78 | DEGRADED |
| pt    | ludność          | 11.904.961                  | brazylijskie     | 5180 | 16,81 | PASS     |
| pt    | cena             | lista wewnętrznie sprzeczna | brazylijskie     | 4647 | 15,04 | DEGRADED |
| pt    | pogoda           | 22°                         | Climatempo       | 3590 | 26,49 | PASS     |
| es    | cena             | 779 EUR                     | hiszpańskie      | 4731 | 14,93 | PASS     |
| es    | pogoda           | wschód i zachód słońca      | Meteored MX      | 8354 | 10,20 | DEGRADED |
| fr    | cena             | 826,69 EUR                  | idealo.fr        | 8963 | 9,99  | PASS     |
| fr    | pogoda           | wschód i zachód słońca      | Météo Lyon       | 8829 | 8,26  | DEGRADED |
| tr    | cena             | pary bez sensu, oznaczone   | turecki sklep    | 6191 | 12,73 | DEGRADED |
| it    | cena             | 814,99 przy 794,90 w źródle | idealo.it        | 8288 | 10,11 | DEGRADED |

13/13 odpowiedzi w języku pytania, 6 PASS, 7 DEGRADED, zero odmów, zero
pustych baniek, zero crashy.

### Dwie rzeczy z rundy 2 się nie odtworzyły

**Portugalski nie jest BROKEN.** Runda 2 zapisała, że Refining oddaje
angielską odmowę zamiast portugalskiej odpowiedzi. Tutaj pytanie o ludność
São Paulo dostaje poprawną liczbę po portugalsku za pierwszym podejściem.

**Wyciek instrukcji językowej nie wystąpił ani razu.** Runda 2 miała cztery
wystąpienia na czterech turach, gdzie całą odpowiedzią było echo
`<pytanie> (Answer in X.)`. W trzynastu turach tej rundy: zero.

## LLaMA 3.2 – 1B – SpinQuant — 4 tury na tych samych pytaniach

| język | odpowiedź       | źródło            | caveat | ttft  | tps   |
| ----- | --------------- | ----------------- | ------ | ----- | ----- |
| de    | 1099 EUR        | apple.com DE      | nie    | 8909  | 9,36  |
| pt    | 12.005.878      | **anglojęzyczne** | nie    | 10551 | 11,50 |
| fr    | 969 € / 1 219 € | **anglojęzyczne** | tak    | 10637 | 10,27 |
| it    | circa €829,00   | idealo.it         | tak    | 10171 | 11,29 |

Model odpowiada w języku pytania we wszystkich czterech turach.

## Znaleziska

### 1. Profil planera zmienia język źródła, nie tylko zapytanie

`model-profiles.ts` daje Qwenowi 3 – 0.6B tryb `verbatim`, a LLaMA idzie przez
planer — widać to w UI jako „Checking whether to search… / Deciding what to
search for” zamiast „Searching «pytanie»”.

Skutek jest mierzalny w źródłach. Na to samo pytanie o ludność São Paulo
verbatim trafia na stronę brazylijską, a planer na anglojęzyczną. Na pytanie
o cenę we Francji verbatim trafia na `idealo.fr`, a planer na anglojęzyczny
agregator podający „8GB + 256GB”, czyli specyfikację w stylu androidowym dla
telefonu Apple. Po niemiecku obie ścieżki trafiają na tę samą stronę Apple,
więc efekt nie jest uniwersalny.

Wniosek jest niewygodny dla intuicji, że planer zawsze poprawia jakość:
**dla pytań w językach innych niż angielski przepisanie zapytania oddala
odpowiedź od źródeł lokalnych.**

### 2. Caveat na liczbach działa niekonsekwentnie — dowód kontrolowany

Ta sama tura, to samo źródło (badge `Apple iPhone 17 a € 794,90 | Settembre
2026 - idealo`):

| model          | odpowiedź     | ostrzeżenie |
| -------------- | ------------- | ----------- |
| Qwen 3 – 0.6B  | € 814.99      | **brak**    |
| LLaMA 3.2 – 1B | circa €829,00 | **jest**    |

Obie liczby nie zgadzają się z tą samą stroną, oflagowana została jedna.
Różnica źródła jako wyjaśnienie odpada — badge jest identyczny.

Ostrzeżenie odpaliło łącznie w 3 turach na 17 i za każdym razem trafnie;
problem jest w turach, w których milczy.

### 3. Bramka „brakuje liczby” zaspokaja się dowolną cyfrą

Pytanie o pogodę w Ciudad de México: pierwsza odpowiedź bez liczby, nudge
uruchamia Refining, poprawiona wersja podaje **godzinę wschodu i zachodu
słońca** zamiast temperatury i przechodzi. Ta sama treść wyszła po francusku
dla Lyonu, tam bez Refining. Dwie z trzech tur pogodowych w językach poziomu B.

Bramka pyta „czy jest cyfra”, a nie „czy jest cyfra tego rodzaju, o który
pytano”.

### 4. Pytanie „co się dziś wydarzyło” zwraca nawigację strony

Pytanie o Bundestag dostało opis tego, czym jest rubryka „heute im bundestag”,
w trzech niemal identycznych parafrazach jednego zdania, zamiast treści dnia.
Runda 2 zapisała dokładnie to samo po angielsku dla brytyjskiego parlamentu
(„Commons is sitting”). Wzorzec jest związany z typem pytania, nie z językiem.

### 5. Data z kontekstu wypiera odpowiedź

Pytanie o godziny otwarcia Deutsches Museum trafiło na właściwą stronę
`Öffnungszeiten`, a odpowiedź brzmi „öffnett am Donnerstag, 10 September
2026” — czyli podaje datę wstrzykniętą z faktów kalendarzowych zamiast
godzin ze strony. To samo pytanie po angielsku (British Museum) dało
w rundzie 2 poprawne 10:00–17:00.

### 6. Apostrof znika w zapytaniu do wyszukiwarki

`Combien coute l'iPhone 17 en France ?` poszło jako
`Combien coute l iPhone 17 en France ?`. Zostaje samotny token `l`.
Dla francuskiego, gdzie `l'`, `d'`, `qu'`, `j'` są wszechobecne, to
systematyczne, nie jednorazowe.

### 7. Przeciek struktury kontekstu do odpowiedzi

Odpowiedź po włosku zawierała „come indicato nel primo documento”, czyli
odwołanie do numeracji bloków `--- Source N ---`, widoczne dla użytkownika.
Wariant miękki tego samego pojawił się po portugalsku: „De acordo com os
dados apresentados”.

## Incydent — faza sieciowa bez wskaźnika postępu

Tura francuska o pogodę w Lyonie wysłana o 09:50:13. Do 09:54:40 `logcat` nie
zawiera ani jednej linii ExecuTorch, czyli model milczy; UI pokazuje gołe
„Thinking…” **bez bloku „Searching the web…”**. Trzy niezależne odczyty
drzewa w tym oknie potwierdziły brak bloku. Odpowiedź pojawiła się około
09:55, a aplikacja zaraportowała `ttft: 8829 ms`.

Znaczy to, że użytkownik czekał blisko pięć minut na ekranie nieodróżnialnym
od zawieszenia, a licznik czasu tego nie widzi. Pozostałe dwanaście tur
pokazywało blok wyszukiwania w ciągu sekundy, więc to nie jest normalna
ścieżka.

## Czego ta runda nie objęła

LFM 2.5 – 1.2B nie jest pobrany na Pixelu, więc luka „języki × LFM” z rundy 2
nadal stoi otwarta. Model jest na S20 FE i tam trzeba ją domknąć.

S20 FE odpadł z USB w trakcie przygotowań i wrócił dopiero po przeniesieniu
testów na Pixela. Zanim odpadł, ustalono, że ma zainstalowany build
debugowalny, którego bundle serwuje Metro z worktree `web-gate`, czyli
z cudzej gałęzi — testy na nim wymagają najpierw przepięcia `adb reverse`
na własny serwer.

## Runda druga tego dnia — build 11:42, weryfikacja dzisiejszych zmian

Build z dzisiejszego drzewa wgrany na Pixela o 11:45. Aplikacja wstała bez
crasha, rozmowy i wybrany model zachowane.

### Zmiany z dzisiaj, na urządzeniu

| co                                                 | wynik                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pytanie o stan obecny po niemiecku, model verbatim | odpowiedź poprawna („Friedrich Merz"), ale dominującym źródłem została lista `seit 1949` — kara za listę historyczną nie zepchnęła oficjalnej strony rządowej |
| lista składników po niemiecku, model verbatim      | **działa**: „Möhren, Pflanzenöl, Gewürzmischung, 1 TL Orangenschale" ze strony z przepisem, zamiast akapitu marketingowego                                    |

Pierwszy wiersz potwierdza to, co widać w teście jednostkowym: kara −3
konkuruje z dopasowaniem leksykalnym, a nie nadpisuje go.

### Pytania kontrolne z rundy 2026-09-09

Runda oryginalna szła na Gemma 4 – 2B. Model jest pobrany, ale **nie da się go
wybrać** (patrz niżej), więc kontrolne puszczono na Qwen 3 – 1.7B. Porównujemy
obecność faktu, nie brzmienie zdania.

| pytanie                         | wynik    | uwaga                                                                                                           |
| ------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| British Museum, godziny         | PASS     | „Daily: 10:00 AM to 5:00 PM, Fridays: 8:30 AM to 6:00 PM", źródło oficjalne                                     |
| Museum of Imaginary Instruments | **FAIL** | podał godziny Musical Instrument Museum i przemianował podmiot na „Museum of Imaginary **Musical** Instruments" |
| margarita, składniki            | PASS     | „tequila, lime juice, orange liqueur (Cointreau or triple sec)"                                                 |
| full English breakfast          | DEGRADED | brak `baked beans`, doszły `lettuce` i `a cup of coffee`; odpowiedź otwiera katalogiem stron                    |
| cold brew, kroki                | PASS     | kroki z „refrigerate for 16 hours" i „fine-mesh sieve… cheesecloth"; proporcja odwrócona                        |
| Greek salad, składniki          | PASS     | „cucumber, tomatoes, feta cheese, Kalamata olives, red onion, bell peppers"                                     |

Cztery z sześciu potwierdzone, jedno zdegradowane, jedno niepotwierdzone.

**Czasy na Qwen 3 – 1.7B są złe:** ttft 12–33 s, 4,5–6 tok/s, tura 80–85 s.
Dla porównania Qwen 3 – 0.6B w tej samej sesji: ttft 5–6 s, 13–16 tok/s.

### Dlaczego „Museum of Imaginary Instruments" nadal zawodzi

`unnamedSubjects` odpala tylko wtedy, gdy strona nie dzieli z pytaniem nic.
Odtworzone w izolacji:

| kontekst                                              | wynik reguły                     |
| ----------------------------------------------------- | -------------------------------- |
| strona MIM („Musical Instrument Museum… instruments") | `[]` — podmiot uznany za nazwany |
| strona o zupełnie czym innym                          | `["Imaginary Instruments"]`      |

Reguła łapie przypadek łatwy i przepuszcza ten groźny: przy nieistniejącym
podmiocie wyszukiwarka zwraca właśnie strony prawie trafione, i to z nich
powstaje przekonująca fabrykacja.

### Model pobrany, którego nie da się wybrać

W Model Hub `LFM 2.5` pokazuje „3 variants / 3 downloaded", a arkusz wariantu
oferuje „Run benchmark" i „Delete downloaded files". W selektorze modelu do
czatu **nie ma ani jednego wariantu LFM ani Gemmy** — lista zaczyna się na
Qwen 3 – 0.6B i kończy na Qwen 2.5 – 3B.

Selektor czyta `downloadedModels`, czyli `models.filter((m) => m.isDownloaded)`
prosto z bazy, i filtruje wyłącznie po treści wyszukiwarki. Skoro hub widzi
pliki, a selektor nie widzi modeli, flaga w bazie rozjeżdża się ze stanem na
dysku.

To blokuje dwie rzeczy naraz: lukę „języki × LFM 2.5 – 1.2B" z rundy 2
i wierne powtórzenie rundy z 9 września na Gemma 4 – 2B.
