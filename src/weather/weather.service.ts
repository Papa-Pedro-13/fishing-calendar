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
import { firstValueFrom } from 'rxjs';
import { GetWeatherDto, WeatherMode } from './dto';
import { WeatherResponseDto } from './dto/weather-response.dto';
import { WeatherApiResponse } from './providers/weatherapi.types';
import { WeatherCache } from './weather.cache';
import {
  CURRENT_WEATHER_TTL_MS,
  FORECAST_TTL_MS,
} from './weather.constants';
import { mapWeather } from './weather.mapper';

interface ProviderErrorBody {
  error?: { code?: number; message?: string };
}

interface WeatherRequest {
  q: string;
  mode: WeatherMode;
  days?: number;
  phaseDate?: Date;
  endpoint: string;
  cacheKey: string;
  ttlMs: number;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cache: WeatherCache
  ) {}

  async getWeather(dto: GetWeatherDto): Promise<WeatherResponseDto> {
    const apiKey = this.configService.get<string>('WEATHER_API_KEY');

    if (!apiKey) {
      this.logger.error('WEATHER_API_KEY is not configured');
      throw new ServiceUnavailableException(
        'WEATHER_API_KEY is not configured'
      );
    }

    const request = this.resolveRequest(dto);
    const cached = this.cache.get<WeatherResponseDto>(request.cacheKey);

    if (cached) {
      this.logger.debug(`Отдаю из кэша: ${request.cacheKey}`);
      return cached;
    }

    try {
      const weather = await this.fetchWeather(request, apiKey);
      this.cache.set(request.cacheKey, weather, request.ttlMs);

      return weather;
    } catch (error) {
      this.logProviderFailure(error, dto.q);

      const stale = this.cache.getStale<WeatherResponseDto>(request.cacheKey);

      if (stale) {
        this.logger.warn(
          `Провайдер недоступен, отдаю устаревшие данные: ${request.cacheKey}`
        );
        return { ...stale, stale: true };
      }

      throw this.mapProviderError(error);
    }
  }

  private resolveRequest(dto: GetWeatherDto): WeatherRequest {
    const mode =
      dto.mode ??
      (dto.days === undefined ? WeatherMode.Current : WeatherMode.Forecast);

    if (mode === WeatherMode.Current && dto.days !== undefined) {
      throw new BadRequestException(
        'days допустим только вместе с mode=forecast'
      );
    }

    if (mode === WeatherMode.Forecast && dto.date !== undefined) {
      throw new BadRequestException(
        'date допустим только вместе с mode=current'
      );
    }

    const q = dto.q.trim();

    if (!q) {
      throw new BadRequestException('q не должен быть пустой строкой');
    }

    const days = mode === WeatherMode.Forecast ? (dto.days ?? 1) : undefined;
    const phaseDate = dto.date
      ? new Date(`${dto.date}T12:00:00.000Z`)
      : undefined;

    return {
      q,
      mode,
      days,
      phaseDate,
      endpoint: mode === WeatherMode.Forecast ? '/forecast.json' : '/current.json',
      ttlMs:
        mode === WeatherMode.Forecast ? FORECAST_TTL_MS : CURRENT_WEATHER_TTL_MS,
      cacheKey: [
        'wx',
        mode,
        q.toLowerCase(),
        days ?? '-',
        dto.date ?? '-',
      ].join(':'),
    };
  }

  private async fetchWeather(
    request: WeatherRequest,
    apiKey: string
  ): Promise<WeatherResponseDto> {
    const { data } = await firstValueFrom(
      this.httpService.get<WeatherApiResponse>(request.endpoint, {
        params: { key: apiKey, q: request.q, days: request.days },
      })
    );

    return mapWeather(data, {
      includeForecast: request.mode === WeatherMode.Forecast,
      phaseDate: request.phaseDate,
    });
  }

  private logProviderFailure(error: unknown, query: string): void {
    const axiosError = error as AxiosError<ProviderErrorBody>;
    const providerError = axiosError?.response?.data?.error;

    this.logger.error(
      `WeatherAPI request for "${query}" failed: status=${axiosError?.response?.status ?? 'none'} ` +
        `code=${providerError?.code ?? 'none'} ` +
        `message=${providerError?.message ?? axiosError?.message ?? 'unknown'}`
    );
  }

  private mapProviderError(error: unknown): HttpException {
    const axiosError = error as AxiosError<ProviderErrorBody>;
    const status = axiosError?.response?.status;
    const providerError = axiosError?.response?.data?.error;

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
