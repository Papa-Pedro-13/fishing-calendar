# 03. Справочник API (реализованная часть)

Базовый URL: `http://localhost:4200/api` (порт задаётся `PORT`).
Интерактивная документация: `http://localhost:4200/docs` (Swagger UI), схема — `/docs-json`.
Версионирование (`/api/v1`) пока не введено.

Все ответы — `application/json`. Аутентификации нет, CORS открыт для всех origin.
Каждый ответ содержит заголовок `x-request-id`: значение из запроса переиспользуется,
иначе генерируется UUID; тот же идентификатор попадает в логи сервера.

Реализованы два эндпоинта: `GET /api/weather` и `GET /api/health`.
ИИ-эндпоинты (`/api/v1/recommendations`, `/api/v1/calendar`) описаны ниже как
**проектируемые** — в коде их пока нет.

---

## `GET /api/health`

Проверка работоспособности процесса. Внешние зависимости не опрашивает.

```json
{ "status": "ok", "uptime": 42, "timestamp": "2026-10-22T18:04:28.998Z" }
```

| Код | Когда |
|---|---|
| 200 | процесс отвечает |

---

## `GET /api/weather`

Текущая погода или прогноз для указанного места плюс фаза Луны.
Ответ — **нормализованная модель**, а не сырой JSON WeatherAPI: имена полей и структура
не зависят от провайдера.

### Query-параметры

| Параметр | Тип | Обязателен | Правила | По умолчанию |
|---|---|---|---|---|
| `q` | string | да | Непустая строка после `trim`, ≤ 128 символов. Передаётся провайдеру как есть: город, `lat,lon`, индекс, IP | — |
| `mode` | enum | нет | `current` \| `forecast` | `forecast`, если передан `days`, иначе `current` |
| `days` | int | нет | 1–14, **только для `mode=forecast`**; при `mode=current` → 400 | `1` |
| `date` | string | нет | `YYYY-MM-DD`, корректная дата, **только для `mode=current`**; при `mode=forecast` → 400 | сегодня |

Неизвестные query-параметры отклоняются (`whitelist` + `forbidNonWhitelisted`).

Смыслы параметров разделены: `mode` выбирает эндпоинт провайдера, `days` — горизонт
прогноза, `date` — дату, на которую считается верхнеуровневая фаза Луны. Раньше все три
роли исполнял один `days`.

### Примеры запросов

```bash
# Текущая погода и фаза Луны на сегодня
curl "http://localhost:4200/api/weather?q=Moscow"

# Явно: текущая погода, фаза Луны на 1 ноября
curl "http://localhost:4200/api/weather?q=Moscow&mode=current&date=2026-11-01"

# Прогноз на 3 дня с фазой Луны на каждый день
curl "http://localhost:4200/api/weather?q=Moscow&mode=forecast&days=3"

# Обратная совместимость: days без mode означает прогноз
curl "http://localhost:4200/api/weather?q=55.75,37.62&days=2"
```

### Успешный ответ, `mode=current`

```json
{
  "location": {
    "name": "Moscow",
    "region": "Moscow City",
    "country": "Russia",
    "latitude": 55.7522,
    "longitude": 37.6156,
    "timezone": "Europe/Moscow",
    "localTime": "2026-10-22 19:43"
  },
  "current": {
    "temperatureC": 8.9,
    "feelsLikeC": 6.6,
    "humidityPercent": 34,
    "pressureMb": 1033,
    "windKph": 14.4,
    "gustsKph": 21.6,
    "windDirection": "ESE",
    "cloudPercent": 75,
    "precipitationMm": 0,
    "visibilityKm": 10,
    "uvIndex": 0,
    "condition": { "text": "Cloudy", "code": 1006 },
    "isDay": false,
    "updatedAt": "2026-10-22 19:30"
  },
  "forecast": [],
  "lunarPhase": { "phase": "Waxing Gibbous", "age": 14.47 },
  "stale": false
}
```

### Успешный ответ, `mode=forecast`

Структура та же, но `forecast` заполнен, а у каждого дня своя фаза Луны:

```json
{
  "location": { "name": "Moscow", "latitude": 55.7522, "longitude": 37.6156 },
  "current": { "temperatureC": 8.9 },
  "forecast": [
    {
      "date": "2026-10-22",
      "minTemperatureC": 4.2,
      "maxTemperatureC": 9.1,
      "avgTemperatureC": 6.6,
      "maxWindKph": 18.0,
      "totalPrecipitationMm": 0.0,
      "avgHumidityPercent": 62,
      "chanceOfRainPercent": 12,
      "uvIndex": 1,
      "condition": { "text": "Partly cloudy", "code": 1003 },
      "sunrise": "07:24 AM",
      "sunset": "05:11 PM",
      "lunarPhase": { "phase": "Waxing Gibbous", "age": 14.47 }
    }
  ],
  "lunarPhase": { "phase": "Waxing Gibbous", "age": 14.47 },
  "stale": false
}
```

### Поля ответа

