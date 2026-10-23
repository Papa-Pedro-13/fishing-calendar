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
import { WeatherResponseDto } from './dto/weather-response.dto';
import { WeatherService } from './weather.service';

@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  @ApiOperation({
    summary: 'Текущая погода или прогноз с фазой Луны',
    description:
      'mode=current — текущая погода, mode=forecast — прогноз на days дней (1–14, по умолчанию 1). ' +
      'Без mode: при наличии days выбирается forecast, иначе current. ' +
      'date (YYYY-MM-DD) задаёт дату для фазы Луны и допустим только для mode=current. ' +
      'Ответ — нормализованная модель, а не сырой ответ WeatherAPI.',
  })
  @ApiOkResponse({ type: WeatherResponseDto })
  @ApiBadRequestResponse({
    description:
      'Некорректные q, mode, days или date либо недопустимое сочетание параметров',
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
