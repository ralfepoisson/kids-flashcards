import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideToastr } from 'ngx-toastr';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideToastr({
      positionClass: 'toast-bottom-right',
      closeButton: true,
      preventDuplicates: true,
      timeOut: 3500,
    }),
  ],
};
