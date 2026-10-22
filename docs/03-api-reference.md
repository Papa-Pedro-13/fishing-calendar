# 03. Справочник API (реализованная часть)

Базовый URL: `http://localhost:4200/api` (порт задаётся `PORT`).
Интерактивная документация: `http://localhost:4200/docs` (Swagger UI).

Реализован один эндпоинт. Все ответы — `application/json`. Аутентификации нет,
CORS открыт для всех origin.

---

## `GET /api/weather`

Текущая погода или прогноз для указанного места плюс фаза Луны на запрошенную дату.

### Query-параметры

| Параметр | Тип | Обязателен | Ограничения в DTO | Фактическое поведение |
|---|---|---|---|---|
| `q` | string | да (по DTO) | — | Передаётся провайдеру как есть: город, `lat,lon`, индекс, IP-адрес |
| `days` | number | нет | `@Min(1) @Max(14)` | **Не валидируется**: `ValidationPipe` не подключён, значение приходит строкой |

### Примеры запросов

```bash
# Текущая погода
curl "http://localhost:4200/api/weather?q=Moscow"

# Прогноз (в текущем плане WeatherAPI доступно не более 3 дней)
curl "http://localhost:4200/api/weather?q=Moscow&days=3"

# По координатам
curl "http://localhost:4200/api/weather?q=55.75,37.62&days=1"
```

### Успешный ответ, `days` не указан (фрагмент реального ответа)

```json
{
  "location": {
    "name": "Moscow",
    "region": "Moscow City",
    "country": "Russia",
    "lat": 55.7522,
    "lon": 37.6156,
    "tz_id": "Europe/Moscow",
    "localtime_epoch": 1792687429,
    "localtime": "2026-10-22 19:43"
  },
  "current": {
    "last_updated": "2026-10-22 19:30",
    "temp_c": 8.9,
    "is_day": 0,
    "condition": { "text": "Cloudy", "icon": "//cdn.weatherapi.com/...", "code": 1006 },
    "wind_kph": 14.4,
    "wind_dir": "ESE",
    "pressure_mb": 1033,
    "humidity": 34,
    "cloud": 75,
    "feelslike_c": 6.6,
    "precip_mm": 0,
    "vis_km": 10,
    "uv": 0
  },
  "lunarPhase": { "phase": "Full", "age": 14.47 }
}
```

### Успешный ответ, `days` указан

Структура та же плюс блок `forecast` с массивом `forecastday[]` (погодные поля —
как в `current`, дополнительно `day` со сводкой за сутки и `astro` с восходом/закатом,
восходом Луны и `moon_illumination`):

```json
{
  "location": { "...": "..." },
  "current": { "...": "..." },
  "forecast": {
    "forecastday": [
      {
        "date": "2026-10-22",
        "day": {
          "maxtemp_c": 9.1,
          "mintemp_c": 4.2,
          "avgtemp_c": 6.6,
          "maxwind_kph": 18.0,
          "totalprecip_mm": 0.0,
          "avghumidity": 62,
          "condition": { "text": "Partly cloudy", "code": 1003 }
        },
        "astro": {
          "sunrise": "07:24 AM",
          "sunset": "05:11 PM",
          "moonrise": "03:41 PM",
          "moonset": "03:32 AM",
          "moon_phase": "Waxing Gibbous",
          "moon_illumination": 92
        },
        "hour": [ { "time": "2026-10-22 00:00", "temp_c": 5.3, "...": "..." } ]
      }
    ]
  },
  "lunarPhase": { "phase": "Waning Crescent", "age": 25.47 }
}
```

### Поле `lunarPhase`

| Поле | Тип | Описание |
|---|---|---|
| `phase` | string | Название фазы из `lunarphase-js`: `New`, `Waxing Crescent`, `First Quarter`, `Waxing Gibbous`, `Full`, `Waning Gibbous`, `Last Quarter`, `Waning Crescent` |
| `age` | number \| null | Возраст Луны в сутках с новолуния; `null` при некорректной дате |

**Важно:** фаза считается на дату `now + days` (для `days=3` — на третий день прогноза),
а не на каждый день массива `forecastday`. Для календаря это надо будет исправить.

### Матрица фактического поведения (проверено на текущем ключе)

