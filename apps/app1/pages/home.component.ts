import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { map } from 'rxjs';

@Component({
  template: '<p>{{ message$ | async }}</p>',
  styles: [],
})
export class HomeComponent {
  message$ = this.http
    .get<{ message: string }>('/api/home')
    .pipe(map(({ message }) => message));

  constructor(private readonly http: HttpClient) {}
}

@NgModule({
  declarations: [HomeComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([
      { path: '', component: HomeComponent, pathMatch: 'full' },
    ]),
  ],
})
export class HomeModule {}
