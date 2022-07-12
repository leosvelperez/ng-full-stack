import { Module } from '@nestjs/common';
import { HomeController } from '../../api/home.controller';

@Module({
  imports: [],
  controllers: [HomeController],
  providers: [],
})
export class AppModule {}
