# Fishing Calendar — бэкенд календаря рыбалки

Сервис помогает рыболову решить, **когда, где, на что и как ловить**. На входе — погода и
почасовой прогноз, фаза Луны, особенности водоёма, повадки вида рыбы, свежие отчёты и
региональные правила; на выходе — готовый **гайд на рыбалку**: окна активности, снасть,
поводок, крючок, наживка, прикормка, тактика и предупреждения.

Гайд формирует **ИИ-модель** (внешний LLM-провайдер), которой передаются все перечисленные
факторы. При этом оценку дня и юридические ограничения считает детерминированный код:
модель не выбирает запреты и не придумывает цифры — она объясняет и собирает рекомендацию
из проверенных фактов. Подробно — в [docs/06-recommendations.md](docs/06-recommendations.md).

Сейчас реализован погодный слой — **получение и нормализация погоды** (WeatherAPI.com)
с фазой Луны, TTL-кэшем, валидацией параметров и тестами. Предметная область (виды рыб,
водоёмы, отчёты) и ИИ-рекомендации ещё не реализованы — см.
[docs/04-implementation-status.md](docs/04-implementation-status.md).

NestJS 11 · Fastify · TypeScript · Swagger · Jest · LLM (план)

## Быстрый старт

```bash
npm ci
cp .env.example .env      # и вписать WEATHER_API_KEY
npm run start:dev
```

- API: `http://localhost:4200/api`
- Swagger UI: `http://localhost:4200/docs`
- Проверка: `curl "http://localhost:4200/api/health"`
- Пример: `curl "http://localhost:4200/api/weather?q=Moscow&mode=forecast&days=3"`

Переменные окружения: `PORT` (по умолчанию 4200), `WEATHER_API_KEY` (обязательна).
Файлы читаются в порядке `.env.local` → `.env`, пример — `.env.example`.
Для будущего ИИ-слоя понадобятся `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` (см. docs/07).

## Документация

Вся документация находится в папке **[docs/](docs/README.md)**:

- [Обзор продукта](docs/01-product-overview.md)
- [Архитектура (текущее состояние)](docs/02-architecture.md)
- [Справочник API](docs/03-api-reference.md)
- [Что сделано и технический долг](docs/04-implementation-status.md)
- [Предметная область и данные](docs/05-domain-model.md)
- [ИИ-рекомендации: факты, промпт, гайд](docs/06-recommendations.md)
- [Целевая архитектура](docs/07-target-architecture.md)
- [План развития](docs/08-roadmap.md)

## Команды

```bash
npm run build        # сборка в dist/
npm run start:dev    # watch-режим
npm run start:prod   # запуск собранного приложения
npm test             # unit-тесты
npm run test:e2e     # e2e-тесты
npm run lint         # ESLint (конфиг требует починки, см. docs/04)
```
