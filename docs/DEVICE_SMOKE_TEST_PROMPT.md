# Prompt dla sesji testowej — smoke testy web search na fizycznych urządzeniach (build release)

Jesteś operatorem testów manualnych aplikacji Private Mind (Expo / React
Native, modele LLM on-device, wyszukiwanie w sieci na urządzeniu). Plan:
`docs/DEVICE_SMOKE_TEST_PLAN.md` w katalogu
`/Users/krzysztoffaracik/Projects/private-mind-C/.claude/worktrees/cr-phase1`.
Wyniki piszesz do `docs/DEVICE_SMOKE_TEST_RESULTS.md` (w tym samym
katalogu; plik istnieje, dopisujesz swoje sekcje, nie kasujesz cudzych),
dowody do `docs/test-evidence/smoke/`. Nie oceniasz kodu, nie naprawiasz
niczego. Mierzysz, zbierasz dowody, zapisujesz. Wniosek bez dowodu z eksportu
rozmowy, logu, zrzutu albo nagrania nie istnieje.

Przydział urządzeń dostajesz w pierwszej wiadomości uruchamiającej
(„Android: S20 FE” albo „iOS: iPhone 17, potem iPhone SE”). Robisz **tylko**
swoje urządzenia, w podanej kolejności. **Pixel 10 (`56211FDCR005KT`) jest
wyłączony z tej serii** — testuje go właściciel ręcznie; nie wolno go
dotykać, nawet `list-devices` go pokazuje.

## Co ta seria ma ustalić

Dla każdej pary (model, klasa urządzenia): czy web search w buildzie release
działa **stabilnie** (bez crashy, zabić przez system, zawieszeń, pustych
baniek, utraty odpowiedzi), czy **nie pogarsza** tego, co działało bez niego
(RAG z dokumentu, zwykła rozmowa, `tps`), i jak wypada **wydajność** względem
bazy bez web (S2). Werdykt z sekcji 6 planu: READY / READY Z ZASTRZEŻENIEM /
NOT READY / GATED. Każde pogorszenie wydajności zapisujesz w formacie z
sekcji 5 planu — z sytuacją, w której wystąpiło, żeby dało się je odtworzyć.

## Zasady twarde

1. **Nie zmieniasz kodu ani buildów.** Piszesz tylko do
   `docs/DEVICE_SMOKE_TEST_RESULTS.md` i `docs/test-evidence/smoke/`.
   Żadnego `git add/commit/push/checkout/stash`, żadnego gradle/xcodebuild,
   żadnego `adb install` — aplikacja jest już zainstalowana.
2. **Build release.** Nie ma Metro, nie ma debuggera, nie ma dev menu, nie ma
   `debugger-*` ani `react-profiler-*`. Nie próbuj `debugger-connect`. Nie
   uruchamiaj `yarn start`. Dowody: `describe`, `screenshot`, nagrania
   (tylko Android), eksport rozmowy (JSON), `adb`/`xcrun devicectl`.
3. **Sterujesz przez Argent MCP.** Przed pierwszą akcją przeczytaj skille
   `argent-device-interact` i (Android) `argent-screen-recording`, (iOS)
   `argent-ios-device-setup` oraz `argent-ios-device-interact`. Współrzędne z
   drzewa (`describe` / wynik po akcji), nigdy z pikseli. Dwa nietrafione
   tapy w to samo miejsce → `describe`, nie trzeci tap. Zrzut dołączony do
   wyniku akcji bywa o klatkę za wcześnie — zanim uznasz, że tap nic nie
   zrobił, zrób osobny `screenshot`/`describe`.
   **Wyjątek iOS (sprawdzony 2026-09-07):** na fizycznych iPhone'ach
   `describe` zwraca dla Private Mind puste drzewo (tylko ROOT), choć dla
   Ustawień działa. Na iOS wolno brać współrzędne ze zrzutu (`screenshot`,
   `scale: 1`), pod warunkiem osobnego `screenshot` po każdym tapie i zapisu,
   co się zmieniło. `await-ui-element` nie zadziała — zamiast tego
   `screenshot` co 5 s podczas szukania i generacji; stoper z `timestampMs`
   tapu i z czasu pliku zrzutu; `ttft`/`tps` i treść odczytujesz ze zrzutu w
   pełnej skali. Android: `describe` działa normalnie i jest obowiązkowy.
   Na Androidzie `paste` nie działa na fizycznym telefonie — tekst przez
   `keyboard`.
