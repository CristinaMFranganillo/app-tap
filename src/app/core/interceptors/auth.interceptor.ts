import { HttpInterceptorFn } from '@angular/common/http';

// Supabase SDK manages authentication headers internally via the JS client.
// This interceptor is kept as a placeholder for future custom HTTP calls.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
