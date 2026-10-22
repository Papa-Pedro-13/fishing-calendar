import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { GetWeatherDto } from './dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Moon } from 'lunarphase-js';
import { ONE_DAY } from 'src/common';

@Injectable()
export class WeatherService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async getWeather(dto: GetWeatherDto) {
    const { q, days } = dto;
    const apiKey = this.configService.get<string>('WEATHER_API_KEY');

    if (!apiKey) {
      throw new Error('WEATHER_API_KEY is not configured');
    }

    const endpoint = days ? '/forecast.json' : '/current.json';
    const lunarPhase = this.getLunarPhase(
      days ? new Date(Date.now() + ONE_DAY * days) : undefined
    );

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(endpoint, {
          params: {
            key: process.env.WEATHER_API_KEY,
            q,
            days,
          },
        })
      );
      return { ...data, lunarPhase };
    } catch (error) {
      throw new HttpException(
        'Произошла ошибка получения погоды',
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  getLunarPhase(date?: Date) {
    const age = Moon.lunarAge(date);
    const phase = Moon.lunarPhase(date);

    return { phase, age };
  }
}
