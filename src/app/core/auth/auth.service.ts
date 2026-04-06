import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User, UserRole } from '../models/user.model';
import { supabase } from '../supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$ = this.userSubject.asObservable();

  constructor() {
    // Restaurar sesión al iniciar la app
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        this.loadProfile(data.session.user.id);
      }
    });

    // Escuchar cambios de sesión (login/logout)
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        this.loadProfile(session.user.id);
      } else {
        this.userSubject.next(null);
      }
    });
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      const { data: authUser } = await supabase.auth.getUser();
      const user: User = {
        id: data['id'],
        nombre: data['nombre'],
        apellidos: data['apellidos'],
        email: authUser.user?.email ?? '',
        numeroSocio: data['numero_socio'],
        avatarUrl: data['avatar_url'] ?? undefined,
        rol: data['rol'] as UserRole,
        fechaAlta: new Date(data['fecha_alta']),
        activo: data['activo'],
        firstLogin: data['first_login'] ?? true,
      };
      this.userSubject.next(user);
    }
  }

  login(email: string, password: string): Observable<{ error: string | null }> {
    return from(
      supabase.auth.signInWithPassword({ email, password })
    ).pipe(
      map(({ error }) => ({
        error: error ? 'Email o contraseña incorrectos.' : null,
      }))
    );
  }

  logout(): void {
    supabase.auth.signOut();
    this.userSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!this.userSubject.getValue();
  }

  hasRole(roles: UserRole[]): boolean {
    const user = this.userSubject.getValue();
    return user ? roles.includes(user.rol) : false;
  }

  get currentUser(): User | null {
    return this.userSubject.getValue();
  }
}