| Запрос | Что вернулось |
|---|---|
| `?q=Moscow` | 200, `location` + `current` + `lunarPhase`, без `forecast` |
| `?q=Moscow&days=1` | 200, `forecastday` = 1 |
| `?q=Moscow&days=3` | 200, `forecastday` = 3 |
| `?q=Moscow&days=14` | 200, `forecastday` = **3** (ограничение тарифа WeatherAPI, не ошибка) |
| `?q=Moscow&days=20` | 200, `forecastday` = 3 (значение вне DTO-лимита не отклоняется) |
| `?q=Moscow&days=abc` | 200, `forecastday` = 1, `lunarPhase.age = null` |
| `?q=Moscow&days=0` | 200, `forecastday` = 1 (`"0"` — truthy, выбран forecast-эндпоинт) |
| без `q` | **502** `{"statusCode":502,"message":"Произошла ошибка получения погоды"}` |

Из этого следуют два вывода: (1) DTO-ограничения декоративные — нужен
`ValidationPipe({ transform: true, whitelist: true })`; (2) фактическое число дней
надо определять по тарифу провайдера, а не по `@Max(14)`.

### Ошибки

| Код | Когда | Тело | Комментарий |
|---|---|---|---|
| 500 | `WEATHER_API_KEY` не задан | `{"statusCode":500,"message":"Internal server error"}` | Бросается обычный `Error`, поэтому сообщение не попадает в ответ; в логах — стек |
| 502 | Любая ошибка провайдера: 4xx/5xx, таймаут 15 с, сеть, неверный `q` | `{"statusCode":502,"message":"Произошла ошибка получения погоды"}` | Причина проглатывается — диагностика невозможна |
| 404 | Неизвестный маршрут (например, `GET /api`) | стандартное тело Nest | — |

Не реализовано, но нужно клиентам: 400 на невалидные параметры, 429 при исчерпании
квоты провайдера, поле `code`/`providerMessage` в ошибке, `requestId` для поддержки.

### Ограничения провайдера и ключа

- Провайдер: **WeatherAPI.com**, `baseURL = https://api.weatherapi.com/v1`,
  таймаут 15 000 мс, до 3 редиректов.
- Ключ хранится на сервере (`WEATHER_API_KEY`) и в ответ клиенту не попадает.
- Ключ передаётся в query-строке запроса к провайдеру, поэтому исходящие URL нельзя
  логировать целиком.
- Квота бесплатного тарифа ограничена (порядка 1 млн вызовов/мес) и **не кэшируется** —
  каждый клиентский запрос = один вызов провайдера.

### Пример обработки на клиенте

```ts
async function getWeather(q: string, days?: number) {
  const url = new URL('/api/weather', 'http://localhost:4200');
  url.searchParams.set('q', q);
  if (days) url.searchParams.set('days', String(days));

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}
```

---

## Чего в API ещё нет

Ниже — контракты, которые появятся при развитии (детали и обоснование — в
[07-target-architecture.md](07-target-architecture.md), [08-roadmap.md](08-roadmap.md)):

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/api/health` | liveness/readiness, статус провайдера и БД |
| `GET` | `/api/water-bodies?bbox=&q=` | поиск водоёмов и точек |
| `GET` | `/api/water-bodies/:id` | карточка водоёма: тип, глубина, течение, правила |
| `GET` | `/api/fish` | справочник видов и профилей повадок |
| `GET` | `/api/calendar?spotId=&from=&to=` | календарь с оценками дней и окнами активности |
| `GET` | `/api/recommendations?spotId=&date=&speciesId=` | рекомендация «что взять» |
| `POST` | `/api/reports` | создать отчёт об улове |
| `GET` | `/api/reports?spotId=&speciesId=&from=` | лента отчётов локации |
| `GET` | `/api/rules?regionId=&date=` | запреты, нормы, минимальные размеры |
| `POST` | `/api/auth/*` | регистрация/вход, профиль |

Общие требования к будущим эндпоинтам: версионирование (`/api/v1`), пагинация
(`cursor`/`limit`), единый формат ошибок, `ETag`/`Cache-Control` для справочников,
идемпотентность записи (`Idempotency-Key`) для отчётов.
