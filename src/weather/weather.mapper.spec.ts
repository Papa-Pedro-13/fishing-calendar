import { WeatherApiResponse } from './providers/weatherapi.types';
import { mapCurrent, mapWeather } from './weather.mapper';

const providerResponse: WeatherApiResponse = {
  location: {
    name: 'Moscow',
    region: 'Moscow City',
    country: 'Russia',
    lat: 55.7522,
    lon: 37.6156,
    tz_id: 'Europe/Moscow',
    localtime: '2026-10-22 19:43',
  },
  current: {
    last_updated: '2026-10-22 19:30',
    temp_c: 8.9,
    is_day: 0,
    condition: { text: 'Cloudy', icon: '//cdn.weatherapi.com/x.png', code: 1006 },
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
  },
  forecast: {
    forecastday: [
      {
        date: '2026-10-22',
        day: {
          maxtemp_c: 9.1,
          mintemp_c: 4.2,
          avgtemp_c: 6.6,
          maxwind_kph: 18,
          totalprecip_mm: 0,
          avghumidity: 62,
          daily_chance_of_rain: 12,
          uv: 1,
          condition: { text: 'Partly cloudy', icon: '//cdn/x.png', code: 1003 },
        },
        astro: {
          sunrise: '07:24 AM',
          sunset: '05:11 PM',
          moonrise: '03:41 PM',
          moonset: '03:32 AM',
          moon_phase: 'Waxing Gibbous',
          moon_illumination: 92,
        },
      },
      {
        date: '2026-10-23',
        day: {
          maxtemp_c: 7.4,
          mintemp_c: 3.1,
          avgtemp_c: 5.2,
          maxwind_kph: 22,
          totalprecip_mm: 1.2,
          avghumidity: 70,
          daily_chance_of_rain: 60,
          uv: 1,
          condition: { text: 'Light rain', icon: '//cdn/y.png', code: 1183 },
        },
        astro: {
          sunrise: '07:26 AM',
          sunset: '05:09 PM',
          moonrise: '04:01 PM',
          moonset: '04:12 AM',
          moon_phase: 'Waxing Gibbous',
          moon_illumination: 96,
        },
      },
    ],
  },
};

describe('weather.mapper', () => {
  it('нормализует локацию и текущую погоду', () => {
    const weather = mapWeather(providerResponse, { includeForecast: false });

    expect(weather.location).toEqual({
      name: 'Moscow',
      region: 'Moscow City',
      country: 'Russia',
      latitude: 55.7522,
      longitude: 37.6156,
      timezone: 'Europe/Moscow',
      localTime: '2026-10-22 19:43',
    });
    expect(weather.current).toMatchObject({
      temperatureC: 8.9,
      feelsLikeC: 6.6,
      humidityPercent: 34,
      pressureMb: 1033,
      windKph: 14.4,
      gustsKph: 21.6,
      windDirection: 'ESE',
      cloudPercent: 75,
      precipitationMm: 0,
      visibilityKm: 10,
      uvIndex: 0,
      condition: { text: 'Cloudy', code: 1006 },
      isDay: false,
      updatedAt: '2026-10-22 19:30',
    });
  });

  it('для mode=current не отдаёт прогноз', () => {
    const weather = mapWeather(providerResponse, { includeForecast: false });

    expect(weather.forecast).toEqual([]);
    expect(weather.stale).toBe(false);
    expect(weather.lunarPhase.phase).toEqual(expect.any(String));
  });

  it('маппит прогноз с фазой Луны на каждый день', () => {
    const weather = mapWeather(providerResponse, { includeForecast: true });

    expect(weather.forecast).toHaveLength(2);
    expect(weather.forecast[0]).toMatchObject({
      date: '2026-10-22',
      minTemperatureC: 4.2,
      maxTemperatureC: 9.1,
      avgTemperatureC: 6.6,
      maxWindKph: 18,
      totalPrecipitationMm: 0,
      avgHumidityPercent: 62,
      chanceOfRainPercent: 12,
      uvIndex: 1,
      condition: { text: 'Partly cloudy', code: 1003 },
      sunrise: '07:24 AM',
      sunset: '05:11 PM',
    });
    expect(weather.forecast[0].lunarPhase.age).not.toBe(
      weather.forecast[1].lunarPhase.age
    );
    expect(weather.forecast[1].lunarPhase.age).toEqual(expect.any(Number));
  });

  it('считает фазу Луны на переданную дату', () => {
    const today = mapWeather(providerResponse, {
      includeForecast: false,
      phaseDate: new Date('2026-10-22T12:00:00.000Z'),
    });
    const later = mapWeather(providerResponse, {
      includeForecast: false,
      phaseDate: new Date('2026-11-05T12:00:00.000Z'),
    });

    expect(today.lunarPhase.age).not.toBe(later.lunarPhase.age);
  });

  it('не падает без current и без прогноза', () => {
    const weather = mapWeather(
      { location: { name: 'Moscow', lat: 55.75, lon: 37.62 } },
      { includeForecast: true }
    );

    expect(weather.current).toBeNull();
    expect(weather.forecast).toEqual([]);
    expect(weather.location.region).toBeNull();
    expect(weather.location.timezone).toBeNull();
  });

  it('трактует is_day как boolean', () => {
    const current = mapCurrent({ ...providerResponse.current!, is_day: 1 });

    expect(current.isDay).toBe(true);
  });
});
