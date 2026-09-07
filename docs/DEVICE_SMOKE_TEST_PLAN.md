# Web search — smoke testy stabilności na fizycznych urządzeniach

Cel: odpowiedzieć, **czy dany model LLM na urządzeniu danej klasy może
pracować z web search w buildzie release, i czy to jest production ready**.
Nie oceniamy tu jakości odpowiedzi tak głęboko jak w
`WEB_SEARCH_RELEASE_TEST_PLAN.md` (sekcje 3, 9, 11) — oceniamy, czy aplikacja
**nie pada, nie wisi, nie zwalnia i nie psuje tego, co działało bez web
search**, oraz notujemy każde pogorszenie wydajności z sytuacją, w której
wystąpiło, żeby dało się je odtworzyć i zaplanować poprawkę.

Buildy: **release** (bundle JS w aplikacji, bez Metro, bez dev menu, bez
debuggera). Dowody pochodzą z UI (`describe`, zrzuty, nagrania na Androidzie),
z eksportu rozmowy (JSON z `sourceDocuments`, `tokensPerSecond`,
`timeToFirstToken`, `groundingCaveats`), z `adb` (Android) i `xcrun devicectl`
(iOS). Metryki wydajności w bańce włącza Settings → „Show performance
metrics” (`ttft: … ms, tps: … tok/s`).

## 1. Urządzenia i klasy

| Klasa | Urządzenie | Id | System | RAM (nominal / raportowany) | SoC |
|---|---|---|---|---|---|
| A — flagowiec Android | Pixel 10 | adb `56211FDCR005KT` | Android 16 | 12 GB / 11,3 GB | Tensor G5 |
| A — flagowiec iOS | iPhone 17 „Szczepan Cierpliwy” | UDID `00008150-000E62513E01401C`, CoreDevice `1A9BF7C8-8C48-59E8-8947-8823CC422381` | iOS 26.6.1 | 8 GB / ~7,5 GB (do odczytu z toasta bramki) | A19 |
| B — średnia półka Android, stary SoC | Samsung Galaxy S20 FE `SM-G781B` | adb `RFCT814MVHX` | Android 13 | 6 GB / 5,5 GB | Snapdragon 865 |
| C — mało RAM iOS | iPhone SE (3. gen.) „Szczepan Czerwone Jabłuszko III” | UDID `00008110-000641663E90401E`, CoreDevice `4E07878B-2D64-53C6-9D28-B406F895FC87` | iOS 26.6 | 4 GB / ~3,7 GB | A15 |

Oba iPhone'y są nadzorowane przez MDM Software Mansion; instalacja aplikacji
przez Argent i `devicectl` działa (sprawdzone 2026-09-07, runner Argenta
zainstalował się na obu). Build iOS jest podpisany zespołem `DAAT3F8YMV` i
nosi id **`com.swmansion.privatemind.smoke`** — `com.swmansion.privatemind`
jest zarejestrowane w innym zespole Apple i nie da się go podpisać z tego
Maca. Android zostaje przy `com.swmansion.privatemind` (release podpisany
tym samym `debug.keystore` co dotychczasowe buildy, więc instaluje się bez
utraty danych).

## 2. Co bramka pamięci przewiduje (do potwierdzenia na urządzeniu)

Z `utils/modelCompatibility.ts` i `constants/model-profiles.ts`:

- budżet na model: Android `RAM − min(2,5; 0,5·RAM) − 0,5`, iOS
  `RAM·0,6·0,95 − 0,5` (GB);
- model ładuje się, gdy `modelSize + 0,3 ≤ budżet`;
- web search włącza się, gdy dodatkowo `+ 0,3 ≤ budżet` **i** RAM ≥
  `webSearchMinDeviceMemoryGB` (8 GB dla Gemma 4 2B, Gemma 4 VL, Qwen 2.5 3B,
  LLaMA 3B); Qwen 2.5 0.5B ma `webSearchReady: false` (toast „cannot use web
  results reliably”).

Budżety: Pixel 10 ≈ 8,3 GB, iPhone 17 ≈ 3,8 GB, S20 FE ≈ 2,5 GB, iPhone SE ≈
1,6 GB.