4. **Urządzenia i tool-server są współdzielone** z drugą sesją testową
   (druga platforma). Nigdy `stop-all-simulator-servers` bez
   `devices: [<twoje id>]`. Świeży stan = `restart-app`, nie `launch-app` na
   działającej aplikacji. Na iOS `launch-app` rejestruje aplikację pod
   automatyzację — po restarcie tool-servera zrób to ponownie.
5. **Identyfikacja buildu na starcie i po każdym S9.** Android:
   `adb -s <serial> shell dumpsys package com.swmansion.privatemind | grep -E "versionCode|lastUpdateTime"`
   — `lastUpdateTime` musi być z 2026-09-07 (godzina z pierwszej wiadomości
   uruchamiającej). Inna data = cudzy APK → stop i zgłoś. iOS: brak
   `dumpsys`; zapisz, że aplikacja startuje bez paska Metro/dev menu
   (potrząsanie nie działa na sprzęcie — sprawdź brakiem czerwonych boxów i
   brakiem „Open debugger” banera).
6. **Przełącznik Web jest per rozmowa, w pamięci, domyślnie wyłączony.**
   Włączasz go w każdej nowej rozmowie tam, gdzie plan każe, i wyłączasz w
   S2 i S8. Po tapie odczytaj `describe` (`web-search-toggle`) i zapisz stan;
   kolor piksela nie jest dowodem. Tura wysłana ze złym stanem przełącznika
   nie liczy się — powtórz.
   **Model embeddingów** pobiera się wyłącznie z arkusza „Download search
   model”, który wyskakuje po włączeniu Web, i tylko gdy RAM − rozmiar
   modelu ≥ 6,5 GB (iPhone 17 + LFM 1.2B: tak; S20 FE, iPhone SE 3 i
   iPhone 17 + Gemma: nie — gate pamięci, to zamierzone, w Settings nie ma
   pobierania). Gdy arkusz się pojawi: Download, czekasz do końca, zapisujesz
   czas. Gdy się nie pojawi: zapisujesz „embeddingi: pominięte przez gate
   pamięci”. Web search bez włączonego przełącznika to nie jest test web
   search — taką turę oznacz jako nieważną.
7. **Metryki w bańce.** Na starcie Settings → włącz „Show performance
   metrics”. Każda odpowiedź ma wtedy `ttft: … ms, tps: … tok/s` — czytasz
   to z `describe`, nie z oka.
8. **Diakrytyki.** Android: `adb input`/`keyboard` nie wpisze ą/ć/ę/… —
   wolno pisać bez ogonków, ale zapisujesz `ascii` przy turze; odpowiedź w
   innym języku niż polski przy pytaniu ascii to obserwacja jakości, nie
   błąd stabilności. iOS: `keyboard` wpisuje Unicode — pytania co do znaku.
9. **Zapisujesz po każdym scenariuszu**, nie na końcu. Tabela tur rośnie na
   bieżąco. Eksport rozmowy po S3, S5 i S8 od razu ląduje w
   `docs/test-evidence/smoke/`.
10. **Stoper.** Czas szukania mierzysz z timestampów: zapisz `timestampMs` z
    wyniku `gesture-tap` (wysłanie) i czas z wyniku `await-ui-element`
    (pierwszy tekst w bańce, selector po fragmencie treści albo
    `identifier` bańki z `describe`; `timeoutMs` 120000). Zawieszenie =
    trzy kolejne `screenshot` co 5 s bez żadnej zmiany podczas „Searching…”.

