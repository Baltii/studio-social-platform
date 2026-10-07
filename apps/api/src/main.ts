import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.enableShutdownHooks();
  app.setGlobalPrefix("v1");

  const openApiConfig = new DocumentBuilder().setTitle("Studio Social API").setVersion("0.1.0").addBearerAuth().build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, openApiConfig));

  const port = Number(process.env.API_PORT ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be a valid TCP port");
  }
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
