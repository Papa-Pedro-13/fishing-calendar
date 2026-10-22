# 04. Что сделано: состояние реализации и технический долг

Дата среза: **22.10.2026**. Источник — чтение кода, `npm ci`, `npm run build`,
`npm test`, `npm run test:e2e` и HTTP-проверки локального сервера.

## 1. Сводка

| Направление | Статус | Комментарий |
|---|---|---|
| Каркас приложения (NestJS + Fastify) | ✅ готово | Поднимается, маршруты маппятся, Swagger работает |
| Нормализованная модель ответа | ✅ готово | Провайдер приводится к внутренней модели в маппере; сырой JSON WeatherAPI наружу не отдаётся |
| Получение текущей погоды | ✅ готово | Прокси к WeatherAPI.com, 15 с таймаут |
| Прогноз на N дней | ⚠️ ограничение провайдера | API принимает `days` 1–14, но бесплатный тариф отдаёт ≤3 дней |
| Фаза Луны | ✅ готово | На каждый день прогноза; для текущей погоды — на `date` или сегодня |
| Конфигурация окружения | ✅ готово | `.env.local` → `.env`, есть `.env.example` |
| Валидация входных данных | ✅ готово | Глобальный `ValidationPipe`, `mode`/`days`/`date`, запрет лишних параметров |
| Обработка ошибок | ✅ готово | 400/429/502/503, причина провайдера — в логах |
| Кэширование | ⚠️ базовое | In-memory TTL 10/30 мин и выдача устаревших данных при сбое; нет stale-while-revalidate и распределённого кэша |
| Логирование и наблюдаемость | ⚠️ базовое | `request-id`, логи запросов, `/api/health`; метрик нет |
| Тесты (unit/e2e) | ✅ зелёные | 27 unit + 18 e2e |
| Линт | ❌ сломан конфиг | `npm run lint` падает: плагин prettier закомментирован, правило включено |
| База данных и миграции | ❌ отсутствует | — |
| Домен: рыбы, водоёмы, отчёты, рекомендации | ❌ отсутствует | Реализован только погодный слой |
| Аутентификация и пользователи | ❌ отсутствует | — |
| Фронтенд | ❌ отсутствует | — |
| CI/CD, Docker, деплой | ❌ отсутствует | `.env.example` добавлен, остального нет |

Иными словами: **погодный слой доведён до эксплуатационного вида** (валидация, ошибки,
кэш, логи, тесты, нормализованный контракт), но продуктовая логика календаря рыбалки
ещё не начата.

## 2. Что именно реализовано

### 2.1. Bootstrap (`src/main.ts`, `src/app.setup.ts`)

- Создание приложения на **Fastify** (`NestFastifyApplication`).
- `configureApp(app)` — единая настройка для `main.ts` и e2e-тестов:
  - Swagger: `DocumentBuilder` («Fishing Calendar», `1.0`), UI на `/docs`, схема на `/docs-json`;
  - `enableCors()`, `setGlobalPrefix('api')`;
  - `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })`;
  - `LoggingInterceptor`.
- Порт: `Number(process.env.PORT) || 4200` — строковое значение из env приводится к числу,
  иначе Fastify открывал случайный порт.
- `bootstrap().catch(...)` логирует стек и завершает процесс с кодом 1.

### 2.2. Конфигурация (`src/app.module.ts`)

- `ConfigModule.forRoot({ envFilePath: ['.env.local', '.env'], isGlobal: true })` —
  `.env.local` приоритетнее `.env`.
- `WeatherModule` и `HealthController` в модуле.

### 2.3. Модуль погоды

**`weather.module.ts`** — `HttpModule.register({ timeout: 15000, maxRedirects: 3, baseURL: 'https://api.weatherapi.com/v1' })`, провайдеры `WeatherService` и `WeatherCache`.

**`providers/weatherapi.types.ts`** — сырые типы ответа WeatherAPI, только используемые маппером поля. Внутренний слой, наружу не выходит.

**`dto/get-weather.dto.ts`** — `GetWeatherDto`: `q` (`IsString`, `IsNotEmpty`, ≤128),
`mode` (`IsEnum(WeatherMode)`), `days` (`@Type(() => Number)`, `IsInt`, 1–14),
`date` (`YYYY-MM-DD` + `IsDateString({ strict: true })`).