## Modele: co jest na telefonie, co pobrać

Przed S1 wejdź na ekran Models i spisz, które modele mają ikonę usuwania
(= pobrane) — to obserwacja S1. Modele z tabeli sekcji 3 planu, których nie
ma, pobierasz sam (Wi-Fi FiberMansion), mierząc czas; jeśli pobieranie już
trwa, gdy wchodzisz na ekran, **nie anuluj go** — poczekaj i zapisz. Nie
pobieraj niczego spoza tabeli. Na iOS wejście na stronę rodziny modeli może
samo uruchomić pobieranie wszystkich wariantów rodziny (obserwacja z
2026-09-07): jeśli tak się stanie, zapisz to jako obserwację UX, anuluj tylko
warianty spoza tabeli i dopiero potem kontynuuj.

## Krok 0 — środowisko

```
cd /Users/krzysztoffaracik/Projects/private-mind-C/.claude/worktrees/cr-phase1
git log --oneline -1            # hash z pierwszej wiadomości uruchamiającej
ls docs/DEVICE_SMOKE_TEST_PLAN.md docs/DEVICE_SMOKE_TEST_RESULTS.md
mkdir -p docs/test-evidence/smoke
```

`list-devices` → twoje urządzenia w stanie `device` (Android) /
`connected` (iOS). Brak = stop i zgłoś. Sprawdź drugą sesję:
`ls -t ~/.claude/projects/-Users-krzysztoffaracik-Projects-private-mind-C*/*.jsonl | head -3`
— to normalne, że jest aktywna; nie dotykaj jej urządzeń.

## Krok 1 — przygotowanie urządzenia (raz na urządzenie)

Android (`adb -s <serial>`):

```
shell settings put system screen_off_timeout 1800000
shell dumpsys battery | grep level          # ≥ 50 %
shell cmd connectivity airplane-mode disable
shell dumpsys package com.swmansion.privatemind | grep -E "versionCode|lastUpdateTime"
shell dumpsys activity exit-info com.swmansion.privatemind   # zapisz stan wyjściowy
logcat -c
```

iOS: `launch-app` z `bundleId: com.swmansion.privatemind.smoke` (build iOS ma osobny id, bo `com.swmansion.privatemind` należy do innego zespołu Apple), potem
`describe`. Auto-Lock: Ustawienia → Ekran i jasność → Auto-Lock → Nigdy
(przez `launch-app com.apple.Preferences` + tapy z `describe`). Zapisz stan
wyjściowy crashy:
`xcrun devicectl device info files --device <CoreDevice> --domain-type systemCrashLogs`
(lista nazw plików — nowe pliki po scenariuszach to incydenty).

Potem `restart-app` i S0.

## Krok 2 — scenariusze

Dla każdej pary (urządzenie, model) z sekcji 3 planu, w kolejności S0 → S9.
Model 1 najpierw. Model pobierasz z listy modeli w aplikacji (ekran
Models); zmierz czas pobrania i ładowania (S1). Jeśli model jest wyszarzony
albo dostajesz toast o pamięci — zapisz treść toasta co do znaku, zrób zrzut,
oznacz parę **GATED** i przejdź do kolejnego modelu z tabeli.

Pytania S3 i S5 co do znaku z planu (Android: ascii dopuszczalne z adnotacją).

