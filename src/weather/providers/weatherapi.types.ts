/**
 * Сырые типы ответа WeatherAPI.com — только те поля, которые использует маппер.
 * Наружу этот формат не отдаётся: клиенты получают нормализованную модель.
 */
export interface WeatherApiCondition {
  text: string;
  icon: string;
  code: number;
}

export interface WeatherApiCurrent {
  last_updated: string;
  temp_c: number;
  is_day: number;
  condition: WeatherApiCondition;
  wind_kph: number;
  wind_dir: string;
  pressure_mb: number;
  humidity: number;
  cloud: number;
  feelslike_c: number;
  precip_mm: number;
  vis_km: number;
  uv: number;
  gust_kph: number;
}

export interface WeatherApiAstro {
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moon_phase: string;
  moon_illumination: number;
}

export interface WeatherApiDay {
  maxtemp_c: number;
  mintemp_c: number;
  avgtemp_c: number;
  maxwind_kph: number;
  totalprecip_mm: number;
  avghumidity: number;
  daily_chance_of_rain: number;
  uv: number;
  condition: WeatherApiCondition;
}

export interface WeatherApiForecastDay {
  date: string;
  day: WeatherApiDay;
  astro: WeatherApiAstro;
}

export interface WeatherApiForecast {
  forecastday: WeatherApiForecastDay[];
}

export interface WeatherApiLocation {
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
  tz_id?: string;
  localtime?: string;
}

export interface WeatherApiResponse {
  location: WeatherApiLocation;
  current?: WeatherApiCurrent;
  forecast?: WeatherApiForecast;
}
