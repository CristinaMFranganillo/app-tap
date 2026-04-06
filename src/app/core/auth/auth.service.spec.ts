import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { User } from '../models/user.model';

const mockUser: User = {
  id: '1',
  nombre: 'Juan',
  apellidos: 'García',
  email: 'juan@test.es',
  numeroSocio: '0042',
  rol: 'socio',
  fechaAlta: new Date(),
  activo: true,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('currentUser$ starts as null', (done) => {
    service.currentUser$.subscribe(u => {
      expect(u).toBeNull();
      done();
    });
  });

  it('login sets currentUser$ and stores token', (done) => {
    service.login(mockUser, 'fake-token');
    service.currentUser$.subscribe(u => {
      expect(u?.email).toBe('juan@test.es');
      expect(localStorage.getItem('auth_token')).toBe('fake-token');
      done();
    });
  });

  it('logout clears currentUser$ and removes token', (done) => {
    service.login(mockUser, 'fake-token');
    service.logout();
    service.currentUser$.subscribe(u => {
      expect(u).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
      done();
    });
  });

  it('hasRole returns true for matching role', () => {
    service.login(mockUser, 'fake-token');
    expect(service.hasRole(['socio'])).toBeTrue();
    expect(service.hasRole(['admin', 'moderador'])).toBeFalse();
  });

  it('getToken returns stored token', () => {
    service.login(mockUser, 'fake-token');
    expect(service.getToken()).toBe('fake-token');
  });
});
