# Co poprawki dały, a co zostaje — przebieg na Pixelu 10

Build `versionCode=68`, `lastUpdateTime=2026-09-07 19:01`, model **Gemma 4 - 2B**,
web search włączony, 11 pytań w 7 rozmowach. Zapis:
`docs/test-evidence/pixel-r3/verify-after-fixes.txt`.

Pytania odtwarzają dokładnie te punkty, które zgłosiłeś, plus jeden nowy obszar
(mind care).

## Naprawione

### Język potoczny → właściwy sklep

„Chce kupic wedke na prezent koledze ile kosztuja takie rzeczy?"

| przed | po |
| --- | --- |
| źródło: „Zegarków na prezent • 18019 modeli • Fabrykazegarkow.pl", odpowiedź: „źródła dotyczą sprzedaży zegarków" | źródło: „Prezenty Wędkarskie — Sklep wędkarski Pleciona.pl", odpowiedź z cenami 99–950 zł |

Reguła i przykład w promptcie planera („potoczna wiadomość owija przedmiot w
okoliczności — zachowaj przedmiot, wyrzuć okoliczność") zadziałały.

Zostały tam dwie usterki: model wypisał **siedem** cen zamiast zakresu, mimo że
`getRangeHint` każe podać sam zakres przy ≥3 liczbach, i znów pojawiło się
„A number here couldn't be confirmed against the sources".

### Odpowiedź o sporcie nazywa edycję

„Kto wygral ostatni mundial?" → „FIFA World Cup **2022** to Argentyna". Rok jest
teraz w tym samym zdaniu co zwycięzca, więc wynik sprzed lat nie czyta się jak
aktualny.

## Zdrowe — mind care

„Ostatnio duzo sie stresuje w pracy i nie moge spac, co moge zrobic?"

Aplikacja **nie wyszukiwała** („Answered without searching") i odpowiedziała
uporządkowanie: zastrzeżenie, że to nie jest porada medyczna ani
psychoterapeutyczna; higiena snu (stały harmonogram, rutyna przed snem, ciemna
i chłodna sypialnia); zarządzanie stresem (oddech, uważność, dzielenie zadań,
przerwy); aktywność fizyczna; a na końcu osobna sekcja „Kiedy skonsultować się
ze specjalistą" z lekarzem pierwszego kontaktu, psychoterapeutą i psychiatrą.

Nie znalazłem tu luki bezpieczeństwa i **nie dokładałem** reguł do promptu.
Jedyna wada to zniekształcone słowa Gemmy („bodysczek", „natychczasowo",
„odpuszanie") — to jakość modelu, nie logika aplikacji.

## Niedziałające — jedna wspólna przyczyna

Cztery z Twoich punktów po poprawkach **nadal nie działają**, i wszystkie
sprowadzają się do tego samego: **do modelu nie dociera treść strony, tylko jej
akapit wstępny albo opis z wyszukiwarki.**

| pytanie | trafione źródło | odpowiedź |
| --- | --- | --- |
| „Podaj przepis na ciasto marchewkowe" | „Ciasto marchewkowe — przepis — PrzyslijPrzepis.pl" | „Przepis.pl oferuje przepis na ciasto marchewkowe z orzechami włoskimi, które jest puszyste i idealne do przełożenia kremem…" |
| „Podaj liste skladnikow do tego ciasta" | to samo | „Nie ma informacji w dostarczonych źródłach dotyczących listy składników" |
| „Co warto robic na wieczorze kawalerskim w Zakopanem?" | „TOP Atrakcje w Zakopanem — Wieczór Kawalerski" | „nie jestem w stanie podać konkretnych atrakcji" |
| „Wypisz liste 5 atrakcji" | „Strona główna — Kawalerski Zakopane" | to samo zdanie |
| „Jaka bedzie pogoda w weekend w Zakopanem?" | (strona pogodowa) | „Nie ma informacji o pogodzie w Zakopanem na weekend" |

Retrieval trafia **bezbłędnie** — to są dokładnie te strony, na których leży
odpowiedź. Ale tekst, który z nich wraca, to lead marketingowy („świetnie
smakuje do filiżanki gorącej kawy"), a nie lista składników, lista atrakcji ani
tabela prognozy. Dlatego nowe instrukcje promptu („podaj samą listę", „nazwij
atrakcje po nazwie", „cytuj liczbę z jednostką") nic nie zmieniły: **nie da się
wypisać treści, której nie ma w kontekście.**

Pozytywny efekt uboczny jest jeden: znikł kod pocztowy podawany jako prognoza
(„Zakopane… to 34-500"). Teraz aplikacja mówi wprost, że nie ma danych — to
gorsza odpowiedź dla użytkownika, ale uczciwa.

### Gdzie to leży

Trzy warstwy, po kolei:

1. **`extractArticle`** — strony z wynikami na żywo, terminarzami i pogodą
   renderują dane po stronie klienta; scraper dostaje szkielet. Tu potrzebne
   jest albo czekanie na render, albo źródła z danymi w HTML.
2. **`retrieveWebPassages`** — na stronach, które treść mają (przepis, lista
   atrakcji), wybór pasażu idzie za podobieństwem semantycznym do pytania, a
   lead („przepis na ciasto marchewkowe z orzechami…") jest do pytania
   podobniejszy niż sama lista („2 szklanki mąki, 3 jajka"). Lista przegrywa
   właśnie dlatego, że jest listą. Naprawa: premia dla pasaży o kształcie listy
   (dużo krótkich linii, liczby z jednostkami) przy pytaniach o przepis, kroki,
   składniki, wyliczenie.
3. **Budżet znaków kontekstu** — nawet trafiony pasaż może zostać przycięty.

Punkt 2 jest najtańszy i najpewniejszy; zrobiłbym go pierwszy, ale wymaga
zobaczenia, co naprawdę wraca z ekstrakcji, a tego nie da się sprawdzić bez
podejrzenia zawartości `sourceDocuments.passage` na urządzeniu.

## Niedziałające — osobna przyczyna

### „Kto jest aktualnie prezydentem USA?" — bez zmian

Nadal „Joe Biden", nadal ze źródła **„Prezydenci USA — pełna lista od 1789 roku
do dziś"**. Zapytanie dostaje teraz bieżący rok, a prompt mówi, że lista
historyczna nie dowodzi stanu bieżącego — ale wyszukiwarka i tak stawia tę
listę na pierwszym miejscu, a model bierze z niej ostatni wpis, jaki zna.

To nie jest problem promptu. To ranking wyników: pytanie o obecnego
piastuna urzędu powinno odrzucać strony, których tytuł zapowiada zestawienie
historyczne („pełna lista", „od … do dziś", „wszyscy", „lista prezydentów"),
zanim trafią do kontekstu — analogicznie do `fairRankByListingRelevance`.

### Fałszywa przesłanka — częściowo

„Ostatni turniej byl w Brazylii w 2026 roku kto go wygral?" → „FIFA World Cup
2026 to Hiszpania", źródło „2026 FIFA World Cup Final Result: Spain 1-0
Argentina (AET)". Model poszedł za źródłem, które wprost to twierdzi, ale
**nie sprostował gospodarza**: 2026 nie odbył się w Brazylii, a instrukcja każe
sprawdzić rok, gospodarza i skład. Do zrobienia: sprostowanie musi być
wymagane wprost, nie tylko dopuszczone.

### Wypracowanie — zły desygnat

„Kim byli krzyzacy? Napisz krotkie wypracowanie" → źródło „Krzyżacy —
opracowanie, problematyka, bohaterowie", czyli **powieść Sienkiewicza**, i
odpowiedź o powieści zamiast o zakonie. Poprzednio to samo pytanie trafiało w
amerykańskich templariuszy; teraz w lekturę szkolną. Bez web search ten sam
model napisał sensowne wypracowanie o zakonie krzyżackim z własnej wiedzy.

Wniosek: dla zadań szkolnych typu „napisz wypracowanie o X" wyszukiwanie
częściej szkodzi niż pomaga — trafia w opracowania lektur i portale
edukacyjne. Wart rozważenia: przy prośbie o formę pisemną nie wyszukiwać, chyba
że pytanie wymaga świeżych faktów.

## Podsumowanie

| Twój punkt | stan |
| --- | --- |
| wyszukiwanie aktualnych informacji (prezydent USA) | **nie naprawione** — ranking wyników, nie prompt |
| przepis: 4 źródła i nic konkretnego, brak listy składników | **nie naprawione** — treść strony nie dociera |
| pogoda, weekend/jutro | **nie naprawione** — strony renderowane po stronie klienta |
| refining pogarsza odpowiedź | **naprawione** (kod + test), nie odtworzone w tym przebiegu |
| listowanie atrakcji mimo danych w źródłach | **nie naprawione** — ta sama przyczyna co przepis |
| planowanie wieczoru kawalerskiego | **nie naprawione** — jw. |
| mind care | **działa dobrze**, bez zmian |
| wypracowanie / zadanie szkolne | **pogorszone przez web search** — model bez sieci pisze lepiej |
| język potoczny | **naprawione** |
