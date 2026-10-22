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
import { WeatherMode } from './dto';
import { WeatherApiResponse } from './providers/weatherapi.types';
import { WeatherCache } from './weather.cache';
import { WeatherService } from './weather.service';

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

const providerCurrent: WeatherApiResponse = {
  location,
  current,
};

const providerForecast: WeatherApiResponse = {
  location,
  current,
  forecast: {
    forecastday: [forecastDay('2026-10-22'), forecastDay('2026-10-23')],
  },
};

const axiosError = (status: number, message?: string) => ({
  response: {
    status,
    data: message ? { error: { code: 1006, message } } : undefined,
  },
  message: `Request failed with status code ${status}`,
});

describe('WeatherService', () => {
  let service: WeatherService;
  let httpGet: jest.Mock;
  let configGet: jest.Mock;
  let cache: WeatherCache;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-22T18:00:00.000Z'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    httpGet = jest.fn();
    configGet = jest.fn().mockReturnValue('test-key');
    cache = new WeatherCache();
    service = new WeatherService(
      { get: httpGet } as unknown as HttpService,
      { get: configGet } as unknown as ConfigService,
      cache
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('отдаёт нормализованную модель текущей погоды', async () => {
    httpGet.mockReturnValue(of({ data: providerCurrent }));

    const weather = await service.getWeather({ q: 'Moscow' });

    expect(weather.current?.temperatureC).toBe(8.9);
    expect(weather.forecast).toEqual([]);
    expect(weather.stale).toBe(false);
    expect(httpGet).toHaveBeenCalledWith('/current.json', {
      params: { key: 'test-key', q: 'Moscow', days: undefined },
    });
  });

  it('кэширует ответ и не обращается к провайдеру повторно', async () => {
    httpGet.mockReturnValue(of({ data: providerCurrent }));

    const first = await service.getWeather({ q: 'Moscow' });
    const second = await service.getWeather({ q: 'Moscow' });

    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('кэширует без учёта регистра и пробелов в q', async () => {
    httpGet.mockReturnValue(of({ data: providerCurrent }));

    await service.getWeather({ q: '  Moscow  ' });
    await service.getWeather({ q: 'moscow' });

    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(httpGet).toHaveBeenCalledWith(
      '/current.json',
      expect.objectContaining({ params: expect.objectContaining({ q: 'Moscow' }) })
    );
  });

  it('включает прогноз, если передан только days', async () => {
    httpGet.mockReturnValue(of({ data: providerForecast }));

    const weather = await service.getWeather({ q: 'Moscow', days: 2 });

    expect(weather.forecast).toHaveLength(2);
    expect(httpGet).toHaveBeenCalledWith('/forecast.json', {
      params: { key: 'test-key', q: 'Moscow', days: 2 },
    });
  });

  it('для mode=forecast без days запрашивает один день', async () => {
    httpGet.mockReturnValue(of({ data: providerForecast }));

    await service.getWeather({ q: 'Moscow', mode: WeatherMode.Forecast });

    expect(httpGet).toHaveBeenCalledWith(
      '/forecast.json',
      expect.objectContaining({ params: expect.objectContaining({ days: 1 }) })
    );
  });

  it('отклоняет days при mode=current', async () => {
    await expect(
      service.getWeather({ q: 'Moscow', mode: WeatherMode.Current, days: 2 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('отклоняет date при mode=forecast', async () => {
    await expect(
      service.getWeather({
        q: 'Moscow',
        mode: WeatherMode.Forecast,
        date: '2026-11-01',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('отклоняет пустой q после trim', async () => {
    await expect(service.getWeather({ q: '   ' })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('считает фазу Луны на запрошенную дату', async () => {
    httpGet.mockReturnValue(of({ data: providerCurrent }));

    const today = await service.getWeather({ q: 'Moscow' });
    const later = await service.getWeather({ q: 'Moscow', date: '2026-11-05' });

    expect(later.lunarPhase.age).not.toBe(today.lunarPhase.age);
    expect(httpGet).toHaveBeenCalledTimes(2);
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

  it('отдаёт устаревшие данные, если провайдер упал после истечения TTL', async () => {
    httpGet.mockReturnValue(of({ data: providerCurrent }));
    const fresh = await service.getWeather({ q: 'Moscow' });

    jest.setSystemTime(new Date('2026-10-22T18:11:00.000Z'));
    httpGet.mockReturnValue(throwError(() => axiosError(500)));

    const stale = await service.getWeather({ q: 'Moscow' });

    expect(stale.stale).toBe(true);
    expect(stale.current).toEqual(fresh.current);
    expect(httpGet).toHaveBeenCalledTimes(2);
  });

  it('не отдаёт кэш старше stale-окна', async () => {
    httpGet.mockReturnValue(of({ data: providerCurrent }));
    await service.getWeather({ q: 'Moscow' });

    jest.setSystemTime(new Date('2026-10-23T01:00:00.000Z'));
    httpGet.mockReturnValue(throwError(() => axiosError(500)));

    await expect(service.getWeather({ q: 'Moscow' })).rejects.toBeInstanceOf(
      BadGatewayException
    );
  });
});
