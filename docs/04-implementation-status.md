# 04. Что сделано: состояние реализации и технический долг

Дата среза: **22.10.2026**. Источник — чтение кода и проверочный запуск в чистом окружении
(`npm ci`, `npm run build`, `node dist/main.js`, HTTP-запросы к локальному серверу).

## 1. Сводка

| Направление | Статус | Комментарий |
|---|---|---|
| Каркас приложения (NestJS + Fastify) | ✅ готово | Поднимается, маршруты маппятся, Swagger работает |
| Получение текущей погоды | ✅ готово | Прокси к WeatherAPI.com, 15 с таймаут |
| Прогноз на N дней | ⚠️ работает частично | Прокси есть; фактически отдаёт ≤3 дней на текущем тарифе; `days` не валидируется |
| Фаза Луны | ⚠️ работает частично | Одно значение на ответ, а не на каждый день; падает в `null` при мусорном `days` |
| Конфигурация окружения | ❌ не работает «из коробки» | `ConfigModule` ищет `.env`, в проекте `.env.local` |
| Валидация входных данных | ❌ отсутствует | `ValidationPipe` не подключён, DTO-декораторы не действуют |
| Обработка ошибок | ⚠️ минимальная | 502 без причины, 500 вместо 503 при отсутствии ключа |
| Логирование и наблюдаемость | ❌ отсутствует | Только дефолтные логи Nest при старте |
| Кэширование, лимиты, ретраи | ❌ отсутствует | Каждый запрос — вызов провайдера |
| Тесты (unit/e2e) | ❌ красные | Unit-тестов нет; e2e не компилируется |
| База данных и миграции | ❌ отсутствует | — |
| Домен: рыбы, водоёмы, отчёты, рекомендации | ❌ отсутствует | Только DTO-интерфейсы ответа WeatherAPI |
| Аутентификация и пользователи | ❌ отсутствует | — |
| Фронтенд | ❌ отсутствует | — |
| CI/CD, Docker, деплой | ❌ отсутствует | — |

Иными словами: реализован **один инфраструктурный сценарий** — «получить погоду у
внешнего API и добавить Луну». Продуктовая логика календаря рыбалки не начата.

## 2. Что именно реализовано

### 2.1. Bootstrap (`src/main.ts`)
- Создание приложения на **Fastify** (`NestFastifyApplication`).
- Swagger: `DocumentBuilder` с заголовком «Fishing Calendar» и версией `1.0`,
  UI на `/docs`.
- `enableCors()` — все origin, все методы.
- `setGlobalPrefix('api')`.
- Порт: `process.env.PORT ?? 4200`.

### 2.2. Конфигурация (`src/app.module.ts`)
- `ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true })`.
- `WeatherModule` в импортах.

### 2.3. Модуль погоды
**`weather.module.ts`**
- `HttpModule.register({ timeout: 15000, maxRedirects: 3, baseURL: 'https://api.weatherapi.com/v1' })`.

**`weather.controller.ts`**
- `GET /api/weather` c `@Query() GetWeatherDto`, делегирует в сервис.

**`weather.service.ts`**
- Выбор эндпоинта провайдера по наличию `days`.
- Проверка наличия `WEATHER_API_KEY` через `ConfigService`.
- Вызов провайдера через `firstValueFrom(HttpService.get(...))`.
- Добавление `lunarPhase = { phase, age }` через `lunarphase-js`.
- Ошибки провайдера превращаются в `HttpException(502)`.

**`dto/get-weather.dto.ts`**
- `GetWeatherDto`: `q: string`, `days?: number` с `@IsString/@IsNumber/@IsOptional/@Min(1)/@Max(14)`
  и `@ApiProperty`-описаниями.
- Полный набор интерфейсов ответа WeatherAPI (`GetWeatherResponse`, `Current`, `Condition`,
  `Forecast`, `Forecastday`, `Astro`, `Day`, `Location`) — **не используются** для
  типизации возвращаемого значения: метод возвращает «что прислал провайдер» + Луна.

### 2.4. Общее
- `src/common/constants`: `ONE_DAY` (используется), `TWO_WEEKS` (**не используется**).
- Конфиги: ESLint 9 flat, Prettier (`singleQuote`, `semi`, `trailingComma: es5`), Nest CLI,
  `tsconfig` (nodenext, ES2023, `strictNullChecks`).
- `README.md` — стандартная заготовка Nest (не описывает проект).

## 3. Результаты проверки

```text
npm ci                  → успешно (1411 пакетов)
npm run build            → успешно, dist/ собран (CommonJS)
node dist/main.js        → «Nest application successfully started», маршруты:
                           Mapped {/api/weather, GET}
GET /api                 → 404 (маршрута нет)
GET /api/weather?q=Moscow            → 200, location + current + lunarPhase
GET /api/weather?q=Moscow&days=3     → 200, forecast.forecastday = 3
GET /api/weather            (без q)  → 502 "Произошла ошибка получения погоды"
npm test                 → FAIL: No tests found (exit 1)
npm run test:e2e         → FAIL: SyntaxError: Unexpected token 'export' (@nestjs/axios)
```

`npm run lint` в рамках среза не запускался (скрипт использует `--fix` и менял бы код).
Учесть при настройке CI: нужен отдельный lint-режим без записи.

## 4. Дефекты и технический долг

Severity: **S1** — блокирует запуск/эксплуатацию, **S2** — ломает корректность или
наблюдаемость, **S3** — качество/поддерживаемость.

