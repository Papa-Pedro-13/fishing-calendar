import { HttpService } from '@nestjs/axios';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { WeatherApiResponse } from '../src/weather/providers/weatherapi.types';

const location = {
  name: 'Moscow',
  region: 'Moscow City',
  country: 'Russia',
  lat: 55.7522,
  lon: 37.6156,
  tz_id: 'Europe/Moscow',
  localtime: '2026-10-22 19:43',
};

const current = {
  last_updated: '2026-10-22 19:30',
  temp_c: 8.9,
  is_day: 0,
  condition: { text: 'Cloudy', icon: '//cdn/x.png', code: 1006 },
  wind_kph: 14.4,
  wind_dir: 'ESE',
  pressure_mb: 1033,
  humidity: 34,
  cloud: 75,
  feelslike_c: 6.6,
  precip_mm: 0,
  vis_km: 10,
  uv: 0,
  gust_kph: 21.6,
};

const forecastDay = (date: string) => ({
  date,
  day: {
    maxtemp_c: 9.1,
    mintemp_c: 4.2,
    avgtemp_c: 6.6,
    maxwind_kph: 18,
    totalprecip_mm: 0,
    avghumidity: 62,
    daily_chance_of_rain: 12,
    uv: 1,
    condition: { text: 'Partly cloudy', icon: '//cdn/y.png', code: 1003 },
  },
  astro: {
    sunrise: '07:24 AM',
    sunset: '05:11 PM',
    moonrise: '03:41 PM',
    moonset: '03:32 AM',
    moon_phase: 'Waxing Gibbous',
    moon_illumination: 92,
  },
});

const providerCurrent: WeatherApiResponse = { location, current };

const providerForecast: WeatherApiResponse = {
  location,
  current,
  forecast: {
    forecastday: [forecastDay('2026-10-22'), forecastDay('2026-10-23')],
  },
};

describe('API (e2e)', () => {
  let app: NestFastifyApplication;
  let httpGet: jest.Mock;

  const providerCalls = () => httpGet.mock.calls.length;

  beforeAll(async () => {
    httpGet = jest.fn((url: string) =>
      of({ data: url === '/forecast.json' ? providerForecast : providerCurrent })
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue({ get: httpGet })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → 200 и status=ok', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  describe('валидация параметров', () => {
    it('без q → 400', async () => {
      await request(app.getHttpServer()).get('/api/weather').expect(400);
    });

    it('q из пробелов → 400', async () => {
      await request(app.getHttpServer())
        .get('/api/weather?q=%20%20')
        .expect(400);
    });

    it('days=abc → 400', async () => {
      await request(app.getHttpServer())
        .get('/api/weather?q=Moscow&days=abc')
        .expect(400);
    });

    it.each(['0', '20'])('days=%s → 400', async (days) => {
      await request(app.getHttpServer())
        .get(`/api/weather?q=Moscow&days=${days}`)
        .expect(400);
    });

    it('days при mode=current → 400', async () => {
      await request(app.getHttpServer())
        .get('/api/weather?q=Moscow&mode=current&days=2')
        .expect(400);
    });

    it('date при mode=forecast → 400', async () => {
      await request(app.getHttpServer())
        .get('/api/weather?q=Moscow&mode=forecast&date=2026-11-01')
        .expect(400);
    });

    it.each(['2026-13-40', '01.11.2026', '2026-11-01T10:00:00Z'])(
      'date=%s → 400',
      async (date) => {
        await request(app.getHttpServer())
          .get(`/api/weather?q=Moscow&date=${encodeURIComponent(date)}`)
          .expect(400);
      }
    );

    it('неизвестный mode → 400', async () => {
      await request(app.getHttpServer())
        .get('/api/weather?q=Moscow&mode=hourly')
        .expect(400);
    });

    it('неизвестный параметр → 400', async () => {
      await request(app.getHttpServer())
        .get('/api/weather?q=Moscow&foo=bar')
        .expect(400);
    });
  });

  it('GET /api/weather отдаёт нормализованную текущую погоду', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/weather?q=Moscow')
      .expect(200);

    expect(response.body.location).toMatchObject({
      name: 'Moscow',
      latitude: 55.7522,
      longitude: 37.6156,
    });
    expect(response.body.current).toMatchObject({
      temperatureC: 8.9,
      humidityPercent: 34,
      condition: { text: 'Cloudy', code: 1006 },
      isDay: false,
    });
    expect(response.body.forecast).toEqual([]);
    expect(response.body.lunarPhase.phase).toEqual(expect.any(String));
    expect(response.body.lunarPhase.age).toEqual(expect.any(Number));
    expect(response.body.stale).toBe(false);
    expect(httpGet).toHaveBeenCalledWith(
      '/current.json',
      expect.objectContaining({
        params: expect.objectContaining({ q: 'Moscow' }),
      })
    );
  });

  it('GET /api/weather?mode=forecast&days=2 отдаёт прогноз с Луной на день', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/weather?q=Kazan&mode=forecast&days=2')
      .expect(200);

    expect(response.body.forecast).toHaveLength(2);
    expect(response.body.forecast[0]).toMatchObject({
      date: '2026-10-22',
      minTemperatureC: 4.2,
      maxTemperatureC: 9.1,
      chanceOfRainPercent: 12,
      sunrise: '07:24 AM',
    });
    expect(response.body.forecast[0].lunarPhase.age).not.toBe(
      response.body.forecast[1].lunarPhase.age
    );
    expect(httpGet).toHaveBeenCalledWith(
      '/forecast.json',
      expect.objectContaining({
        params: expect.objectContaining({ q: 'Kazan', days: 2 }),
      })
    );
  });

  it('days без mode по-прежнему означает прогноз', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/weather?q=Samara&days=1')
      .expect(200);

    expect(response.body.forecast.length).toBeGreaterThan(0);
    expect(httpGet).toHaveBeenCalledWith(
      '/forecast.json',
      expect.objectContaining({
        params: expect.objectContaining({ q: 'Samara', days: 1 }),
      })
    );
  });

  it('отдаёт фазу Луны на заданную дату', async () => {
    const today = await request(app.getHttpServer())
      .get('/api/weather?q=Tver')
      .expect(200);
    const future = await request(app.getHttpServer())
      .get('/api/weather?q=Tver&date=2026-11-05')
      .expect(200);

    expect(future.body.lunarPhase.age).not.toBe(today.body.lunarPhase.age);
  });

  it('повторный запрос обслуживается из кэша', async () => {
    const before = providerCalls();

    await request(app.getHttpServer()).get('/api/weather?q=Omsk').expect(200);
    const afterFirst = providerCalls();
    await request(app.getHttpServer()).get('/api/weather?q=Omsk').expect(200);
    const afterSecond = providerCalls();

    expect(afterFirst - before).toBe(1);
    expect(afterSecond).toBe(afterFirst);
  });
});