| Поле | Тип | Описание |
|---|---|---|
| `location` | object | `name`, `region`, `country`, `latitude`, `longitude`, `timezone`, `localTime`; отсутствующие у провайдера значения — `null` |
| `current` | object \| null | Текущая погода: `temperatureC`, `feelsLikeC`, `humidityPercent`, `pressureMb`, `windKph`, `gustsKph`, `windDirection`, `cloudPercent`, `precipitationMm`, `visibilityKm`, `uvIndex`, `condition {text, code}`, `isDay`, `updatedAt`. `null`, если провайдер не вернул текущую погоду |
| `forecast` | array | Дни прогноза (порядок провайдера). Для `mode=current` — `[]` |
| `forecast[].lunarPhase` | object | Фаза Луны на дату этого дня (полдень UTC, чтобы часовой пояс не сдвигал сутки) |
| `lunarPhase` | object | `phase` (название из `lunarphase-js`), `age` (возраст в сутках). Для `mode=current` — на `date` или сегодня; для `mode=forecast` — на сегодня |
| `stale` | boolean | `true`, если провайдер недоступен и отданы устаревшие данные из кэша |

Фазы: `New`, `Waxing Crescent`, `First Quarter`, `Waxing Gibbous`, `Full`,
`Waning Gibbous`, `Last Quarter`, `Waning Crescent`.

### Кэширование

Кэш in-memory внутри процесса (не разделяется между инстансами, сбрасывается при рестарте).

| Ключ | TTL | Что хранится |
|---|---|---|
| `wx:{mode}:{q в нижнем регистре}:{days или -}:{date или -}` | 10 мин для `current`, 30 мин для `forecast` | готовый нормализованный ответ |

- Ошибки провайдера не кэшируются.
- Если запись протухла, но прошло меньше 6 часов, при сбое провайдера возвращается она
  же с `stale: true`. Иначе — ошибка.
- Фонового обновления (stale-while-revalidate) нет: протухшая запись обновляется
  синхронно следующим запросом.
- Максимум 500 записей, при переполнении вытесняется самая старая.
- Записи для разных `date` — разные ключи: запрос фазы Луны на другую дату идёт к провайдеру.

### Ошибки

| Код | Когда | Тело |
|---|---|---|
| 400 | Невалидные или несовместимые параметры (`days=abc`, `days=0`, `days=20`, `days` при `mode=current`, `date` при `mode=forecast`, кривая `date`, пустой `q`, лишний параметр) | стандартное тело Nest с `message` |
| 400 | Провайдер не нашёл место или счёл запрос некорректным | `message` — текст ошибки WeatherAPI (например, `No matching location found.`) |
| 429 | Исчерпана квота WeatherAPI | `Превышен лимит запросов к WeatherAPI` |
| 502 | Таймаут (15 с), сеть, 401/403 (неверный ключ), 5xx провайдера | `Произошла ошибка получения погоды` или `WeatherAPI отклонил ключ доступа` |
| 503 | На сервере не задан `WEATHER_API_KEY` | `WEATHER_API_KEY is not configured` |
| 404 | Неизвестный маршрут | стандартное тело Nest |

Причина сбоя провайдера (статус, код и сообщение WeatherAPI) пишется в лог вместе
с `request-id`; ключ в логи не попадает.

### Ограничения провайдера и ключа

- Провайдер: **WeatherAPI.com**, `baseURL = https://api.weatherapi.com/v1`,
  таймаут 15 000 мс, до 3 редиректов.
- Ключ хранится на сервере (`WEATHER_API_KEY`) и в ответ клиенту не попадает.
- Ключ передаётся в query-строке запроса к провайдеру, поэтому исходящие URL нельзя
  логировать целиком.
- API принимает `days` до 14, но бесплатный тариф провайдера отдаёт не больше 3 дней:
  `days=14` вернёт 200 и столько дней, сколько дал провайдер. Ответ не «дополняется»
  и не обрезается — длина `forecast` равна фактическому ответу провайдера.
- Квота расходуется только на промахи кэша.

### Пример обработки на клиенте

```ts
type WeatherMode = 'current' | 'forecast';

async function getWeather(
  q: string,
  options: { mode?: WeatherMode; days?: number; date?: string } = {}
) {
  const url = new URL('/api/weather', 'http://localhost:4200');
  url.searchParams.set('q', q);
  if (options.mode) url.searchParams.set('mode', options.mode);
  if (options.days !== undefined) url.searchParams.set('days', String(options.days));
  if (options.date) url.searchParams.set('date', options.date);

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}
```

---

## Проектируемые эндпоинты ИИ (не реализованы)

Контракты ниже согласованы с [06-recommendations.md](06-recommendations.md) и появятся
на этапе 2. Сейчас в коде их нет — запросы вернут `404`.

### `GET /api/v1/recommendations?spotId&date&speciesId?`

Готовый **ИИ-гайд** на дату для точки и (опционально) вида. Оценка дня, запреты и
`confidence` считаются детерминированно, текст гайда генерирует LLM.

