import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms' // Add this import
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { BrowserModule } from '@angular/platform-browser'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { RouterModule } from '@angular/router'
import { CodemirrorModule } from '@ctrl/ngx-codemirror'
import { StarRatingModule } from 'angular-star-rating'
import { AutosizeModule } from 'ngx-autosize'
import { NgxSpinnerComponent } from 'ngx-spinner'

import { AppComponent } from './app.component'
import { EditingComponent } from './editing/editing.component'

@NgModule({
  declarations: [AppComponent, EditingComponent],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule, // Add FormsModule here
    CodemirrorModule,
    RouterModule.forRoot([
      { path: '', redirectTo: '/editing', pathMatch: 'full' },
      { path: 'editing', component: EditingComponent },
      { path: '**', redirectTo: '/404' },
    ]),
    MatIconModule,
    MatIconButton,
    MatButton,
    MatFormFieldModule,
    NgxSpinnerComponent,
    MatFormField,
    StarRatingModule.forRoot(),
    AutosizeModule,
  ],
  providers: [{ provide: Window, useValue: window }, provideHttpClient(withInterceptorsFromDi())],
})
export class AppModule {}