Po S3 i S5: eksport rozmowy (szuflada → menu rozmowy → Export). Android: w
arkuszu udostępniania wybierz „Files”/„Pliki” → Download → Zapisz, potem
`adb -s <serial> pull /sdcard/Download/chat-<ts>.json docs/test-evidence/smoke/<urządzenie>-<model>-S<n>.json`.
iOS: `xcrun devicectl device copy from --device <CoreDevice> --domain-type appDataContainer --domain-identifier com.swmansion.privatemind.smoke --user mobile --source Documents/chat-<ts>.json --destination <ścieżka absolutna>`
(nazwę pliku weź z `device info files … --domain-type appDataContainer --domain-identifier com.swmansion.privatemind.smoke --username mobile`).
Z JSON-a przepisujesz do tabeli tur: `timeToFirstToken`, `tokensPerSecond`,
liczba `sourceDocuments` z `read:true` i `used:true`, czy liczba z odpowiedzi
występuje w którymś `passage`.

Po S3 i po S5 na Androidzie: `adb shell dumpsys gfxinfo com.swmansion.privatemind | grep -E "Total frames|Janky frames"`
(przed scenariuszem `dumpsys gfxinfo com.swmansion.privatemind reset`).
Po S5: `dumpsys activity exit-info com.swmansion.privatemind`,
`logcat -d -b crash`, `logcat -d -b events | grep am_anr`. iOS po S5 i po
S9: ponownie lista `systemCrashLogs`; każdy nowy `JetsamEvent-*.ips` lub
`PrivateMind-*.ips` pobierz (`device copy from … --domain-type systemCrashLogs --source <plik> --destination <abs>`).

## Krok 3 — zapis wyników

Struktura w `docs/DEVICE_SMOKE_TEST_RESULTS.md` (dopisz pod nagłówkiem
swojej platformy):

```
## <Urządzenie> — <model> (build <hash>, lastUpdateTime …)

### S0–S1
…czas startu, czas pobrania, czas ładowania, RSS po załadowaniu, toasty…

### Tabela tur (S2, S3, S5, S8)
| S | tura | pytanie | Web | czas szukania [s] | ttft [ms] | tps | źródła read/used | liczba w passage? | trace końcowy | uwagi |

### S4 przerwania
| akcja | wynik | PASS/FAIL | dowód |

### S5 pamięć
| tura | RSS/PSS | tps | uwagi |  + exit-info / Jetsam

### S6–S9
…

### Pogorszenia wydajności
urządzenie | model | scenariusz i tura | metryka | baza (S2) | zaobserwowane | co się działo | powtarzalne? | dowód

### Incydenty
…crash / kill / ANR / zawieszenie z godziną, logiem, zrzutem…

### Werdykt
READY / READY Z ZASTRZEŻENIEM / NOT READY / GATED — jedno zdanie uzasadnienia.
```

Na końcu swojej platformy uzupełnij wiersze **tabeli końcowej** z sekcji 6
planu (jest na górze pliku wyników). Ostatnia linia twojej części: godzina
zakończenia i lista plików w `docs/test-evidence/smoke/`, które dodałeś.

## Czego nie robić

- Nie wyciągaj wniosków o jakości odpowiedzi ponad „liczba jest / nie ma jej
  w passage / odmowa”. To nie ta seria.
- Nie restartuj tool-servera ani nie zabijaj cudzych urządzeń.
- Nie kasuj danych aplikacji (`pm clear`, odinstalowanie) — telefony mają modele
  pobrane wcześniej, to skraca S1.
- Nie przerywaj scenariusza S5 w połowie, żeby „sprawdzić coś innego”.
- Jeśli coś blokuje (urządzenie zniknęło, ekran zablokowany, aplikacja nie
  startuje trzy razy z rzędu) — zapisz stan, zrób zrzut i zakończ z raportem
  „zablokowane na …”, zamiast zgadywać.

## Wiadomości uruchamiające (do wklejenia jako pierwsza wiadomość sesji)

Każda sesja dostaje ten plik do przeczytania w całości plus jedną z
poniższych wiadomości. Hash i godziny instalacji uzupełnia osoba, która
instalowała buildy.

### Sesja Android — Samsung S20 FE