| Параметр | Тип | Обязателен | Правила |
|---|---|---|---|
| `spotId` | uuid | да | Существующая точка |
| `date` | `YYYY-MM-DD` | да | В пределах горизонта прогноза |
| `speciesId` | slug/uuid | нет | Если не задан — модель выбирает вероятные виды сама |
| `gear` | строка (повторяемый) | нет | Доступные снасти пользователя |

Успешный ответ `200`:

```json
{
  "spotId": "sp_1",
  "date": "2026-10-25",
  "score": 88,
  "label": "отличный",
  "confidence": "high",
  "guide": {
    "version": "guide-v1",
    "summary": "Условия близки к оптимальным: вода 9 °C, давление стабильное.",
    "species": [{ "slug": "pike", "name": "щука", "likelihood": 0.82 }],
    "windows": [{ "from": "07:00", "to": "09:00", "activity": 0.91 }],
    "tackle": { "rig": "джиг", "leader": { "material": "флюорокарбон", "diameterMm": 0.4, "lengthCm": 25 } },
    "baits": [{ "name": "виброхвост", "sizeCm": 12, "priority": 1 }],
    "groundbait": { "applicable": false },
    "tactics": ["облавливать бровку 3–5 м"],
    "warnings": [],
    "explain": [{ "factor": "waterTemperature", "value": "9 °C", "impact": 0.95 }],
    "disclaimer": "Оценка условий, а не гарантия улова."
  },
  "meta": {
    "source": "ai",
    "model": "glm-4",
    "promptVersion": "guide-v1",
    "inputsHash": "sha256:9f2c…",
    "generatedAt": "2026-10-24T18:00:00.000Z",
    "cached": true,
    "stale": false
  }
}
```

| Поле `meta` | Смысл |
|---|---|
| `source` | `ai` — сгенерировано моделью; `fallback` — шаблонный гайд без ИИ; `rules` — только детерминированные правила |
| `model`, `promptVersion` | Версия модели и промпта для воспроизводимости |
| `inputsHash` | Хеш фактов и версии промпта; ключ кэша |
| `cached` | Ответ взят из кэша без вызова модели |
| `stale` | Данные устарели (провайдер или ИИ недоступны) |

| Код | Когда | Комментарий |
|---|---|---|
| 400 | Некорректные параметры, дата вне горизонта | — |
| 404 | Нет точки, вида или маршрута (сейчас — всегда для `/v1`) | — |
| 429 | Превышен rate limit или дневной бюджет ИИ | `Retry-After` |
| 502 | LLM-провайдер вернул ошибку, а фолбэк недоступен | — |
| 503 | Не заданы `LLM_API_KEY`/`LLM_MODEL` | Гайд без ИИ, если включён фолбэк |

Особенности: ответ кэшируется по `inputsHash` (см. 06 §7) и отдаёт `ETag`; при сбое модели
возвращается `200` с `source: "fallback"`, а не ошибка. Ключи LLM на клиент не попадают.

### `GET /api/v1/calendar?spotId&from&to&speciesId?`

Детерминированный календарь на 7–14 дней: оценки, метки дней, окна активности и
`confidence` **без** вызова модели.

```json
{
  "spotId": "sp_1",
  "days": [
    { "date": "2026-10-25", "score": 88, "label": "отличный", "confidence": "high",
      "windows": [{ "from": "07:00", "to": "09:00", "activity": 0.91 }] }
  ],
  "generatedAt": "2026-10-22T18:00:00.000Z"
}
```

Коды: `400` — неверный диапазон дат (> 14 дней), `404` — нет точки, `200` — всегда, даже
при отсутствии прогноза (тогда `confidence: "low"` и `warnings`).

### `POST /api/v1/recommendations` (позже)

Персонализированный гайд: тело содержит `spotId`, `date`, `speciesId?` и профиль снастей.
Нужен, когда появится авторизация и станет важно учитывать снасти пользователя; до этого
хватает `GET` с кэшем.

---

## Чего в API ещё нет

Ниже — контракты, которые появятся при развитии (детали и обоснование — в
[07-target-architecture.md](07-target-architecture.md), [08-roadmap.md](08-roadmap.md)):

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/api/water-bodies?bbox=&q=` | поиск водоёмов и точек |
| `GET` | `/api/water-bodies/:id` | карточка водоёма: тип, глубина, течение, правила |
| `GET` | `/api/fish` | справочник видов и профилей повадок |
| `GET` | `/api/v1/calendar?spotId=&from=&to=` | календарь с оценками дней (описан выше) |
| `GET` | `/api/v1/recommendations?spotId=&date=&speciesId=` | ИИ-гайд «что взять» (описан выше) |
| `POST` | `/api/reports` | создать отчёт об улове |
| `GET` | `/api/reports?spotId=&speciesId=&from=` | лента отчётов локации |
| `GET` | `/api/rules?regionId=&date=` | запреты, нормы, минимальные размеры |
| `POST` | `/api/auth/*` | регистрация/вход, профиль |

Общие требования к будущим эндпоинтам: версионирование (`/api/v1`), пагинация
(`cursor`/`limit`), единый формат ошибок, `ETag`/`Cache-Control` для справочников,
идемпотентность записи (`Idempotency-Key`) для отчётов, rate limit по IP/пользователю.