| Model (`modelSize` GB) | Pixel 10 | iPhone 17 | S20 FE | iPhone SE |
|---|---|---|---|---|
| Qwen 3 - 0.6B (0,94) | ładuje / web ✓ | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ (1,54 ≤ 1,6 — na granicy) |
| Bielik v3.0 (0,86) | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ |
| LFM 2.5 - 1.2B (1,14) | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ | ✓ / **✗ przewidywane** (1,74 > 1,6) |
| LLaMA 3.2 - 1B SpinQuant (1,14) | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ | ✓ / **✗ przewidywane** |
| Qwen 2.5 - 1.5B (1,76) | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ (2,36 ≤ 2,5) | ✗ |
| Qwen 3 - 1.7B (2,16) | ✓ / ✓ | ✓ / ✓ | ✓ / **✗ przewidywane** (2,76 > 2,5) | ✗ |
| Gemma 4 - 2B (2,5 / iOS 2,9) | ✓ / ✓ | ✓ / **? — zależy, czy iOS raportuje ≥ 8 GB** | ✗ (min 8 GB) | ✗ |

Każda komórka „przewidywane” jest sama w sobie przypadkiem testowym: toast
i stan przełącznika Web muszą zgadzać się z przewidywaniem. Rozjazd = wynik
(bramka za ostra albo za luźna), nie awaria testu. Komórka „?” dla iPhone 17
to najważniejsze pytanie klasy A iOS: jeśli `DeviceInfo.getTotalMemory`
zwraca 7,5 GB, referencyjny model **nie ma** web search na 8-gigowym
iPhonie — to trzeba wiedzieć przed wydaniem.

## 3. Matryca do przejścia

Na każdym urządzeniu **dwa modele**: najtańszy, jaki ma sens (planer
`verbatim` lub najmniejszy `llm`), i największy, jaki bramka wpuści. Kolejność
= kolejność w wierszu. Trzecia pozycja tylko, jeśli zostanie czas.

| Urządzenie | Model 1 (tani) | Model 2 (największy dozwolony) | Opcjonalnie |
|---|---|---|---|
| Pixel 10 | LFM 2.5 - 1.2B | Gemma 4 - 2B (referencja z serii 1–3) | Qwen 3 - 1.7B |
| iPhone 17 | LFM 2.5 - 1.2B | Gemma 4 - 2B — jeśli bramka blokuje, zapisz toast i weź Qwen 3 - 1.7B | Qwen 3 - 0.6B |
| S20 FE | Qwen 3 - 0.6B | LFM 2.5 - 1.2B | Qwen 2.5 - 1.5B |
| iPhone SE | Qwen 3 - 0.6B | LFM 2.5 - 1.2B — spodziewany toast; jeśli wpuści, przejść scenariusze | Bielik v3.0 |

Czas: ~40 min na parę (urządzenie, model) plus pobieranie modeli (0,9–2,9 GB
z Hugging Face na Wi-Fi FiberMansion). Pixel ma już Gemmę 4 2B z serii 1–3
(dane aplikacji przetrwały reinstalację). Razem: jeden dzień na cztery
urządzenia przy dwóch równoległych sesjach (Android / iOS).

## 4. Scenariusze na każdą parę (urządzenie, model)

Numeracja S0…S9. Każdy scenariusz ma „zbierz” i „PASS gdy”. Web włączany w
każdej nowej rozmowie (przełącznik jest per rozmowa, domyślnie wyłączony).

### S0 — instalacja i pierwszy start

Zbierz: czas od tapnięcia ikony do ekranu czatu (stoper na zrzutach), wersja
(`versionCode 68` / `1.2.1`, `lastUpdateTime` z `dumpsys package` na
Androidzie), czy pojawił się „What's New” / onboarding, czy aplikacja poprosiła
o uprawnienia. PASS: start < 5 s (A), < 10 s (B, C), bez crashu, bez
pustego ekranu.

### S1 — pobranie i załadowanie modelu

