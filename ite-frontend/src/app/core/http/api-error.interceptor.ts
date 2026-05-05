import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Minimal global HTTP error handler. Funnel real backend errors into
 * a predictable shape so callers can surface them via LoadState.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const message =
        err.error?.message ||
        err.statusText ||
        `Request failed with status ${err.status}`;
      // TODO hook in toast / telemetry once wired.
      return throwError(() => new Error(message));
    }),
  );
};
