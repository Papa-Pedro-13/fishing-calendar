import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { Moon } from 'lunarphase-js';
import { firstValueFrom } from 'rxjs';
import { GetWeatherDto } from './dto';

export interface LunarPhase {
  phase: string;
  age: number;
}

interface ProviderForecastDay {
  date?: string;
  [key: string]: unknown;
}

interface ProviderForecast {
  forecastday?: ProviderForecastDay[];
  [key: string]: unknown;
}

export interface WeatherProviderResponse {
  forecast?: ProviderForecast;
  [key: string]: unknown;
}

interface ProviderErrorBody {
  error?: { code?: number; message?: string };
}

export type WeatherResponse = WeatherProviderResponse & {
  lunarPhase: LunarPhase;
};

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async getWeather(dto: GetWeatherDto): Promise<WeatherResponse> {
    const { q, days } = dto;
    const apiKey = this.configService.get<string>('WEATHER_API_KEY');

    if (!apiKey) {
      this.logger.error('WEATHER_API_KEY is not configured');
      throw new ServiceUnavailableException(
        'WEATHER_API_KEY is not configured'
      );
    }

    const endpoint = days ? '/forecast.json' : '/current.json';

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<WeatherProviderResponse>(endpoint, {
          params: { key: apiKey, q, days },
        })
      );

      return {
        ...data,
        lunarPhase: this.getLunarPhase(),
        ...(days ? { forecast: this.withDailyLunarPhase(data?.forecast) } : {}),
      };
    } catch (error) {
      throw this.toHttpException(error, q);
    }
  }

  getLunarPhase(date?: Date): LunarPhase {
    return {
      phase: Moon.lunarPhase(date),
      age: Moon.lunarAge(date),
    };
  }

  private withDailyLunarPhase(forecast?: ProviderForecast) {
    const forecastday = (forecast?.forecastday ?? []).map((day) => ({
      ...day,
      lunarPhase: this.getLunarPhase(day.date ? new Date(day.date) : undefined),
    }));

    return { ...forecast, forecastday };
  }

  private toHttpException(error: unknown, query: string): HttpException {
    const axiosError = error as AxiosError<ProviderErrorBody>;
    const status = axiosError?.response?.status;
    const providerError = axiosError?.response?.data?.error;

    this.logger.error(
      `WeatherAPI request for "${query}" failed: status=${status ?? 'none'} ` +
        `code=${providerError?.code ?? 'none'} ` +
        `message=${providerError?.message ?? axiosError?.message ?? 'unknown'}`
    );

    if (status === HttpStatus.BAD_REQUEST) {
      return new BadRequestException(
        providerError?.message ?? 'WeatherAPI отклонил запрос'
      );
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return new HttpException(
        'Превышен лимит запросов к WeatherAPI',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      return new BadGatewayException('WeatherAPI отклонил ключ доступа');
    }

    return new BadGatewayException('Произошла ошибка получения погоды');
  }
}