Zbierz: czas pobrania (MB/s), czas ładowania (od tapu „Load”/wyboru do
gotowości pola tekstowego), toast bramki jeśli był, RSS po załadowaniu
(Android: `adb shell dumpsys meminfo com.swmansion.privatemind | grep TOTAL`).
PASS: model z kolumny „ładuje ✓” ładuje się; model „✗” dostaje toast, nie
crash. Zapisz też, co pokazuje **lista modeli** (które są wyszarzone).

### S2 — bazowa rozmowa bez web (punkt odniesienia)

Nowa rozmowa, Web **wyłączony**. Trzy pytania po polsku:

1. „Wyjaśnij w trzech zdaniach, czym jest fotosynteza.”
2. „Napisz krótki limeryk o kocie.”
3. „Ile to jest 17 razy 23?”

Zbierz z bańki: `ttft`, `tps` każdej odpowiedzi; RSS po turze 3. To jest
baza dla S3–S5: pogorszenie liczymy względem tych liczb.

### S3 — web search: pięć typów pytań

Nowa rozmowa, Web **włączony** (potwierdź stan przez `describe`
`web-search-toggle`). Pytania co do znaku:

1. price: „Ile kosztuje Samsung Galaxy S25 w Polsce?”
2. weather/date: „Jaka jest dzisiaj pogoda w Krakowie?”
3. fact: „Ile mieszkańców ma Warszawa?”
4. news: „Co się dziś dzieje w Sejmie?”
5. place: „Jakie są godziny otwarcia Wawelu?”

Zbierz na każdą turę: czas od wysłania do pierwszego tokenu (stoper:
`await-ui-element` na pojawienie się tekstu w bańce, zapisany timestamp
wyniku), `ttft`/`tps` z bańki, trace (ile zapytań, ile stron „Reading”, czy
„Refining…”), liczba źródeł w Sources sheet, czy odpowiedź zawiera liczbę i
czy ta liczba jest w `passage` eksportu. PASS stabilności: 5/5 tur dostało
odpowiedź (może być odmowa), 0 pustych baniek, 0 wiszącego „Searching…” >
120 s, trace kończy się „done”/„stopped”/„no results”. Jakość notujemy
(poprawne / niepoprawne / odmowa mimo dowodu), ale werdykt stabilności od
niej nie zależy.

### S4 — przerwania (każde raz, plus powtórka jeśli coś dziwnego)

| Akcja | PASS gdy |
|---|---|
| Stop w trakcie „Searching…” | trace „stopped”, brak pustej bańki, pole tekstowe znów aktywne < 3 s, kolejna tura działa |
| Stop w trakcie generacji | tekst zostaje obcięty tam, gdzie był, bez „Refining…”, kolejna tura działa |
| wyjście z rozmowy (szuflada → inna rozmowa) w trakcie generacji, powrót po 20 s | odpowiedź jest w **tej** rozmowie, w całości albo obcięta, bez duplikatu |
| zmiana modelu w trakcie „Searching…” | brak crashu; szukanie zatrzymane albo dokończone na starym modelu — zapisz co |
| aplikacja w tle (Home) w trakcie „Reading the pages”, 30 s, powrót | wznowienie albo czysty „stopped”; **na iOS**: czy proces przeżył (nowy zimny start = FAIL klasy A, do zapisania na B/C) |
| wyłączenie Wi-Fi w trakcie szukania | trace z notą o błędach pobierania, odpowiedź z tego, co było, brak zawieszenia |

### S5 — wytrzymałość pamięciowa: 10 tur web z rzędu

Jedna rozmowa, Web włączony, 10 pytań (sekcja 3 planu release, kolejno z
3.1, 3.2, 3.6, 3.7, 3.10 — po dwa z każdej). Co dwie tury: Android
`dumpsys meminfo … | grep -E "TOTAL PSS|TOTAL RSS"`, iOS — nic w trakcie
(brak narzędzia), po serii lista `JetsamEvent-*.ips` z `systemCrashLogs`.
Po 10 turach: `adb shell dumpsys activity exit-info com.swmansion.privatemind`
(Android) — każdy wpis `LOW_MEMORY`/`CRASH` z czasem sesji to FAIL.
PASS: proces ten sam od początku do końca, RSS po turze 10 ≤ 1,25 × RSS po
turze 2, `tps` tury 10 ≥ 0,8 × `tps` tury 2.

