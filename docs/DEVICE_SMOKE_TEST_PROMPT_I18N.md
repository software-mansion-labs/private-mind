# Prompt dla sesji testowej — runda 2: regresja poprawek + web search w językach użytkowników

Jesteś operatorem testów manualnych aplikacji Private Mind na fizycznych
telefonach, build release. Katalog:
`/Users/krzysztoffaracik/Projects/private-mind-C/.claude/worktrees/cr-phase1`.
Obowiązują **wszystkie zasady twarde z `docs/DEVICE_SMOKE_TEST_PROMPT.md`**
(sekcja „Zasady twarde”, punkty 1–10: brak zmian w kodzie, brak Metro, Argent
MCP, współdzielony tool-server, identyfikacja buildu, przełącznik Web per
rozmowa, metryki w bańce, diakrytyki, zapis po każdym scenariuszu, oszczędność
tokenów). Plan tej rundy: `docs/DEVICE_SMOKE_TEST_PLAN_I18N.md`. Lista
poprawek do regresji: `docs/DEVICE_SMOKE_TEST_FIXES_R1.md`. Wyniki dopisujesz
do `docs/DEVICE_SMOKE_TEST_RESULTS_R2.md` (utwórz, jeśli nie istnieje; druga
sesja pisze do tego samego pliku — dopisuj sekcje, nie kasuj cudzych). Dowody
do `docs/test-evidence/smoke-r2/`.

Pixel 10 (`56211FDCR005KT`) jest poza rundą — nie dotykaj.

## Kolejność pracy

1. **Identyfikacja buildu.** Android: `lastUpdateTime` musi być `2026-09-07
16:01:47` (versionCode 68). iOS: aplikacja `com.swmansion.privatemind.smoke`
   zainstalowana o godzinie z wiadomości uruchamiającej. Inny build → stop i
   zgłoś.
2. **Regresja poprawek** z `DEVICE_SMOKE_TEST_FIXES_R1.md`, tylko kroki „Na
   urządzeniu” przypisane do twojego telefonu w sekcji „Kolejność na
   urządzeniach”. Dla każdej: PASS / FAIL / NIE DA SIĘ + jedno zdanie + zrzut.
   To ma priorytet nad językami: jeśli R1 na S20 FE nadal gubi wiadomości,
   zapisz dokładnie jak, i dopiero potem idź dalej.
3. **Języki** według planu I18N, sekcja 4: L1 dla języków dostępnych na twoim
   urządzeniu (sekcja 3 planu), potem L2, L3, na iPhone 17 dodatkowo L4, L5,
   L6, L7. Każde pytanie w nowej rozmowie z Web włączonym i potwierdzonym,
   chyba że scenariusz mówi inaczej.

## Co zapisujesz przy każdej turze językowej

Tabela: `| język | pytanie | Web | język odpowiedzi | zapytanie do wyszukiwarki | domena źródła | region trafiony? | czas do ttft [s] | tps | Refining? | liczba z pytania w odpowiedzi? | uwagi |`

- **język odpowiedzi**: oceń po piśmie i po tym, czy pojawiają się całe zdania
  po angielsku; „mieszany” to osobna wartość.
- **zapytanie do wyszukiwarki**: rozwiń „Searched the web” i przepisz pierwsze
  zapytanie co do znaku (to jedyny sposób, żeby sprawdzić, w jakim języku
  planner pisze).
- **region trafiony?**: tak, gdy domena źródła pasuje do kraju języka
  (.pl, .de, .in, .pk, .br …) albo strona jest w języku pytania.
- Odmowa albo angielska odpowiedź na pytanie w innym języku = jakość, nie
  stabilność. Pusta bańka, zawieszenie > 60 s, krzaki w cytacie = incydent.

## Ograniczenia narzędzi

- Android: `keyboard` wpisze tylko ASCII, `paste` nie działa. Języki z
  pismem niełacińskim pomijasz (zapisz N/A), diakrytyki zastępujesz literami
  bez ogonków z adnotacją `ascii`. Hinglish (L3) jest w ASCII — obowiązkowy.
- iOS: `keyboard` wpisuje Unicode i RTL. Po wpisaniu pierwszego pytania w
  danym języku zrób zrzut pola przed wysłaniem; jeśli znaki zostały zjedzone,
  zapisz i przejdź do następnego języka. `describe` zwraca puste drzewo dla
  aplikacji — współrzędne ze zrzutu w pełnej skali, `screenshot` po każdym
  tapie. Tryb samolotowy nie odcina Wi‑Fi na tym telefonie: wyłączaj Wi‑Fi
  osobnym kafelkiem.
- Oszczędzaj tokeny: zrzuty w domyślnej skali, pełna skala tylko do odczytu
  metryk i treści; bez `describe`, gdy masz świeże drzewo; bez powtarzania
  udanych kroków.

## Werdykty

Na końcu sekcja „Werdykty” z dwiema tabelami: (a) poprawki R1–R8 na twoim
urządzeniu: PASS/FAIL; (b) języki × model według sekcji 5 planu I18N: OK /
DEGRADED / BROKEN / N/A z jedną linią uwag. Raport końcowy w odpowiedzi
do 20 linii: werdykty, incydenty, trzy najciekawsze obserwacje jakości.
