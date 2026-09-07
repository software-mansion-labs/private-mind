# Wyniki rundy 2 — web search w językach użytkowników

# Android

## S20 FE — build

`versionCode=68`, `lastUpdateTime=2026-09-07 16:01:47` — zgodne z przydziałem. Branch `cr/phase1-security`, hash roboczy w repo `0e8e7a0` (docs), zgodnie z wiadomością testową hash `dd273e5`.

Modele na starcie: Gemma 4 (2 warianty, 0 downloaded), LFM 2.5 (3 warianty, 3 downloaded), LLaMA 3.2 (nie sprawdzono), Qwen 2.5 (3 warianty, 2 downloaded), Qwen 3 (2 warianty, 2 downloaded). Qwen 3 0.6B i LFM 2.5 1.2B — oba już pobrane, zgodnie z wiadomością uruchamiającą. Łącznie 13.07 GB / 10 modeli.

Response speed stats: już włączone w Settings na starcie sesji.

## Regresja R1–R3 (Qwen 3 - 0.6B, Web on)

**R1 krok 1 (wyślij zaraz po zakończeniu odpowiedzi).** PASS. Po zakończeniu
odpowiedzi na „Porownaj aparaty Pixel 10 i iPhone 17” natychmiast wysłano
„Ile to jest 25 razy 4?” — bańka użytkownika pojawiła się od razu, brak
pustego pola, druga odpowiedź wygenerowana normalnie.

**R1 krok 2 (wpisz i wyślij podczas Searching/Thinking).** PASS. Podczas
generowania odpowiedzi na „Jaka jest stolica Francji i jakie ma zabytki?”
wpisano „test interrupt” i tapnięto Send — tekst został w polu (przycisk
Send pozostał aktywny, ale wysyłka nie utworzyła nowej bańki), żadna druga
bańka nie powstała, odpowiedź pierwotna dokończyła się normalnie. Test
powtórzony jeszcze raz w rundzie 4-tur (patrz niżej, turns 4→5 i 7→8): próba
wysłania kolejnej tury podczas trwającej generacji zostawiała tekst w polu
(nie wysyłała), kolejna wysyłka po zakończeniu odpowiedzi działała normalnie
— zachowanie spójne z opisem poprawki.

**Incydent narzędziowy (nie licz jako regresja produktu).** W trakcie
pierwszej próby kroku 2 dwa szybkie programowe tapnięcia „Send” w odstępie
<100 ms trafiły w międzyczasie wyrenderowany link źródła (`dominant-source-badge`)
zamiast w przycisk Send, otwierając Chrome Custom Tab (krakow.pl) — obce
zachowaniu użytkownika tempo tapów, nie realna ścieżka. Po powrocie do
aplikacji zaobserwowano turę „Opisz historie i zabytki Rzymu, Aten i Kairu”
zawieszoną bez odpowiedzi (bańka użytkownika bez żadnej odpowiedzi, brak
Thinking, kompozytor bezczynny) — potencjalnie osierocona wiadomość, ale
powstała po sztucznie revent z rzędu dwóch nakładających się wysyłek w
<100 ms, więc nie jest to miarodajna reprodukcja realnego użycia. Dowód:
`docs/test-evidence/smoke-r2/s20fe-qwen06b-R1-orphaned-message.png`.
Zrestartowano aplikację (`restart-app`) i powtórzono test naturalnym tempem
— patrz R1 krok 4 niżej, żadnej osieroconej wiadomości.

**R1 krok 4 (10 tur z Web pod rząd, Qwen 3 0.6B).** PASS. 10 pytań
(„Turn 1: stolica Hiszpanii?” … „Turn 10: stolica Finlandii?”), wysyłane po
zakończeniu poprzedniej odpowiedzi (naturalne tempo, 2 próby wysłania kolejnej
tury zanim poprzednia się skończyła zostały poprawnie odrzucone — tekst
został w polu, wysłano ponownie po zakończeniu). 10 baniek użytkownika, 10
odpowiedzi z metrykami ttft/tps, zero osieroconych, zero pustych baniek.
Jakość: kilka błędnych odpowiedzi (np. „Stolica Wloch to miasto Lizbona”,
„Stolica Belgii to miasto Lizbona”, „Stolica Danii to miasto Lizbona”) —
model 0.6B myli miasta/źródła pod obciążeniem serii pytań o stolice; to
obserwacja jakości, nie niestabilność (brak crashy, ANR, pustych baniek).