### S6 — tryb samolotowy

Włącz tryb samolotowy, wyślij „Jaka jest dziś pogoda w Gdańsku?” z Web
włączonym. PASS: trace „No internet — answered without the web”, odpowiedź
bez odmowy „nie mam dostępu do internetu” jako jedynej treści, brak
zawieszenia; po wyłączeniu trybu kolejna tura szuka normalnie.

### S7 — strona-olbrzym i bot-wall

„Co to jest Polska? Podaj powierzchnię i liczbę ludności.” (Wikipedia) oraz
„Co pisze dziś wyborcza.pl na pierwszej stronie?” (paywall/403). PASS: brak
zawieszenia UI (zrzut co 5 s pokazuje zmieniający się trace), pobranie w
limicie, odpowiedź albo uczciwa nota o nieprzeczytanych stronach.

### S8 — regresja tego, co było przed web search

W tej samej sesji, Web **wyłączony**: (a) dołącz dokument PDF/tekst
(dowolny z urządzenia; na iOS z Files) i zadaj pytanie o jego treść; (b)
wklej URL `https://pl.wikipedia.org/wiki/Kraków` jako załącznik i zapytaj o
liczbę mieszkańców; (c) zwykła rozmowa 3 tury. Zbierz `ttft`/`tps` i porównaj
z S2. PASS: RAG działa jak dotąd (cytowania), `tps` ≥ 0,8 × S2, brak
toasta o pamięci przy dołączaniu, przełącznik Web nie zmienia stanu sam.

### S9 — zimny start po serii

Zabij aplikację (Android: `adb shell am force-stop`, iOS: przesunięcie z
przełącznika aplikacji), uruchom, wejdź do rozmowy z S5. PASS: historia i
trace odtworzone (tylko strony `read`/`used`, tyle kroków ile zapytań),
model ładuje się bez toasta, pierwsza tura działa.

## 5. Metryki wydajności — co zapisać i skąd

| Metryka | Źródło | Gdzie zapisać |
|---|---|---|
| `ttft` (ms), `tps` (tok/s) każdej tury | bańka odpowiedzi (Settings → Show performance metrics), eksport JSON | tabela tur |
| czas szukania (od wysłania do pierwszego tokenu) | timestampy wyników `await-ui-element` / zrzutów | tabela tur |
| RSS/PSS | Android `dumpsys meminfo`; iOS brak — tylko Jetsam | S1, S2, S5 |
| zabicia i crashe | Android `dumpsys activity exit-info`, `logcat -b crash`; iOS `devicectl … systemCrashLogs` (`<App>-*.ips`, `JetsamEvent-*.ips`) | sekcja „Incydenty” |
| ANR / zawieszenie UI | Android `logcat -b events \| grep am_anr`; oba: zrzut co 5 s podczas szukania — brak zmian przez 3 zrzuty = zawieszenie | „Incydenty” |
| klatki | Android `dumpsys gfxinfo com.swmansion.privatemind` (Janky frames %) po S3 i S5, `reset` przed | tabela per scenariusz |
| temperatura / throttling | Android `dumpsys thermalservice` (status), bateria `dumpsys battery`; iOS — obudowa w dotyku, zapisz subiektywnie | S5 |
| czas pobrania i ładowania modelu | stoper | S1 |

**Pogorszenie wydajności** notujemy zawsze w jednym formacie, żeby dało się
z tego zrobić zadanie:

```
urządzenie | model | scenariusz i tura | metryka | baza (S2) | zaobserwowane | co się działo w tej chwili (trace, liczba stron, model embeddingowy załadowany?) | powtarzalne? (2/2, 1/2) | zrzut/nagranie
```

Progi, od których wpis jest obowiązkowy: `tps` < 0,8 × S2; czas szukania >
60 s (A) / 120 s (B, C); RSS +25 % w obrębie S5; janky frames > 20 %;
jakiekolwiek zabicie procesu; UI bez zmian > 15 s podczas „Searching…”.