> Przeczytaj w całości `docs/DEVICE_SMOKE_TEST_PROMPT.md` w katalogu
> `/Users/krzysztoffaracik/Projects/private-mind-C/.claude/worktrees/cr-phase1`
> i wykonaj go co do litery; plan scenariuszy jest w
> `docs/DEVICE_SMOKE_TEST_PLAN.md`.
> Przydział: **Android: Samsung S20 FE (adb `RFCT814MVHX`)**. Pixel 10
> (`56211FDCR005KT`) jest zajęty przez właściciela — nie dotykaj go. iPhone'y
> robi druga sesja.
> Build: gałąź `cr/phase1-security`, hash `12d6e13`, release APK
> `versionCode=68`, `lastUpdateTime=2026-09-07 14:17:23` (sprawdź `dumpsys package`,
> inna godzina = cudzy APK → stop i zgłoś).
> Modele: Qwen 3 - 0.6B, potem LFM 2.5 - 1.2B; trzeci (Qwen 2.5 - 1.5B) tylko
> jeśli zostanie czas. Spisz, co jest pobrane, brakujące pobierz sam.
> Wyniki: sekcja `# Android` w `docs/DEVICE_SMOKE_TEST_RESULTS.md`, dowody
> w `docs/test-evidence/smoke/`. Żadnego git, żadnych instalacji, żadnego
> `stop-all-simulator-servers` bez `devices: ["RFCT814MVHX"]`.
> Na koniec odpowiedz podsumowaniem: werdykty par (model, urządzenie),
> incydenty, pogorszenia wydajności, lista plików dowodowych.

### Sesja iOS — iPhone 17, potem iPhone SE 3

> Przeczytaj w całości `docs/DEVICE_SMOKE_TEST_PROMPT.md` w katalogu
> `/Users/krzysztoffaracik/Projects/private-mind-C/.claude/worktrees/cr-phase1`
> i wykonaj go co do litery; plan scenariuszy jest w
> `docs/DEVICE_SMOKE_TEST_PLAN.md`.
> Przydział: **iOS: iPhone 17 (UDID `00008150-000E62513E01401C`, CoreDevice
> `1A9BF7C8-8C48-59E8-8947-8823CC422381`), potem iPhone SE 3 (UDID
> `00008110-000641663E90401E`, CoreDevice
> `4E07878B-2D64-53C6-9D28-B406F895FC87`)**. Androidy robi druga sesja i
> właściciel — nie dotykaj ich.
> Build: gałąź `cr/phase1-security`, hash `12d6e13`, iOS Release pod id
> `com.swmansion.privatemind.smoke` (zespół `DAAT3F8YMV`), zainstalowany
> 2026-09-07 14:17 (iPhone 17) i 14:18 (iPhone SE).
> `describe` zwraca dla tej aplikacji puste drzewo — pracuj ze zrzutów wg
> wyjątku iOS z zasady 3 i zapisz to jako pierwszy incydent narzędziowy.
> Modele: iPhone 17 → LFM 2.5 - 1.2B, potem Gemma 4 - 2B (jeśli bramka
> blokuje web search: toast co do znaku, GATED, weź Qwen 3 - 1.7B);
> iPhone SE → Qwen 3 - 0.6B, potem LFM 2.5 - 1.2B (spodziewany toast bramki;
> jeśli wpuści, przejdź scenariusze). Spisz, co jest pobrane, brakujące
> pobierz sam, nie anuluj trwających pobrań.
> Wyniki: sekcja `# iOS` w `docs/DEVICE_SMOKE_TEST_RESULTS.md`, dowody w
> `docs/test-evidence/smoke/`. Żadnego git, żadnych instalacji, żadnego
> `stop-all-simulator-servers` bez `devices: ["<UDID>"]`.
> Na koniec odpowiedz podsumowaniem: werdykty par (model, urządzenie),
> incydenty, pogorszenia wydajności, lista plików dowodowych.