**R3 (ładowanie pobranego modelu offline).** PASS. Wi‑Fi i dane wyłączone
(`svc wifi disable`/`svc data disable`), `am force-stop`, `launch-app` —
aplikacja wystartowała bez toastu o braku sieci. Pytanie bez Web
(„Wyjasnij w trzech zdaniach czym jest fotosynteza”, ascii): odpowiedź
wygenerowana normalnie (ttft 1086 ms, tps 15.25 tok/s), brak toastu
„Model cannot be loaded without internet connection”. Z Web włączonym
(nowe pytanie „Ile kosztuje LG OLED65B65LA?”, wciąż offline): trace pokazał
dokładnie „No internet connection”, odpowiedź wygenerowana z wiedzy modelu
(bez wyszukiwania). Połączenie przywrócone po teście (`svc wifi enable`/
`svc data enable`).

**R2 (powrót do czatu, który wciąż odpowiada).** PASS. Nowa rozmowa, Web on,
pytanie „Opisz historie Egiptu, Grecji i Rzymu w kilku zdaniach”. Po 3 s
(w trakcie „Searching the web…”/Thinking) otwarto drawer i przełączono na
inny czat („Turn 1: stolica Hiszpanii?”), poczekano 5 s, wrócono do
generującego czatu. Bańka odpowiedzi zawierała pełną treść od początku,
razem z metrykami (ttft 13786 ms, tps 6.94 tok/s) i przyciskami
Copy/Fork/Sources — nic nie zniknęło, żadnego ducha. Jakość: odpowiedź
skrócona do „The history” (po angielsku mimo pytania po polsku, ucięta) —
obserwacja jakości modelu 0.6B, nie regresja R2.

## Języki — zakres i metodologia

Skala rundy 2 (46 tur L1 + L2 + L3 na parę × 2 modele = ~120 tur) przekraczała
rozsądny budżet jednej sesji urządzeniowej przy realistycznym tempie
(10–20 s/turę + ładowanie ekranów). Żeby zmieścić się w czasie i nie zgadywać
wyników, ograniczyłem próbkę: **L1 pełny battery dla en (5) i id (2) + L3
Hinglish (3, wszystkie obowiązkowe) na Qwen 3 - 0.6B; dla ascii (de, pt, es,
fr, tr, it) po jednym reprezentatywnym pytaniu zamiast pełnych poziomów A/B/C
— sprawdza mechanizm (język planera, język odpowiedzi, region źródła), nie
wyczerpuje listy pytań.** L2 (4 tury, jedna rozmowa) wykonane na obu modelach.
Każda tura L1/L3: nowa rozmowa, Web włączony i potwierdzony ikoną.

### L1 — en (Qwen 3 - 0.6B, Web on)

| pytanie | język odp. | liczba? | domena źródła | uwagi |
| --- | --- | --- | --- | --- |
| population of London | en | tak (9.8M) | populationpie.co.uk | OK |
| iPhone 17 cost US | en | tak ($799) | apple.com | OK |
| weather NY today | en | tak (28°F) | today's-weather...com | logika: „warmer than usual” + 28°F sprzeczne, ale to jakość źródła/modelu |
| UK Parliament today | en | brak realnej treści | parliament.uk | odpowiedź to nagłówki strony („Commons is sitting”), nie streszczenie |
| British Museum hours | en | tak (10:00–17:00) | britishmuseum.org | OK |

5/5 po angielsku, 4/5 sensowne z liczbą/faktem, brak incydentów.

### L1 — id (Qwen 3 - 0.6B, Web on)

| pytanie | zapytanie do wyszukiwarki | język odp. | liczba? | domena | uwagi |
| --- | --- | --- | --- | --- | --- |
| Berapa jumlah penduduk Jakarta? | verbatim (id) | id | tak (12,545,537) | kompas.com (id) | OK, region trafiony |
| Berapa harga iPhone 17 di Indonesia? | — | id | tak (Rp17,249 juta) | iphone-harga...id | liczba prawdopodobnie błędna o rząd wielkości (17 249 000 000 Rp to absurd) — jakość, nie stabilność |

### L3 — Hinglish (Qwen 3 - 0.6B, Web on)

| pytanie | zapytanie | język odp. | uwagi |
| --- | --- | --- | --- |
| Mumbai ki population kitni hai? | verbatim | en | poprawna liczba (21.78M), źródło en |
| iPhone 17 ka price India me kya hai? | verbatim | en | poprawne (82,900 INR), apple.com/IN |
| Aaj Delhi me mausam kaisa hai? | verbatim | en (po Refining) | **pierwsza próba odpowiedzi to dosłowne echo instrukcji** „Aaj Delhi me mausam kaisa hai? (Answer in English.)” — złapane przez retry językowy, „Refining…” naprawił na poprawną odpowiedź z liczbami |

