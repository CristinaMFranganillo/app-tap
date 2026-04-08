import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from './auth.service';

describe('roleGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['hasRole', 'whenSessionReady']);
    authService.whenSessionReady.and.returnValue(Promise.resolve());
    router = jasmine.createSpyObj('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue({} as any);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('returns true when user has required role', async () => {
    authService.hasRole.and.returnValue(true);
    const route = { data: { roles: ['admin'] } } as any as ActivatedRouteSnapshot;
    const result = await TestBed.runInInjectionContext(() =>
      roleGuard(route, {} as RouterStateSnapshot)
    );
    expect(result).toBeTrue();
  });

  it('redirects to / when user lacks required role', async () => {
    authService.hasRole.and.returnValue(false);
    const route = { data: { roles: ['admin'] } } as any as ActivatedRouteSnapshot;
    await TestBed.runInInjectionContext(() =>
      roleGuard(route, {} as RouterStateSnapshot)
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});
