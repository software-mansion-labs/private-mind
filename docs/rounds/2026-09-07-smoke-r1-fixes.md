# Poprawki po rundzie 1 smoke testów — co zmieniono i jak to sprawdzić

Commity na `cr/phase1-security`: `f332918`, `e1ae6cb`, `8e5001d`, `e5106b5`,
`17467b2`. Automatyczne testy: `npx jest` (2180 zielonych), nazwy testów niżej
wskazują regresję, którą każda poprawka zamyka.

## R1 — jedna tura naraz (S20 FE: zgubione i zdublowane wiadomości; Pixel: stara odpowiedź w nowym czacie)

**Zmiana.** `sendChatMessage` odrzuca wysyłkę, gdy tura jest otwarta, i zwraca,
czy przyjął wiadomość. Bańka użytkownika i przycisk Stop pojawiają się od razu,
zanim store czeka na ładowanie modelu i na digest. Composer przywraca tekst i
pokazuje „Wait for the response to finish or stop it first.”, gdy wysyłka
została odrzucona.

**Testy jednostkowe.** `llmStore.test.ts` → „refuses a second send while the
first turn is still answering”, „shows the message and the stop state while a
model switch is still loading”; `ChatBar.test.tsx` → „puts the text back and
says why instead of dropping it silently”.

**Na urządzeniu (S20 FE, Qwen 3 0.6B, Web on).**

1. Zadaj pytanie z Web, które daje długą odpowiedź (np. „Porównaj aparaty
   Pixel 10 i iPhone 17”). Gdy tylko odpowiedź się zakończy, natychmiast wpisz
   kolejne pytanie i tapnij Send. Oczekiwane: bańka użytkownika pojawia się od
   razu, ikona Stop widoczna, potem odpowiedź. Nigdy: puste pole bez bańki.
2. W trakcie „Searching…” wpisz tekst i tapnij Send. Oczekiwane: tekst zostaje
   w polu, toast „Wait for the response…”. Po Stop wysyłka działa.
3. Pixel: patrz R9 — wysyłka w innym czacie zatrzymuje starą turę zamiast
   pokazywać toast.
4. Powtórz 10 tur z Web w jednej rozmowie (S5). Oczekiwane: 10 baniek
   użytkownika, 10 odpowiedzi, zero osieroconych.

## R2 — powrót do czatu, który wciąż odpowiada

**Zmiana.** Wszystko, co zostało wystreamowane dla generującego czatu, jest
odkładane; ponowne otwarcie tego czatu pokazuje dotychczasową treść.

**Test.** `llmStore.test.ts` → „shows everything streamed so far when the user
comes back to the chat that is still answering”.

**Na urządzeniu.** Pytanie z długą odpowiedzią, po 3 s drawer → inny czat,
po 5 s wróć. Oczekiwane: bańka zawiera tekst od początku odpowiedzi.

## R3 — pobrany model ładuje się offline (S20 FE S6)

**Zmiana.** `loadModel` pyta o sieć tylko wtedy, gdy model nie jest pobrany.

**Testy.** „loads an already downloaded model without asking the network”,
„still refuses a model that is not on the device while offline”.

**Na urządzeniu.** Wyłącz Wi‑Fi i dane, wymuś zamknięcie aplikacji, uruchom,
zadaj pytanie bez Web. Oczekiwane: odpowiedź, bez toastu „Model cannot be
loaded without internet connection”. Z Web włączonym: trace „No internet
connection”, odpowiedź z wiedzy modelu.

## R4 — pusta odpowiedź nie zostawia ducha i nie wyładowuje modelu (iPhone SE S2)

**Zmiana.** Odpowiedź pusta po zdjęciu bloków think usuwa placeholder, pokazuje
„Failed to generate a response” z Retry i zostawia model załadowany.

**Testy.** „keeps the model loaded when the answer came back empty”, „drops the
bubble when the model only looped inside an unterminated think block”.

**Na urządzeniu (iPhone SE, Qwen 3 0.6B, Web off).** „Wyjaśnij w trzech
zdaniach, czym jest fotosynteza.” do skutku pętli. Oczekiwane: albo odpowiedź
z metrykami, albo wiersz błędu z Retry; nigdy pusta bańka z etykietą modelu.
Retry rusza od razu, bez ponownego ładowania modelu.

## R5 — budżet czasu na „Refining…” (iPhone 17, Qwen 3 1.7B, S5 tura 2)

**Zmiana.** Gdy główna generacja trwała dłużej niż 40 s, dopytki (retry
językowy, dowodowy, aspektowy) są pomijane z logiem „over its time budget”.