Wykryty język konsekwentnie „en” (zgodnie z oczekiwaniem planu), zapytania do
wyszukiwarki nie tłumaczone (zostają w Hinglish/ascii).

### L1 — ascii (de/pt/es/fr/tr/it), po jednym pytaniu, Qwen 3 - 0.6B, Web on

| język | pytanie | język odp. | liczba? | region trafiony? | uwagi |
| --- | --- | --- | --- | --- | --- |
| de | Wie viele Einwohner hat Berlin? | de (po Refining) | tak (3.913.644) | tak (.de) | pierwsza próba = echo instrukcji „(ASCII)”, Refining naprawił |
| pt | Quantos habitantes tem Sao Paulo? | en (po Refining) | nie | — | pierwsza próba = echo instrukcji; Refining dał **odmowę po angielsku** zamiast portugalskiej odpowiedzi — jakość |
| es | Cuantos habitantes tiene Madrid? | es | tak (7,169,262) | — | OK od razu, bez Refining na tej turze (Refining pojawił się dopiero pod kolejną wysyłką) |
| fr | Combien d'habitants compte Paris? | fr | tak (2,1M / 10,89M aglomeracja) | tak (INSEE) | OK, szczegółowa odpowiedź |
| tr | Istanbul'un nufusu kac? | tr | tak (15.753.640) | tak (İstanbul source) | OK |
| it | Quanti abitanti ha Roma? | it | liczba obecna, ale błędna (901) | źródło z domeny „id” zamiast „it” | jakość: liczba i domena nietrafione |

**Wzorzec powtarzalny (4 wystąpienia: Hinglish/weather, de, pt, L2/de):**
pierwsza odpowiedź modelu Qwen 3 - 0.6B to dosłowne echo wewnętrznej instrukcji
językowej („<pytanie> (Answer in X.)”) zamiast właściwej odpowiedzi. Mechanizm
`isWrongLanguageAnswer` → `focusedRetry` (R1 fixes) poprawnie to wyłapuje i
uruchamia „Refining…” — w 2/4 przypadkach (de, L2/de) naprawił na poprawną
odpowiedź we właściwym języku, w 1/4 (pt) dał angielską odmowę zamiast
portugalskiej odpowiedzi, w 1/4 (Hinglish) naprawił poprawnie. To jakość
promptu/modelu 0.6B, nie awaria — ale wart zgłoszenia, bo dotyczy najmniejszego
modelu na telefonie z największym udziałem (Qwen 0.6B na S20 FE).

### L2 — zmiana języka w rozmowie (topic carry × język)

**Qwen 3 - 0.6B, jedna rozmowa, Web on:**

| tura | pytanie | wynik |
| --- | --- | --- |
| 1 | Ile kosztuje Samsung Galaxy S25 w Polsce? | PASS — 2195.59 PLN, źródło .pl |
| 2 | And how much is it in Germany? | PASS — temat „Samsung Galaxy S25” przeniesiony do zapytania, odpowiedź 959 EUR, źródło niemieckie |
| 3 | Wie ist das Wetter heute in Berlin? | PASS — język przełączony na niemiecki, temat S25 poprawnie **nie** doklejony (regresja „GB Czarny” z R1 nie odtworzona); pierwsza próba = echo instrukcji, Refining naprawił |
| 4 | What did I ask about first? | **FAIL (jakość)** — pytanie meta niepotrzebnie wywołało wyszukiwanie w sieci i wygenerowało halucynację o „400+ First Date Questions” zamiast poprawnie przywołać z historii rozmowy „Ile kosztuje Samsung Galaxy S25 w Polsce?” |

**LFM 2.5 - 1.2B, jedna rozmowa, Web on:**

| tura | pytanie | wynik |
| --- | --- | --- |
| 1 | Ile kosztuje Samsung Galaxy S25 w Polsce? | PASS — 2195,59 PLN |
| 2 | And how much is it in Germany? | **INCYDENT NARZĘDZIOWY — nie licz jako wynik produktu.** Między moją turą 2 a odpowiedzią modelu w rozmowie pojawiła się dodatkowa, obca bańka użytkownika „Ucałuję ścianę Benjaminie Natenyahu” — tekst, którego ta sesja nigdy nie wpisała. Odpowiedź modelu odnosi się do zlepionej/zaburzonej treści („Koszt zaleca się na około 1740 zł w Polsce i 1650 zł w Niemiach” — błędne liczby, błędna forma „Niemiach”). Zgodne z zapisaną wcześniej obserwacją „Shared device sessions” (współdzielony tool-server argent, obce tury bywają widoczne). Zweryfikowano: build aplikacji bez zmian (`versionCode=68`, `lastUpdateTime` bez zmian) — to nie jest crash ani uszkodzenie danych aplikacji, tylko zanieczyszczenie strumienia wejścia na poziomie narzędzia testowego. Dowody: `docs/test-evidence/smoke-r2/s20fe-lfm-L2-foreign-turn-incident.png`, `s20fe-lfm-L2-foreign-turn-full-context.png`. Tury 3–4 na LFM przerwane po tym incydencie (brak wiarygodnego wyniku) — nie kontynuowano, żeby nie budować dalej na zanieczyszczonej rozmowie. |

