import { Observable, catchError, map, of, startWith } from 'rxjs';

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

export function toLoadState<T>(
  source$: Observable<T>,
): Observable<LoadState<T>> {
  return source$.pipe(
    map((data) => ({ status: 'success', data }) as LoadState<T>),
    startWith({ status: 'loading' } as LoadState<T>),
    catchError((err) =>
      of({
        status: 'error',
        error: err?.message ?? 'Something went wrong.',
      } as LoadState<T>),
    ),
  );
}

export const isLoading = <T>(s: LoadState<T>): s is { status: 'loading' } =>
  s.status === 'loading';

export const isSuccess = <T>(
  s: LoadState<T>,
): s is { status: 'success'; data: T } => s.status === 'success';

export const isError = <T>(
  s: LoadState<T>,
): s is { status: 'error'; error: string } => s.status === 'error';
