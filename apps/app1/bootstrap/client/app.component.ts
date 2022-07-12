import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';

@Component({
  selector: 'tusk-root',
  template: `
    <ul>
      <li><a [routerLink]="['/']">Home</a></li>
    </ul>

    <router-outlet></router-outlet>
  `,
  styles: [],
})
export class AppComponent {
  title = 'app1';
  apiResult$ = this.http.get('/api');

  constructor(private readonly http: HttpClient) {}
}