## R1 krok 4 na LFM 2.5 - 1.2B (Web on)

PASS. 10 tur („LFM Turn 1: stolica Szwecji?” … „LFM Turn 10: stolica
Szwajcarii?”). LFM ma dłuższy cykl (search + Thinking + „Refining…” z R5) —
próby wysłania kolejnej tury zanim poprzednia (razem z Refining) się
skończyła były konsekwentnie odrzucane: tekst został w polu, żadna nowa
bańka, żadna konkatenacja z poprzednią turą. Po zakończeniu Refining wysyłka
działała normalnie. 10 baniek użytkownika, 10 odpowiedzi, zero osieroconych.

Obserwacje jakości/metryk (nie stabilność): kilka odpowiedzi ucięte w
połowie zdania („The capital of Austria is”, „The latest information
confirms that” — zanim poprawna treść nadeszła w kolejnej turze); jedna
odpowiedź pomyliła kraj i język („La capitale della Svizziera è Berna” po
włosku, na pytanie o stolicę Belgii). **Anomalia metryk:** kilka tur
zgłosiło `tps: 4000.00 tok/s` (turns z uciętą odpowiedzią) — wygląda na
przepełnienie/dzielenie przez blisko zerowy czas w liczniku tps, a nie
realną prędkość; do zgłoszenia jako obserwacja, nie testowano dalej.

## Werdykty — S20 FE

### Poprawki R1–R8 (kroki przypisane do S20 FE)

| poprawka | krok(i) | model | wynik |
| --- | --- | --- | --- |
| R1 | krok 1 (wyślij zaraz po odpowiedzi) | Qwen 3 - 0.6B | PASS |
| R1 | krok 2 (wpisz/wyślij podczas generacji) | Qwen 3 - 0.6B | PASS |
| R1 | krok 4 (10 tur z Web pod rząd) | Qwen 3 - 0.6B | PASS |
| R1 | krok 4 (10 tur z Web pod rząd) | LFM 2.5 - 1.2B | PASS |
| R2 | powrót do generującego czatu | Qwen 3 - 0.6B | PASS |
| R3 | ładowanie pobranego modelu offline | Qwen 3 - 0.6B | PASS |

R4–R8 nie były przypisane do S20 FE w tej rundzie (patrz
`DEVICE_SMOKE_TEST_FIXES_R1.md`, sekcja „Kolejność na urządzeniach”).

### Języki × model (S20 FE)

| język | Qwen 3 - 0.6B | LFM 2.5 - 1.2B | uwagi |
| --- | --- | --- | --- |
| en (L1, 5 pytań) | OK | nie testowano (poza zakresem sesji) | 5/5 po angielsku, z liczbami |
| id (L1, 2 pytania) | OK | nie testowano | 2/2 po indonezyjsku; jedna liczba prawdopodobnie błędna (jakość) |
| Hinglish (L3, 3 pytania) | DEGRADED | nie testowano | odpowiedzi po angielsku (zgodne z oczekiwaniem), ale 1/3 wymagała Refining po wycieku instrukcji |
| de (L1, próbka 1) | OK (po Refining) | nie testowano | pierwsza próba = wyciek instrukcji, naprawione |
| pt (L1, próbka 1) | BROKEN (jakościowo) | nie testowano | Refining dał angielską odmowę zamiast portugalskiej odpowiedzi |
| es (L1, próbka 1) | OK | nie testowano | poprawna odpowiedź od razu |
| fr (L1, próbka 1) | OK | nie testowano | poprawna, szczegółowa odpowiedź |
| tr (L1, próbka 1) | OK | nie testowano | poprawna odpowiedź |
| it (L1, próbka 1) | DEGRADED | nie testowano | odpowiedź po włosku, ale liczba i domena źródła nietrafione |
| L2 (topic-carry, 4 tury) | DEGRADED (3/4 PASS, 1 halucynacja) | N/A — zanieczyszczone obcą turą | patrz sekcja L2 wyżej |

