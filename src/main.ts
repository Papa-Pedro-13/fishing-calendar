import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  configureApp(app);

  const port = Number(process.env.PORT) || 4200;
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    'Не удалось запустить приложение',
    error instanceof Error ? error.stack : String(error)
  );
  process.exit(1);
});
