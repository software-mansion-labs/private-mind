# Pixel 10 — analiza dwóch najnowszych rozmów

Zebrane 2026-09-07 z Pixela 10 (`56211FDCR005KT`), build `versionCode=68`,
`lastUpdateTime=2026-09-07 12:41` — czyli **przed** poprawkami R1–R9 i przed
trzema poprawkami z dokumentu kompatybilności. Model w obu rozmowach:
**Gemma 4 - 2B**, web search włączony.

Eksport przez „Export Chat" nie daje się wyjąć z telefonu (plik ląduje w
prywatnym katalogu aplikacji, a arkusz udostępniania na tym telefonie oferuje
tylko Quick Share / Gmail / Drive; `run-as` odpada bo APK nie jest debuggable,
`adb backup` na Androidzie 12+ zwraca pusty plik). Rozmowy odczytane z drzewa
dostępności. Surowy zapis: `docs/test-evidence/pixel-r3/pixel-chats-55-56.txt`.

| rozmowa | temat                              | tur | odpowiedzi |
| ------- | ---------------------------------- | --- | ---------- |
| 56      | prezydent USA, G7, historia Polski | 13  | 11         |
| 55      | wieczór kawalerski w Zakopanem     | 22  | 17         |

## Wydajność

|         | ttft min / mediana / max | tps min / mediana / max |
| ------- | ------------------------ | ----------------------- |
| chat 56 | 5,5 s / 33,9 s / 38,4 s  | 4,90 / 5,03 / 5,94      |
| chat 55 | 33,3 s / 37,1 s / 42,3 s | 3,62 / 4,96 / 7,18      |

Jedyna tura bez wyszukiwania (chat 56, pierwsze pytanie) miała ttft 5,5 s.
Każda tura z wyszukiwaniem — 29–42 s. **Web search dokłada ~30 sekund do
pierwszego tokenu** i to jest dominujący koszt, nie generacja.

## Znalezione problemy

### 1. Siedem pytań pod rząd, dwie odpowiedzi (chat 55) — BLOCKER

Po turze „Sprawdź polecane restauracje w zakopanem" użytkownik wysłał kolejno:

```
Czy jest tam jedzenie vege?      ← wysłane 3× pod rząd
Czy jest tam jedzenie vege?
Czy jest tam jedzenie vege?
Czego dotyczy ten wątek?
Hej
Hi
Pomidor
```

Na tych siedem baniek przypadły dwie odpowiedzi. To dokładnie objaw, który
naprawiają R1 (jedna tura naraz + zwrot tekstu do pola z komunikatem) i R2
(dokończenie tury po wyjściu z czatu). Potrójne „Czy jest tam jedzenie vege?"
pokazuje, jak to wygląda od strony użytkownika: pierwsza wysyłka znika bez
śladu, więc próbuje ponownie.

### 2. Model wypisał własny prompt systemowy jako odpowiedź (chat 55) — NOWE

Bańka asystenta, bez metryk, o treści:

```
Naïve.
Please be acknowledge the request and provide a clear, accurate, and well-structured
```

