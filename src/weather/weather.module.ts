import { Module } from '@nestjs/common';
import { WeatherCache } from './weather.cache';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
      baseURL: 'https://api.weatherapi.com/v1',
    }),
  ],
  controllers: [WeatherController],
  providers: [WeatherService, WeatherCache],
})
export class WeatherModule {}