**`dto/weather-response.dto.ts`** — нормализованная модель ответа с `@ApiProperty`:
`location`, `current`, `forecast[]`, `lunarPhase`, `stale`. Единая структура для обоих режимов.

**`weather.mapper.ts`** — чистые функции `mapWeather`, `mapLocation`, `mapCurrent`,
`mapForecastDay`, `lunarPhaseFor`. Переименовывает поля в доменные имена, приводит `is_day`
к boolean, считает фазу Луны на полдень UTC каждой даты прогноза.

**`weather.cache.ts`** — in-memory TTL-кэш: `get` (только свежее), `getStale`
(истёкшее, но в пределах 6 ч), `set` с TTL, вытеснение самой старой записи при 500+.

**`weather.service.ts`**
- Проверка `WEATHER_API_KEY` через `ConfigService` → 503 при отсутствии.
- `resolveRequest`: выбирает режим (`mode` или наличие `days`), отклоняет
  `days` при `mode=current` и `date` при `mode=forecast`, тримит `q`, строит ключ кэша
  `wx:{mode}:{q}:{days|-}:{date|-}`.
- Кэш-хит → ответ без вызова провайдера.
- Промах → запрос к `/current.json` или `/forecast.json`, маппинг, запись в кэш.
- Сбой провайдера → лог причины, затем устаревший кэш с `stale: true` либо ошибка:
  400 (некорректный `q`/запрос), 429 (квота), 502 (401/403, 5xx, сеть, таймаут).

**`weather.controller.ts`** — `GET /api/weather`, `@ApiTags('weather')`, тип ответа
`WeatherResponseDto`, 400/429/502/503 в Swagger.

### 2.4. Health и логирование

- `health/health.controller.ts` — `GET /api/health` → `{ status, uptime, timestamp }`.
- `common/interceptors/logging.interceptor.ts` — генерирует или переиспользует
  `x-request-id`, возвращает его в заголовке, логирует метод, путь, код, длительность;
  4xx — `warn`, 5xx — `error`.

### 2.5. Пакет и зависимости

- Имя пакета — `fishing-calendar`.
- Удалены неиспользуемые `nestjs-zod`, `@nestjs/mapped-types`, `@fastify/static`, `update`
  и константы `ONE_DAY`/`TWO_WEEKS`; лок сократился с 1483 до 805 пакетов.
- `class-transformer` добавлен — без него `ValidationPipe` не работает.

## 3. Результаты проверки

```text
npm ci                  → успешно (лок на 805 пакетов установлен с нуля)
npm run build           → успешно, dist/ собран
npm test                → 3 suites, 27 tests passed
npm run test:e2e        → 1 suite, 18 tests passed
npm run lint            → FAIL: «could not find plugin prettier» (конфиг, см. #21)
```

HTTP-проверки запущенного `node dist/main.js`:

| Запрос | Результат |
|---|---|
| `GET /api/health` | 200, `status=ok`, заголовок `x-request-id` присутствует |
| `GET /api/weather?q=Moscow` | 502 — из песочницы провайдер недоступен (таймаут 15 с); маппинг ошибки сработал |
| `GET /api/weather?q=Moscow&mode=current&days=2` | 400 |
| `GET /api/weather?q=Moscow&date=2026-13-40` | 400 |
| `GET /docs` | 200 |
| `GET /docs-json` | в схеме `WeatherResponseDto`, `ForecastDayDto`, `temperatureC`, `lunarPhase`, `stale` |

Ограничение проверки: исходящие запросы к `api.weatherapi.com` из окружения сборки
упираются в таймаут, поэтому живой ответ с реальными данными не получен. Маппинг
провайдерского формата проверен unit-тестами на фикстурах, а API в сборе — e2e-тестами
с моком `HttpService`.

## 4. Дефекты: что закрыто и что осталось

### 4.1. Закрыто

