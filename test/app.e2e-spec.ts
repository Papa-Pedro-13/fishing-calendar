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

const currentWeather = {
  location: { name: 'Moscow' },
  current: { temp_c: 7 },
};

const forecastWeather = {
  location: { name: 'Moscow' },
  current: { temp_c: 7 },
  forecast: {
    forecastday: [{ date: '2026-10-22' }, { date: '2026-10-23' }],
  },
};

describe('API (e2e)', () => {
  let app: NestFastifyApplication;
  let httpGet: jest.Mock;

  beforeAll(async () => {
    httpGet = jest.fn((url: string) =>
      of({ data: url === '/forecast.json' ? forecastWeather : currentWeather })
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

  it('GET /api/weather без q → 400', async () => {
    await request(app.getHttpServer()).get('/api/weather').expect(400);
  });

  it('GET /api/weather?days=abc → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/weather?q=Moscow&days=abc')
      .expect(400);
  });

  it.each(['0', '20'])('GET /api/weather с days=%s → 400', async (days) => {
    await request(app.getHttpServer())
      .get(`/api/weather?q=Moscow&days=${days}`)
      .expect(400);
  });

  it('GET /api/weather с неизвестным параметром → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/weather?q=Moscow&foo=bar')
      .expect(400);
  });

  it('GET /api/weather без days отдаёт текущую погоду и фазу Луны', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/weather?q=Moscow')
      .expect(200);

    expect(response.body.current).toEqual({ temp_c: 7 });
    expect(response.body.lunarPhase.phase).toEqual(expect.any(String));
    expect(response.body.forecast).toBeUndefined();
    expect(httpGet).toHaveBeenCalledWith(
      '/current.json',
      expect.objectContaining({
        params: expect.objectContaining({ q: 'Moscow' }),
      })
    );
  });

  it('GET /api/weather?days=2 отдаёт фазу Луны на каждый день', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/weather?q=Moscow&days=2')
      .expect(200);

    const forecastDays = response.body.forecast.forecastday;
    expect(forecastDays).toHaveLength(2);
    expect(forecastDays[0].lunarPhase).toEqual({
      phase: expect.any(String),
      age: expect.any(Number),
    });
    expect(forecastDays[0].lunarPhase.age).not.toBe(
      forecastDays[1].lunarPhase.age
    );
    expect(httpGet).toHaveBeenCalledWith(
      '/forecast.json',
      expect.objectContaining({
        params: expect.objectContaining({ q: 'Moscow', days: 2 }),
      })
    );
  });
});