## 6. Werdykt: production ready?

Liczony **na parę (model, klasa urządzenia)**. Trzy poziomy:

- **READY** — wszystkie warunki: 0 crashy/zabić/ANR w całej sesji; S3 5/5
  tur zakończonych; S4 6/6 bez zawieszenia; S5 przeszedł; S6–S9 przeszły;
  mediana czasu szukania ≤ 45 s (A) / ≤ 90 s (B, C); `tps` z web ≥ 0,8 ×
  S2; S3 ≥ 3/5 odpowiedzi z liczbą zgodną z `passage` (żeby „stabilnie”
  nie znaczyło „stabilnie bezużytecznie”).
- **READY Z ZASTRZEŻENIEM** — stabilność jak wyżej, ale jeden z progów
  czasu/`tps`/jakości nie spełniony; zastrzeżenie nazwane w jednym zdaniu
  (np. „mediana szukania 110 s na S20 FE”).
- **NOT READY** — jakikolwiek crash, zabicie, ANR, zawieszenie, pusta
  bańka, utrata odpowiedzi po wyjściu z rozmowy, albo S8 pokazuje regresję
  RAG/attach.
- **GATED** — bramka nie wpuszcza modelu do web search na tym urządzeniu;
  to nie werdykt o modelu, tylko zapis, że aplikacja się chroni. Rozjazd z
  sekcją 2 zapisujemy osobno.

Tabela końcowa (jedna na cały dokument wyników):

| Klasa | Urządzenie | Model | Werdykt | Mediana szukania | tps web / tps baza | Incydenty | Zastrzeżenie |
|---|---|---|---|---|---|---|---|

## 7. Dowody i ich zbieranie w buildzie release

- **Eksport rozmowy**: szuflada → menu rozmowy → „Export”. Plik
  `chat-<timestamp>.json` trafia do katalogu Documents aplikacji i do arkusza
  udostępniania. iOS: pobierz bez arkusza —
  `xcrun devicectl device copy from --device <CoreDevice> --domain-type appDataContainer --domain-identifier com.swmansion.privatemind.smoke --user mobile --source Documents/chat-<ts>.json --destination <abs>`;
  Android (release = bez `run-as`): w arkuszu wybierz „Files/Pliki” → Download,
  potem `adb pull /sdcard/Download/chat-<ts>.json`.
- **Logi Androida**: `adb -s <serial> logcat -d -v time > <plik>` po każdym
  scenariuszu, `logcat -c` przed. Szukaj `AndroidRuntime`, `lmkd`,
  `am_anr`, `ExecuTorch`, `Web search` (w release logi `__DEV__` nie ma —
  to normalne).
- **Logi iOS**: `xcrun devicectl device process launch --device <CoreDevice> --console --terminate-existing com.swmansion.privatemind.smoke` uruchamia aplikację z konsolą (restartuje ją — używać tylko na starcie scenariusza). Crashe: `xcrun devicectl device info files --device <CoreDevice> --domain-type systemCrashLogs`.
- **Zrzuty i nagrania**: Android — `screen-recording-start/stop` na S3, S4,
  S5; iOS — brak nagrań na sprzęcie, zrzut co 5 s podczas szukania
  (`screenshot`), nazwy `<urządzenie>-<model>-S<n>-<tura>-<hhmmss>.png` w
  `docs/test-evidence/smoke/`.
- **Stan urządzenia przed startem**: bateria ≥ 50 %, Wi-Fi FiberMansion,
  tryb samolotowy wyłączony, inne aplikacje zabite, ekran nie gaśnie
  (Android: `settings put system screen_off_timeout 1800000`; iOS: Auto-Lock
  Never w Ustawieniach, przez `describe`).

## 8. Czego ten plan nie sprawdza

Głębokiej jakości odpowiedzi (to sekcje 3, 9, 11 planu release), wielu
języków, modeli wizyjnych, tabletów, Androida < 13. Jeśli w S3/S5 wyjdzie
fabrykacja liczby albo odmowa mimo dowodu — zapisać jako obserwację jakości
z eksportem JSON, bez wpływu na werdykt stabilności.
