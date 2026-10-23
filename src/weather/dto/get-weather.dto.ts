import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WeatherMode {
  Current = 'current',
  Forecast = 'forecast',
}

export class GetWeatherDto {
  @ApiProperty({
    description: 'Город, координаты «lat,lon», почтовый индекс или IP',
    example: 'Moscow',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  q: string;

  @ApiPropertyOptional({
    enum: WeatherMode,
    description:
      'Что запрашиваем: текущую погоду или прогноз. По умолчанию current, ' +
      'а если передан days — forecast',
    example: WeatherMode.Current,
  })
  @IsOptional()
  @IsEnum(WeatherMode)
  mode?: WeatherMode;

  @ApiPropertyOptional({
    description: 'Горизонт прогноза в днях, только для mode=forecast',
    minimum: 1,
    maximum: 14,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  days?: number;

  @ApiPropertyOptional({
    description:
      'Дата, на которую считать фазу Луны (YYYY-MM-DD), только для mode=current',
    example: '2026-11-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date должен быть в формате YYYY-MM-DD',
  })
  @IsDateString(
    { strict: true },
    { message: 'date должен быть корректной датой' }
  )
  date?: string;
}
