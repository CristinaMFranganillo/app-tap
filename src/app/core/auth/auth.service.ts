import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User, UserRole } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  private userSubject = new BehaviorSubject<User | null>(this.loadUser());
  readonly currentUser$ = this.userSubject.asObservable();

  private loadUser(): User | null {
    const raw = localStorage.getItem(this.USER_KEY);
    try {
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      localStorage.removeItem(this.USER_KEY);
      return null;
    }
  }

  login(user: User, token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.userSubject.next(user);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.userSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  hasRole(roles: UserRole[]): boolean {
    const user = this.userSubject.getValue();
    return user ? roles.includes(user.rol) : false;
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.userSubject.getValue();
  }
}