To parafraza domyślnego promptu z [db.ts:351](database/db.ts#L351)
(„Provide clear, accurate, and well-structured responses"). Prompt systemowy
wyciekł do treści odpowiedzi. Nie jest to naprawione na tym branchu i nie ma
na to predykatu — `isQuestionEchoAnswer` porównuje z pytaniem, nie z promptem.

### 3. Puste bańki z zapisanymi metrykami — 2 przypadki

| rozmowa | pytanie                                        | metryki                   | treść |
| ------- | ---------------------------------------------- | ------------------------- | ----- |
| 56      | „Jaki jest skład G7?"                          | ttft 29894 ms, 5,26 tok/s | brak  |
| 55      | „Dodaj do listy paintball i sprawdź jego cene" | ttft 36847 ms, 4,93 tok/s | brak  |

Poprawka R4 usuwa taką bańkę, ale pytanie i tak zostaje bez odpowiedzi — a
tu przepadło 30 i 37 sekund wyszukiwania.

### 4. Temat z wcześniejszych tur wchodzi do zapytania

Trzy wystąpienia, dwa mechanizmy:

- **chat 56**, „Jaka jest aktualna sytuacja na Ukrainie?" → zapytanie poszło
  jako `aktualna sytuacja na Ukrainie USA`. Winowajcą jest `topicAnchorer`
  ([topicAnchors.ts](utils/web/topicAnchors.ts)), nie digest: „USA" padło w
  rozmowie kilka razy, więc zostało uznane za kotwicę tematu. Strażnik
  `standsAlone` miał to zablokować, ale `namedEntitiesIn('Jaka jest aktualna
sytuacja na Ukrainie?')` zwraca `[]` — odmieniona polska nazwa własna nie
  jest rozpoznawana jako encja. Sprawdzone na **aktualnym** stanie brancha:
  zapytanie nadal wychodzi z doklejonym „USA". Poprawka `9038274` dotyczy
  wyłącznie digestu z obcej rozmowy i tego przypadku nie łapie.
- **chat 55**, „Czy jest tam jedzenie vege?" i „Sprawdź polecane restauracje
  tam gdzie jade" → oba zwróciły Kraków (TOP10 Restauracje Kraków), mimo że
  cała rozmowa dotyczy Zakopanego. To znany przypadek digestowy, naprawiony.

Użytkownik musiał ręcznie poprawiać model: „Jadę do Zakopanego nie Krakowa
sprawdź tam vege restauracje" — dopiero wtedy dostał Zakopane.

### 5. „Krzyżacy" przetłumaczone na Knights Templar (chat 56)

Pytanie: „Kim byli krzyżacy i jakie są o nich legendy? Przygotuj to w formie
wypracowania na j. Polski". Źródła:

- `usagekt.org` — Grand Encampment of Knights Templar, U.S.A.
- `historytools.org` — „History of the Medieval Knights"
- `americarewind.com` — „9 Legendary Knights Who Shaped History"

Zakon krzyżacki (Teutonic Order) trafił w templariuszy i ogólne „rycerstwo",
w dodatku w amerykańskiej organizacji masońskiej. Zapytanie zostało
przetłumaczone na angielski i zgubiło desygnat.

### 6. Forma odpowiedzi ignorowana

To samo pytanie prosiło o **wypracowanie**. Dostało listę „co mówi która
strona": „usagekt.org informuje, że…", „historytools.org wskazuje, że…",
„thearchaeologist.org sugeruje, że…". Ten sam wzorzec wrócił przy „Ile ma
dzieci prezydent USA?" (trzy akapity referujące trzy portale, zamiast
jednej liczby). Gemma 4 2B referuje źródła zamiast odpowiadać.

### 7. Sprzeczności w obrębie jednej rozmowy (chat 56)

| tura                                                                     | odpowiedź                                                                        |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| „Kto jest aktualnie prezydentem USA?" (bez web)                          | Joe Biden                                                                        |
| „Kto jest aktualnie prezydentem USA?" (z web)                            | Joe Biden, źródło: „Prezydenci USA — pełna lista od 1789 roku do dziś"           |
| „Kto jest aktualnym prezydentem w USA i kiedy kończy się jego kadencja?" | „nie ma informacji… Istnieje informacja, że prezydent Joe Biden kończy kadencję" |
| „To nie jest prawdą sprawdź kto jest prezydentem po Joe biden"           | „Na podstawie dostarczonych źródeł nie ma" (ucięte)                              |
| „Ile ma dzieci prezydent USA?"                                           | pięcioro — Donald Trump                                                          |

Retrieval na „aktualnie prezydentem USA" trafił w **listę historyczną od 1789
roku**, która nie odpowiada na „aktualnie". Model przyjął z niej Bidena i
trzymał się tego przez cztery tury, mimo wyraźnego sprostowania od
użytkownika — a dwie tury później sam nazwał prezydentem Trumpa.

### 8. Halucynacje faktograficzne

- „Mieszko I to pierwszy historyczny władca Polski panujący **w drugiej
  połowie XX wieku**" (chat 56)
- „Prognoza pogody na weekend w Zakopanie, województwo małopolskie **to
  34-500, maks.**" — kod pocztowy podany jako wartość prognozy (chat 55)
- „Nie ma informacji… rekomendowałyby **wycieczkę gospodarczą**" — przekręcone
  „górską"; w tej samej odpowiedzi model doradza **Rudawy Janowickie** i
  **Karkonosze** (Dolny Śląsk) osobie jadącej w Tatry (chat 55)
- „Kocie to typ tradycyjnego kocie, który wywołuje skutki w organizmie" —
  z sąsiedniej rozmowy 52 na LFM 2.5 1.2B, ten sam rodzaj rozpadu

### 9. Odpowiedzi ucięte w połowie zdania

Co najmniej cztery: „Ponadto," (skład G7), „Na podstawie dostarczonych źródeł
nie ma", „provide a clear, accurate, and well-structured", „Z kolei
gdziejemy.pl i tripadvisor.com odnoszą się do".

### 10. Zaimek bez desygnatu

„Czy ludzie lubią go?" (po turze o Trumpie) → „nie ma informacji o tym, jak
ludzie podchodzą do niego". Na aktualnym branchu to samo pytanie z tą samą
historią daje już zapytanie `Czy ludzie lubią go? Donald Trump`, więc podmiot
jest podstawiany — Pixel ma starszy build. Zostaje pytanie, czemu model przy
poprawnym zapytaniu i tak odpowiedział „nie ma informacji": pytanie o sympatię
do osoby nie ma szans trafić w źródło, które ją wprost stwierdza.

## Podsumowanie

| #   | problem                                      | status na branchu                                         |
| --- | -------------------------------------------- | --------------------------------------------------------- |
| 1   | siedem pytań, dwie odpowiedzi                | naprawione (R1, R2) — Pixel ma starszy build              |
| 2   | prompt systemowy w treści odpowiedzi         | **nienaprawione, nowe**                                   |
| 3   | puste bańki z metrykami                      | częściowo (R4 usuwa bańkę)                                |
| 4a  | „USA" doklejone do pytania o Ukrainę         | **nienaprawione** — `topicAnchorer`, potwierdzone na HEAD |
| 4b  | Kraków w rozmowie o Zakopanem                | naprawione (`9038274`)                                    |
| 5   | „krzyżacy" → Knights Templar                 | **nienaprawione**                                         |
| 6   | referowanie źródeł zamiast odpowiedzi        | **nienaprawione**                                         |
| 7   | lista historyczna jako źródło na „aktualnie" | **nienaprawione**                                         |
| 8   | halucynacje faktograficzne                   | poza zakresem branchu                                     |
| 9   | ucięte odpowiedzi                            | osobne branche `fix/255-*`                                |
| 10  | zaimek bez desygnatu                         | naprawione — Pixel ma starszy build                       |

Trzy pozycje warte kodu w pierwszej kolejności, bo są mechaniczne i mają jasny
test: 2 (wyciek promptu), 4a (podmiot rozmowy doklejany do pytania, które ma
własny), 7 (źródło historyczne na pytanie o stan bieżący).