| # | Было | Как исправлено |
|---|---|---|
| 1 | Читался только `.env`, приложение падало без ручного `export` | `envFilePath: ['.env.local', '.env']`, добавлен `.env.example` |
| 2 | `days=abc` давал 200 и `lunarPhase.age = null`, ограничения DTO не действовали | Глобальный `ValidationPipe` + `@Type(() => Number)`, `IsInt`, `IsNotEmpty` |
| 3 | e2e не запускались: ESM-сборки `@nestjs/axios`/`@nestjs/config` | `tsconfig.test.json` + `transformIgnorePatterns` в обеих конфигурациях Jest |
| 4 | Устаревший e2e-тест на `GET /` → `Hello World!` | Переписан под `/api/health` и `/api/weather` с моком провайдера |
| 5 | Нет ключа → `Error` → 500 без сообщения | `ServiceUnavailableException` → 503 с явным текстом |
| 6 | Причина ошибки провайдера проглатывалась | Логируются статус, код и сообщение WeatherAPI; маппинг в 400/429/502, ключ → 502 |
| 7 | Не было кэша | In-memory TTL-кэш (10/30 мин), stale до 6 ч с флагом `stale`, лимит 500 записей |
| 8 | Сырой ответ провайдера как публичный контракт | Внутренняя модель + маппер, Swagger-схема ответа |
| 9 | Одна фаза Луны на весь прогноз | `forecast[].lunarPhase` считается для каждой даты |
| 10 | Не было логов, request-id и health-check | `LoggingInterceptor`, `x-request-id`, `GET /api/health` |
| 11 | Swagger не описывал ответы и ошибки | `@ApiOkResponse({ type })`, 400/429/502/503, `@ApiTags` |
| 12 | `days` управлял эндпоинтом, горизонтом и датой Луны | Разделены `mode`, `days`, `date`; несовместимые сочетания → 400 |
| 13 | Пустые `AppController`/`AppService` | Удалены, вместо них `HealthController` |
| 14 | Неиспользуемые зависимости и константы | Удалены `nestjs-zod`, `@nestjs/mapped-types`, `@fastify/static`, `update`, `ONE_DAY`, `TWO_WEEKS` |
| 15 | Имя пакета `english-tutor` | `fishing-calendar` в `package.json` и локе |
| 16 | README — заготовка Nest | Заменён описанием проекта со ссылкой на `docs/` |
| 20 | `bootstrap()` без обработки ошибок | `bootstrap().catch(...)` с логом и `process.exit(1)` |

Попутно найдено и закрыто: `PORT` из env приходил строкой, из-за чего Fastify открывал
случайный порт вместо 4200.

### 4.2. Остаётся

Severity: **S2** — ломает корректность или наблюдаемость, **S3** — качество.

| # | Sev | Проблема | Где | Как исправить |
|---|---|---|---|---|
| 17 | S3 | `noImplicitAny: false`, `strictBindCallApply: false` | `tsconfig.json` | Включить по мере появления доменного кода |
| 18 | S3 | Нет Docker и CI | корень | Dockerfile + CI: lint без `--fix`, build, тесты |
| 19 | S3 | CORS `*` | `app.setup.ts` | Список origin из конфига перед появлением авторизации |
| 21 | S2 | `npm run lint` падает: плагин prettier закомментирован, правило `prettier/prettier` включено | `eslint.config.mjs` | Включить `eslintPluginPrettierRecommended` или убрать правило |
| 22 | S3 | Кэш без фонового обновления (stale-while-revalidate) и без дедупликации одновременных запросов | `weather.cache.ts` | Фоновый refresh + in-flight dedupe |
| 23 | S3 | API не версионирован (`/api`, не `/api/v1`) | `app.setup.ts` | Ввести `v1` до появления внешних клиентов |
| 24 | S3 | Провайдер не спрятан за интерфейсом, нет второго источника (Open-Meteo) | `weather.service.ts` | `WeatherProvider` + фолбэк (ADR A8, статус «обсуждается») |
| 25 | S3 | Нет rate limit и ретраев с backoff | весь проект | Лимитер на входящие, ретраи на 429/5xx провайдера |
| 26 | S3 | Нет контрактных тестов против реального провайдера | `test/` | Отдельный набор с ключом в CI по расписанию |

## 5. Ближайшие действия

1. Починить конфиг ESLint (#21) и завести CI: lint без `--fix`, build, unit, e2e; затем Dockerfile (#18).
2. Перейти к домену по [08-roadmap.md](08-roadmap.md): Prisma + PostgreSQL, `region`, `water_body`,
   `spot`, `fish_species`, `species_profile`.
3. Ввести провайдер-интерфейс и Open-Meteo как второй источник (#24), фоновое обновление кэша (#22),
   rate limit (#25).
4. Добавить `calendar`-эндпоинт и ночной предрасчёт; после этого — фронтенд.
5. Перед внешними клиентами — версионирование API (#23) и список origin в CORS (#19).

Полный план с оценками и приоритетами — [08-roadmap.md](08-roadmap.md).
