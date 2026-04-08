import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User, UserRole } from '../models/user.model';
import { supabase } from '../supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$ = this.userSubject.asObservable();

  /** Se resuelve tras leer la sesión en almacenamiento y cargar perfil (si hay sesión). */
  private readonly sessionReady: Promise<void>;

  constructor() {
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void this.loadProfile(session.user.id);
      } else {
        this.userSubject.next(null);
      }
    });

    this.sessionReady = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await this.loadProfile(data.session.user.id);
      }
    })();
  }

  /**
   * Esperar antes de guards/navegación: sin esto, al refrescar, `isAuthenticated()` es false
   * hasta que termine getSession/loadProfile y se redirige por error al login.
   */
  whenSessionReady(): Promise<void> {
    return this.sessionReady;
  }

  async reloadProfile(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await this.loadProfile(user.id);
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
        localidad: data['localidad'] ?? '',
        favorito: (data['favorito'] as boolean) ?? false,
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
    // signOut() libera el NavigatorLock de auth al completarse; onAuthStateChange emitirá
    // session=null y el handler ya llama userSubject.next(null). No emitir null aquí antes
    // de que signOut termine o los switchMap activos intentarán getSession() con el lock ocupado.
    void supabase.auth.signOut();
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