**Test.** „skips the refining pass when the first answer already used up the
time budget”.

**Na urządzeniu.** 6 tur z Web pod rząd na Qwen 3 1.7B. Oczekiwane: żadna tura
nie przekracza 60 s od wysłania do końca; brak raportu `cpu_resource` w
`devicectl … systemCrashLogs`. Uwaga: Stop podczas prefill nadal nie przerywa
natychmiast, to ograniczenie executorch; poprawka skraca okno, nie usuwa go.

## R6 — próg 8 GB liczony od nominalnego RAM (iPhone 17, Gemma 4 2B)

**Zmiana.** Zadeklarowane progi porównywane z RAM zaokrąglonym w górę do
pełnych GB.

**Testy.** `modelCompatibility.test.ts` → „lets an 8 GB iPhone that reports
7.6 GB search with Gemma 4 2B”, „still keeps Gemma 4 2B off web search on a
6 GB phone reporting 5.5 GB”.

**Na urządzeniu (iPhone 17).** Wybierz Gemma 4 2B, włącz Web. Oczekiwane:
przełącznik włącza się bez toastu. Potem S3 (5 pytań) i S5 (6 tur) —
kluczowe: brak `JetsamEvent-*` w crash logach po serii. To jedyna poprawka,
która może pogorszyć stabilność; jeśli pojawi się jetsam, próg wraca do 8 GB
surowego.

## R7 — przycisk „+” mówi, dlaczego nie działa (iPhone 17, LFM)

**Zmiana.** Tap w „+” podczas ładowania modelu pokazuje „Wait for the model to
finish loading.”.

**Test.** `ChatBarActions.test.tsx` → „says the model is still loading instead
of ignoring the tap while disabled”.

**Na urządzeniu.** Wybierz inny model, natychmiast tapnij „+”. Oczekiwane:
toast. Po załadowaniu tap otwiera arkusz załączników. Jeśli arkusz nadal się
nie otwiera po załadowaniu, to inny błąd — zapisz stan i zgłoś.

## R8 — region wyszukiwarki z języka pytania (ceny w PLN z Amazon US)

**Zmiana.** DuckDuckGo dostaje `kl=` wyprowadzone z języka pytania (pl‑pl,
de‑de, in‑en, pk‑en …); angielski bez regionu.

**Testy.** `webViewScrapeProvider.test.ts` → „searchUrlFor”; `runWebSearch.test.ts`
→ „search region follows the question language”.

**Na urządzeniu.** „Ile kosztuje Samsung Galaxy S25 w Polsce?” Oczekiwane:
dominujące źródło z domeny .pl, cena w zł. Runda 2 sprawdza to samo dla de,
hi, ur i pozostałych.

## R9 — wyjście z czatu nie zabija tury (Pixel: drawer → New chat → powrót)

**Zmiana.** Blur ekranu czatu nie przerywa generowania. Tura kończy się w
swoim czacie i jest tam po powrocie. Wysłanie wiadomości w **innym** czacie
przerywa poprzednią turę i przechodzi dalej; drugie wysłanie w tym samym
czacie nadal jest odrzucane. Tura ucięta Stopem nie zasila digestu rozmowy.

**Testy.** `useSendChatMessage.test.ts` → „stops the other chat's turn and
sends…”, „refuses a second message for the chat that is already answering”;
`llmStore.test.ts` → „does not let a stump left by Stop become the
conversation topic”, „summarizes a turn that finished on its own”.

**Na urządzeniu.** Zadaj pytanie, które generuje długo. W trakcie: drawer →
New chat → wróć do poprzedniego czatu. Oczekiwane: odpowiedź trwa dalej i
kończy się w całości, ttft/tps normalne. Potem zadaj w tym czacie pytanie
kontekstowe („Czy jest tam jedzenie vege?”): zapytanie w trace ma dotyczyć
miejsca z pierwszej wiadomości, nie innego miasta. Wariant drugi: w nowym
czacie wyślij wiadomość, gdy stary jeszcze generuje. Oczekiwane: stary czat
zatrzymuje się z tym, co zdążył, nowy odpowiada na swoje pytanie.

## Kolejność na urządzeniach

S20 FE (Qwen 3 0.6B): R1 → R3 → R2, potem LFM: R1 tylko krok 4.
iPhone 17: R6 (Gemma) → R5 (Qwen 1.7B) → R7 (LFM) → R8.
iPhone SE: R4.
Pixel 10: R1 krok 3 i R9 (właściciel).
