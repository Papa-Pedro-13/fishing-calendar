import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { GetWeatherDto } from './dto';
import { WeatherService } from './weather.service';

@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  @ApiOperation({
    summary: 'Текущая погода или прогноз с фазой Луны',
    description:
      'Без days возвращает текущую погоду, с days — прогноз на 1–14 дней. ' +
      'Для прогноза фаза Луны считается отдельно на каждый день (forecast.forecastday[].lunarPhase).',
  })
  @ApiOkResponse({
    description: 'Ответ WeatherAPI, дополненный полем lunarPhase',
  })
  @ApiBadRequestResponse({
    description: 'Некорректный q или days (допустимо 1–14)',
  })
  @ApiTooManyRequestsResponse({ description: 'Исчерпана квота WeatherAPI' })
  @ApiBadGatewayResponse({
    description: 'WeatherAPI недоступен или отклонил ключ доступа',
  })
  @ApiServiceUnavailableResponse({
    description: 'Не задан WEATHER_API_KEY на сервере',
  })
  async getWeather(@Query() query: GetWeatherDto) {
    return this.weatherService.getWeather(query);
  }
}