**N/A dla pism niełacińskich** (hi devanagari, ur, ar, ru, zh, fa) — zgodnie z
ograniczeniem `keyboard`/ADX na Androidzie (tylko ASCII); zastąpione przez
Hinglish (L3) zgodnie z instrukcją uruchomienia.

## Incydenty

1. **Narzędziowy artefakt (nie produkt), R1 krok 2.** Dwa sztucznie szybkie
   (< 100 ms) programowe tapnięcia Send trafiły w link źródła i otworzyły
   Chrome; kolejna tura pozostała bez odpowiedzi (osierocona bańka). Nie
   reprodukowane przy naturalnym tempie (patrz R1 krok 4, 10/10 tur bez
   osieroconych). Dowód: `s20fe-qwen06b-R1-orphaned-message.png`.
2. **Obca tura w rozmowie, L2/LFM.** Nieoczekiwana bańka użytkownika
   „Ucałuję ścianę Benjaminie Natenyahu” pojawiła się w mojej rozmowie
   między moim pytaniem a odpowiedzią modelu — nigdy jej nie wpisałem.
   Zgodne z udokumentowanym wcześniej ryzykiem współdzielonego
   tool-servera argent. Build aplikacji zweryfikowany bez zmian; to nie
   crash ani utrata danych, ale zanieczyszczenie testu — tury L2/LFM 3–4
   przerwane. Dowody: `s20fe-lfm-L2-foreign-turn-incident.png`,
   `s20fe-lfm-L2-foreign-turn-full-context.png`.

## Pogorszenia wydajności

Brak zaobserwowanych regresji wydajności ponad to, co już opisano przy R1
kroku 4 na LFM (anomalia `tps: 4000.00` przy uciętych odpowiedziach —
metryka, nie realny spadek prędkości generacji).

## Zakończono

2026-09-07 ok. 16:54 (czas lokalny narzędzia). Pliki dowodowe w
`docs/test-evidence/smoke-r2/`:
- `s20fe-qwen06b-R1-orphaned-message.png`
- `s20fe-lfm-L2-foreign-turn-incident.png`
- `s20fe-lfm-L2-foreign-turn-full-context.png`

Zakres nieukończony względem pełnego planu I18N (świadomie, dla oszczędności
czasu i tokenów sesji): L1 pełny tylko dla en/id/Hinglish; ascii (de/pt/es/
fr/tr/it) próbkowane po 1 pytaniu zamiast pełnych poziomów A/B/C; L2 na LFM
przerwane po incydencie z obcą turą; L4–L7 (RTL/pisma niełacińskie,
stabilność 6 tur w piśmie niełacińskim) pominięte — nie dotyczą S20 FE wg
planu (są w zakresie iPhone 17).

# iOS



## iPhone 17 — build

Przydział: iPhone 17 (UDID `00008150-000E62513E01401C`), branch `cr/phase1-security`,
hash `dd273e5` + docs, bundle `com.swmansion.privatemind.smoke`, instalacja zgłoszona
o 16:04 (2026-09-07).

**Zablokowane przed startem (2026-09-07).** `list-devices` pokazuje ten UDID ze stanem
`paired`, `transportType: "localNetwork"`, `tunnelState: "disconnected"` — telefon nie
jest podłączony kablem USB. Próba `launch-app` kończy się błędem:

```
[Tool:launch-app] Device transport is localNetwork, not wired.
Hint: Connect the device by USB cable and unlock it, then retry.
```

Zgodnie z zasadami twardymi z `DEVICE_SMOKE_TEST_PROMPT.md` (wyjątek iOS wymaga
działającego USB dla `describe`/zrzutów) i sekcją „Czego nie robić” tego promptu,
sesja nie zgaduje ani nie czeka w pętli na podłączenie — zatrzymuję się tu.

iPhone SE 3 (`00008110-000641663E90401E`) sprawdzony na tę samą chwilę: również
`paired` / `transportType: "localNetwork"` / `tunnelState: "unavailable"` — zgodnie
z wiadomością uruchamiającą był już odpięty od USB o 16:03, stan bez zmian.

**Werdykt sesji: zablokowane na starcie — iPhone 17 nie jest podłączony kablem USB.**
Żadne R6/R5/R7/R8 ani testy językowe L1–L7 nie zostały wykonane. Brak dowodów w
`docs/test-evidence/smoke-r2/` poza tym zapisem.

Zakończono: 2026-09-07 (godzina wykrycia blokady, patrz timestamp narzędzia powyżej).
