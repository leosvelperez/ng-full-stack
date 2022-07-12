import { Controller, Get } from '@nestjs/common';

@Controller('home')
export class HomeController {
  @Get()
  getData() {
    return { message: 'Welcome to home!' };
  }
}