| # | Sev | Проблема | Где | Последствие | Как исправить |
|---|---|---|---|---|---|
| 1 | S1 | `ConfigModule` ждёт `.env`, реальный файл — `.env.local` | `app.module.ts` | Без ручного `export WEATHER_API_KEY` эндпоинт возвращает 500 | `envFilePath: ['.env.local', '.env']`, добавить `.env.example` |
| 2 | S1 | Нет глобального `ValidationPipe` | `main.ts` | `days=abc` даёт 200 и `lunarPhase.age=null`; `days=0`, `days=20` не отклоняются; `q` не проверяется | `app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))` |
| 3 | S1 | e2e-тесты не запускаются | `test/*`, `package.json` | Нет регрессионной защиты; CI невозможен | Настроить ts-jest для ESM (`transformIgnorePatterns`, `extensionsToTreatAsEsm`) или `isolatedModules`-трансформ; переписать тест под `/api/weather` |
| 4 | S1 | Устаревший e2e-тест на `GET /` → `"Hello World!"` | `test/app.e2e-spec.ts` | Даже после починки трансформа тест упадёт: маршрута нет, есть префикс `api` | Переписать под актуальные маршруты + мок провайдера |
| 5 | S2 | Отсутствие ключа → `Error` → 500 | `weather.service.ts` | Неверный код (это конфигурационная ошибка, а не сбой), сообщение теряется | `throw new InternalServerErrorException(...)` или падать на старте (fail-fast при bootstrap) |
| 6 | S2 | Причина ошибки провайдера проглатывается | `weather.service.ts` | Нельзя отличить таймаут, 401 (плохой ключ), 400 (плохой `q`) и 429 (квота) | Логировать `error.response.status/data`, маппить в 400/429/502 и отдавать `code` |
| 7 | S2 | Нет кэша | `weather.service.ts` | Расход квоты, задержка, риск блокировки ключа при всплеске | Кэш по `q + тип + дата` + TTL (см. [07](07-target-architecture.md)) |
| 8 | S2 | «Сырой» ответ провайдера как публичный контракт | `weather.service.ts` | Любое изменение API провайдера ломает клиентов; в ответ утекает лишнее | Внутренняя модель + маппер + версионирование контракта |
| 9 | S2 | Одна фаза Луны на весь прогноз | `weather.service.ts` | Для календаря неверно: нужна фаза на каждый день | Считать фазу по каждому `forecastday.date` (или брать `astro.moon_phase` и нормализовать) |
| 10 | S2 | Нет логирования, request-id, health-check | весь проект | Невозможно эксплуатировать и диагностировать | `Logger`, интерсептор request-id, `GET /api/health` |
| 11 | S2 | Swagger не описывает ответы и ошибки | `weather.controller.ts` | Контракт недокументирован для фронтенда | `@ApiOkResponse`, `@ApiBadRequestResponse`, `@ApiTags`, DTO ответа |
| 12 | S3 | `days` управляет и эндпоинтом, и датой Луны, и лимитом | `weather.service.ts` | Смешаны три смысла; `"0"` ведёт себя неожиданно | Разделить параметры: `mode`/`days`/`date` |
| 13 | S3 | Пустые `AppController`/`AppService` | `src/app.*` | Мёртвый код, `GET /api` → 404 | Удалить или сделать `GET /api/health` |
| 14 | S3 | Неиспользуемые зависимости и константа | `package.json`, `common` | Лишний вес, ложные сигналы о стеке | Удалить `nestjs-zod`, `@nestjs/mapped-types`, `@fastify/static`, `update`, `TWO_WEEKS` (проверив, что не нужны планам) |
| 15 | S3 | Имя пакета `english-tutor` | `package.json` | Путаница в логировании/артефактах | Переименовать в `fishing-calendar` |
| 16 | S3 | README — заготовка Nest | `README.md` | Вводит в заблуждение | Заменён кратким описанием со ссылкой на `docs/` |
| 17 | S3 | `noImplicitAny: false`, `strictBindCallApply: false` | `tsconfig.json` | Пропускает ошибки типов | Включить по мере появления доменного кода |
| 18 | S3 | Нет `.env.example`, нет Docker/CI | корень | Онбординг и деплой вручную | Добавить в этап 0 роадмапа |
| 19 | S3 | CORS `*` | `main.ts` | Для API без авторизации терпимо, с авторизацией — нет | Список origin из конфига |
| 20 | S3 | `bootstrap()` без обработки ошибок | `main.ts` | Падение старта без внятного лога | `.catch(err => { logger.error(err); process.exit(1); })` |

## 5. Ближайшие действия (этап «стабилизация»)

1. Починить окружение (`#1`) и валидацию (`#2`) — это два самых дешёвых и самых
   заметных исправления.
2. Привести тесты в рабочее состояние (`#3`, `#4`) и закрыть `WeatherService` unit-тестами
   с моком `HttpService`: успех, 401, таймаут, отсутствие ключа, `days` без значения.
3. Ввести внутреннюю модель погоды и маппер (`#8`), посчитать Луну на каждый день (`#9`).
4. Добавить health-check, request-id и структурные логи (`#10`), затем кэш (`#7`).
5. Удалить мёртвый код и зависимости (`#13`, `#14`), переименовать пакет (`#15`),
   добавить `.env.example`, Dockerfile и CI (линт без `--fix`, build, тесты).

Полный план с оценками и приоритетами — [08-roadmap.md](08-roadmap.md).
