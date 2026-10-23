import { ApiProperty } from '@nestjs/swagger';

export class WeatherConditionDto {
  @ApiProperty({ description: 'Текстовое описание погоды', example: 'Cloudy' })
  text: string;

  @ApiProperty({ description: 'Код условия WeatherAPI', example: 1006 })
  code: number;
}

export class LunarPhaseDto {
  @ApiProperty({
    description: 'Название фазы Луны',
    example: 'Waxing Gibbous',
  })
  phase: string;

  @ApiProperty({
    description: 'Возраст Луны в сутках от новолуния',
    example: 14.47,
  })
  age: number;
}

export class WeatherLocationDto {
  @ApiProperty({ description: 'Название места', example: 'Moscow' })
  name: string;

  @ApiProperty({
    description: 'Регион',
    nullable: true,
    example: 'Moscow City',
  })
  region: string | null;

  @ApiProperty({ description: 'Страна', nullable: true, example: 'Russia' })
  country: string | null;

  @ApiProperty({ description: 'Широта', example: 55.7522 })
  latitude: number;

  @ApiProperty({ description: 'Долгота', example: 37.6156 })
  longitude: number;

  @ApiProperty({
    description: 'Часовой пояс IANA',
    nullable: true,
    example: 'Europe/Moscow',
  })
  timezone: string | null;

  @ApiProperty({
    description: 'Локальное время места',
    nullable: true,
    example: '2026-10-22 19:43',
  })
  localTime: string | null;
}

export class CurrentWeatherDto {
  @ApiProperty({ description: 'Температура воздуха, °C', example: 8.9 })
  temperatureC: number;

  @ApiProperty({ description: 'Ощущается как, °C', example: 6.6 })
  feelsLikeC: number;

  @ApiProperty({ description: 'Влажность, %', example: 34 })
  humidityPercent: number;

  @ApiProperty({ description: 'Давление, гПа', example: 1033 })
  pressureMb: number;

  @ApiProperty({ description: 'Ветер, км/ч', example: 14.4 })
  windKph: number;

  @ApiProperty({ description: 'Порывы ветра, км/ч', example: 21.6 })
  gustsKph: number;

  @ApiProperty({ description: 'Направление ветра', example: 'ESE' })
  windDirection: string;

  @ApiProperty({ description: 'Облачность, %', example: 75 })
  cloudPercent: number;

  @ApiProperty({ description: 'Осадки, мм', example: 0 })
  precipitationMm: number;

  @ApiProperty({ description: 'Видимость, км', example: 10 })
  visibilityKm: number;

  @ApiProperty({ description: 'УФ-индекс', example: 0 })
  uvIndex: number;

  @ApiProperty({ type: () => WeatherConditionDto })
  condition: WeatherConditionDto;

  @ApiProperty({ description: 'Сейчас день?', example: false })
  isDay: boolean;

  @ApiProperty({
    description: 'Время измерения по данным провайдера',
    example: '2026-10-22 19:30',
  })
  updatedAt: string;
}

export class ForecastDayDto {
  @ApiProperty({ description: 'Дата прогноза', example: '2026-10-22' })
  date: string;

  @ApiProperty({ description: 'Минимальная температура, °C', example: 4.2 })
  minTemperatureC: number;

  @ApiProperty({ description: 'Максимальная температура, °C', example: 9.1 })
  maxTemperatureC: number;

  @ApiProperty({ description: 'Средняя температура, °C', example: 6.6 })
  avgTemperatureC: number;

  @ApiProperty({ description: 'Максимальный ветер, км/ч', example: 18 })
  maxWindKph: number;

  @ApiProperty({ description: 'Осадки за сутки, мм', example: 0 })
  totalPrecipitationMm: number;

  @ApiProperty({ description: 'Средняя влажность, %', example: 62 })
  avgHumidityPercent: number;

  @ApiProperty({ description: 'Вероятность дождя, %', example: 12 })
  chanceOfRainPercent: number;

  @ApiProperty({ description: 'УФ-индекс', example: 1 })
  uvIndex: number;

  @ApiProperty({ type: () => WeatherConditionDto })
  condition: WeatherConditionDto;

  @ApiProperty({ description: 'Восход Солнца', nullable: true, example: '07:24 AM' })
  sunrise: string | null;

  @ApiProperty({ description: 'Закат Солнца', nullable: true, example: '05:11 PM' })
  sunset: string | null;

  @ApiProperty({ type: () => LunarPhaseDto })
  lunarPhase: LunarPhaseDto;
}

export class WeatherResponseDto {
  @ApiProperty({ type: () => WeatherLocationDto })
  location: WeatherLocationDto;

  @ApiProperty({
    type: () => CurrentWeatherDto,
    nullable: true,
    description: 'Текущая погода; null, если провайдер её не вернул',
  })
  current: CurrentWeatherDto | null;

  @ApiProperty({
    type: () => [ForecastDayDto],
    description: 'Прогноз по дням; пустой массив для mode=current',
  })
  forecast: ForecastDayDto[];

  @ApiProperty({
    type: () => LunarPhaseDto,
    description: 'Фаза Луны на сегодня или на запрошенную дату',
  })
  lunarPhase: LunarPhaseDto;

  @ApiProperty({
    description:
      'true, если провайдер недоступен и отданы устаревшие данные из кэша',
    example: false,
  })
  stale: boolean;
}
