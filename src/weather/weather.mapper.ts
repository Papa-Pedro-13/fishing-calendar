import { Moon } from 'lunarphase-js';
import {
  CurrentWeatherDto,
  ForecastDayDto,
  LunarPhaseDto,
  WeatherConditionDto,
  WeatherLocationDto,
  WeatherResponseDto,
} from './dto/weather-response.dto';
import {
  WeatherApiCurrent,
  WeatherApiDay,
  WeatherApiForecastDay,
  WeatherApiLocation,
  WeatherApiResponse,
} from './providers/weatherapi.types';

export interface MapWeatherOptions {
  /** Дата, на которую считается верхнеуровневая фаза Луны. */
  phaseDate?: Date;
  includeForecast: boolean;
}

/**
 * Фаза Луны на полдень указанной даты (UTC), чтобы часовой пояс не сдвигал сутки.
 */
export function lunarPhaseFor(date?: Date): LunarPhaseDto {
  return {
    phase: Moon.lunarPhase(date),
    age: Moon.lunarAge(date),
  };
}

export function mapWeather(
  data: WeatherApiResponse,
  options: MapWeatherOptions
): WeatherResponseDto {
  return {
    location: mapLocation(data.location),
    current: data.current ? mapCurrent(data.current) : null,
    forecast: options.includeForecast
      ? (data.forecast?.forecastday ?? []).map(mapForecastDay)
      : [],
    lunarPhase: lunarPhaseFor(options.phaseDate),
    stale: false,
  };
}

export function mapLocation(location: WeatherApiLocation): WeatherLocationDto {
  return {
    name: location.name,
    region: location.region ?? null,
    country: location.country ?? null,
    latitude: location.lat,
    longitude: location.lon,
    timezone: location.tz_id ?? null,
    localTime: location.localtime ?? null,
  };
}

export function mapCurrent(current: WeatherApiCurrent): CurrentWeatherDto {
  return {
    temperatureC: current.temp_c,
    feelsLikeC: current.feelslike_c,
    humidityPercent: current.humidity,
    pressureMb: current.pressure_mb,
    windKph: current.wind_kph,
    gustsKph: current.gust_kph,
    windDirection: current.wind_dir,
    cloudPercent: current.cloud,
    precipitationMm: current.precip_mm,
    visibilityKm: current.vis_km,
    uvIndex: current.uv,
    condition: mapCondition(current.condition),
    isDay: current.is_day === 1,
    updatedAt: current.last_updated,
  };
}

export function mapForecastDay(day: WeatherApiForecastDay): ForecastDayDto {
  return {
    date: day.date,
    ...mapDaySummary(day.day),
    condition: mapCondition(day.day.condition),
    sunrise: day.astro?.sunrise ?? null,
    sunset: day.astro?.sunset ?? null,
    lunarPhase: lunarPhaseFor(new Date(`${day.date}T12:00:00.000Z`)),
  };
}

function mapDaySummary(day: WeatherApiDay) {
  return {
    minTemperatureC: day.mintemp_c,
    maxTemperatureC: day.maxtemp_c,
    avgTemperatureC: day.avgtemp_c,
    maxWindKph: day.maxwind_kph,
    totalPrecipitationMm: day.totalprecip_mm,
    avgHumidityPercent: day.avghumidity,
    chanceOfRainPercent: day.daily_chance_of_rain,
    uvIndex: day.uv,
  };
}

function mapCondition(condition: WeatherApiDay['condition']): WeatherConditionDto {
  return {
    text: condition.text,
    code: condition.code,
  };
}
