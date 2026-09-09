# Jak ułożona jest ta dokumentacja

Jedna reguła trzyma resztę: **dokument jest albo żywy, albo datowany — nigdy
jedno i drugie.** Żywy opisuje stan, który ma być prawdziwy dziś, i wolno go
edytować. Datowany opisuje, co zmierzono danego dnia, i po zamknięciu rundy
nie zmienia się nigdy. Mieszanie tych dwóch rzeczy w jednym pliku jest
powodem, dla którego poprzedni układ zgnił: żywa część ciągnęła za sobą
nieaktualną, a nieaktualna podważała żywą.

## Co gdzie leży

| katalog         | cykl życia | co tam trafia                                                          |
| --------------- | ---------- | ---------------------------------------------------------------------- |
| `docs/`         | żywe       | stan otwartych spraw, procedury wydania                                |
| `docs/testing/` | procedury  | plany rund i prompty dla testera — powtarzalne, wersjonowane w miejscu |
| `docs/rounds/`  | archiwum   | wynik jednej rundy, `RRRR-MM-DD-nazwa.md`, po scaleniu nieedytowany    |

Data w nazwie pliku w `rounds/` nie jest ozdobą — jest jedyną informacją,
która mówi czytelnikowi, jak bardzo ufać treści, bez otwierania historii
gita.

## Odwołania do zmian

**Linkuj numer PR-a, nie skrót commita.** Krótkie SHA nie przeżywają rebase'u,
squasha ani przepisania historii. Na tej gałęzi trzeba było przemapować 153
takie odwołania dwa razy w ciągu jednego dnia, a squash przy scaleniu zabiłby
je na stałe i bez możliwości odtworzenia.

Kiedy chcesz wskazać konkretną zmianę:

- numer PR-a — `#312` — przeżywa wszystko;
- ścieżka i nazwa symbolu — `webResultsToContext.ts` → `SENTENCE_END` — nie
  zależy od historii;
- nazwa testu — najlepszy z trzech, bo jest wykonywalna.

SHA wolno zostawić wewnątrz pliku w `rounds/`, który i tak zamarza w dniu
rundy. Poza `rounds/` nie ma dla nich miejsca.

## Co jest lokalne, a nie w repozytorium

Notatki robocze jednej rundy trzymamy poza gitem przez `.git/info/exclude`, a
nie przez `.gitignore` — wpis w `.gitignore` byłby commitowany i narzucałby
regułę wszystkim. Dziś tak trzymane są między innymi
`docs/WEB_SEARCH_RELEASE_TEST_PLAN.md`, `docs/DEVICE_SMOKE_TEST_RESULTS.md`
i cały `docs/test-evidence/` — zrzuty ekranu i surowe dumpy z telefonów,
których nie ma powodu wozić w historii repozytorium.

## Co zostało do zrobienia

`rounds/web-search-rag-log.md` to 4737 linii i jedyny plik, który nadal łamie
regułę z góry: jest w nim żywy opis pipeline'u wymieszany z zapisem kolejnych
rund. Żywą część trzeba z niego wyjąć do `docs/WEB_SEARCH.md`, a resztę
zostawić jako archiwum. Wymaga to przejścia treść po treści i rozstrzygnięcia,
co jest nadal prawdą — czyli pracy redakcyjnej, nie przenosin plików, dlatego
nie zrobiono tego razem z tą zmianą.
