# Fishing Calendar — бэкенд календаря рыбалки

Сервис помогает рыболову решить, **когда, где и на что ловить**: учитывает погоду,
повадки видов рыб, особенности водоёма и свежие отчёты о рыбалке, а на выходе даёт
рекомендации по снасти, наживке и прикормке.

Сейчас реализован только первый кирпич — **получение погоды** (WeatherAPI.com) с
добавлением фазы Луны. Предметная область (виды рыб, водоёмы, отчёты, рекомендации)
ещё не реализована.

NestJS 11 · Fastify · TypeScript · Swagger · Jest

## Быстрый старт

```bash
npm ci
export WEATHER_API_KEY=<ключ WeatherAPI.com>
npm run start:dev
```

- API: `http://localhost:4200/api`
- Swagger UI: `http://localhost:4200/docs`
- Пример: `curl "http://localhost:4200/api/weather?q=Moscow&days=3"`

Переменные окружения: `PORT` (по умолчанию 4200), `WEATHER_API_KEY` (обязательна).
Приложение читает `.env`; при необходимости используйте `.env.local`.

## Документация

Вся документация находится в папке **[docs/](docs/README.md)**:

- [Обзор продукта](docs/01-product-overview.md)
- [Архитектура (текущее состояние)](docs/02-architecture.md)
- [Справочник API](docs/03-api-reference.md)
- [Что сделано и технический долг](docs/04-implementation-status.md)
- [Предметная область и данные](docs/05-domain-model.md)
- [Модель рекомендаций](docs/06-recommendations.md)
- [Целевая архитектура](docs/07-target-architecture.md)
- [План развития](docs/08-roadmap.md)

## Команды

```bash
npm run build        # сборка в dist/
npm run start:dev    # watch-режим
npm run start:prod   # запуск собранного приложения
npm test             # unit-тесты
npm run test:e2e     # e2e-тесты (сейчас требуют починки, см. docs/04)
npm run lint         # ESLint
```
