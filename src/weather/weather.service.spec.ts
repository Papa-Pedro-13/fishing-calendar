import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  let service: WeatherService;
  let httpGet: jest.Mock;
  let configGet: jest.Mock;

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

  const axiosError = (status: number, message?: string) => ({
    response: {
      status,
      data: message ? { error: { code: 1006, message } } : undefined,
    },
    message: `Request failed with status code ${status}`,
  });

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    httpGet = jest.fn();
    configGet = jest.fn().mockReturnValue('test-key');

    service = new WeatherService(
      { get: httpGet } as unknown as HttpService,
      { get: configGet } as unknown as ConfigService
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('возвращает текущую погоду и фазу Луны без прогноза', async () => {
    httpGet.mockReturnValue(of({ data: currentWeather }));

    const result = await service.getWeather({ q: 'Moscow' });

    expect(result.current).toEqual({ temp_c: 7 });
    expect(result.lunarPhase.phase).toEqual(expect.any(String));
    expect(result.lunarPhase.age).toEqual(expect.any(Number));
    expect(result.forecast).toBeUndefined();
    expect(httpGet).toHaveBeenCalledWith('/current.json', {
      params: { key: 'test-key', q: 'Moscow', days: undefined },
    });
  });

  it('считает фазу Луны для каждого дня прогноза', async () => {
    httpGet.mockReturnValue(of({ data: forecastWeather }));

    const result = await service.getWeather({ q: 'Moscow', days: 2 });

    const forecastDays = result.forecast?.forecastday;
    expect(forecastDays).toHaveLength(2);
    expect(forecastDays?.[0].lunarPhase?.phase).toEqual(expect.any(String));
    expect(forecastDays?.[0].lunarPhase?.age).not.toBe(
      forecastDays?.[1].lunarPhase?.age
    );
    expect(httpGet).toHaveBeenCalledWith('/forecast.json', {
      params: { key: 'test-key', q: 'Moscow', days: 2 },
    });
  });

  it('отдаёт 503, если ключ WeatherAPI не настроен', async () => {
    configGet.mockReturnValue(undefined);

    await expect(service.getWeather({ q: 'Moscow' })).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('пробрасывает 400 провайдера с его сообщением', async () => {
    httpGet.mockReturnValue(
      throwError(() => axiosError(400, 'No matching location found.'))
    );

    const error = await service.getWeather({ q: 'Nowhere' }).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('No matching location found.');
  });

  it('отдаёт 429 при исчерпании квоты', async () => {
    httpGet.mockReturnValue(throwError(() => axiosError(429)));

    const error = await service.getWeather({ q: 'Moscow' }).catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('отдаёт 502 при неверном ключе провайдера', async () => {
    httpGet.mockReturnValue(throwError(() => axiosError(401)));

    await expect(service.getWeather({ q: 'Moscow' })).rejects.toBeInstanceOf(
      BadGatewayException
    );
  });

  it('отдаёт 502 при сетевой ошибке', async () => {
    httpGet.mockReturnValue(throwError(() => new Error('connect ECONNREFUSED')));

    await expect(service.getWeather({ q: 'Moscow' })).rejects.toBeInstanceOf(
      BadGatewayException
    );
  });

  it('getLunarPhase возвращает фазу и возраст для даты', () => {
    const phase = service.getLunarPhase(new Date('2026-10-22T00:00:00Z'));

    expect(phase.phase).toEqual(expect.any(String));
    expect(phase.age).toBeGreaterThanOrEqual(0);
    expect(phase.age).toBeLessThan(30);
  });
});
