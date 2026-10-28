import { AppFormsService } from './forms/app-forms.service';
import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideBuiltInFormFields } from '@theredhead/lucid-forms';
import { routes } from './app.routes';

// Angular 21: zoneless by default — change detection is driven by signals.
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    provideBuiltInFormFields(),
    provideAppInitializer(() => inject(AppFormsService).load()),
  ],
};
