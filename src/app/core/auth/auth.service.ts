import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User, UserRole } from '../models/user.model';
import { supabase } from '../supabase/supabase.client';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$ = this.userSubject.asObservable();

  /** Token en memoria: se actualiza en cada cambio de sesión sin pasar por el lock. */
  private _accessToken: string | null = null;
  get accessToken(): string | null { return this._accessToken; }

  /** Se resuelve tras leer la sesión en almacenamiento y cargar perfil (si hay sesión). */
  private readonly sessionReady: Promise<void>;

  constructor() {
    supabase.auth.onAuthStateChange((_event, session) => {
      this._accessToken = session?.access_token ?? null;
      if (session) {
        // loadProfile usa fetch nativo con el token ya disponible en el objeto session,
        // evitando cualquier llamada al SDK de Supabase (que intentaría adquirir el
        // NavigatorLock que onAuthStateChange ya retiene en v2.x → TimeoutError).
        void this.loadProfile(session.user.id, session.user.email ?? '', session.access_token);
      } else {
        this.userSubject.next(null);
      }
    });

    this.sessionReady = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        this._accessToken = data.session.access_token;
        await this.loadProfile(
          data.session.user.id,
          data.session.user.email ?? '',
          data.session.access_token
        );
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
    // reloadProfile se llama fuera de callbacks de auth (ej. tras subir avatar).
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      this._accessToken = data.session.access_token;
      await this.loadProfile(data.session.user.id, data.session.user.email ?? '', data.session.access_token);
    }
  }

  /**
   * Carga el perfil usando fetch nativo para no pasar por el SDK de Supabase
   * (evita NavigatorLockAcquireTimeoutError cuando se llama desde onAuthStateChange).
   */
  private async loadProfile(userId: string, email: string, accessToken: string): Promise<void> {
    const res = await fetch(
      `${environment.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': environment.supabaseAnonKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!res.ok) return;
    const rows: Record<string, unknown>[] = await res.json();
    const data = rows?.[0];
    if (!data) return;

    const user: User = {
      id:          data['id'] as string,
      nombre:      data['nombre'] as string,
      apellidos:   data['apellidos'] as string,
      email,
      numeroSocio: data['numero_socio'] as number,
      avatarUrl:   (data['avatar_url'] as string) ?? undefined,
      rol:         data['rol'] as UserRole,
      fechaAlta:   new Date(data['fecha_alta'] as string),
      activo:      data['activo'] as boolean,
      firstLogin:  (data['first_login'] as boolean) ?? true,
      localidad:   (data['localidad'] as string) ?? '',
      favorito:    (data['favorito'] as boolean) ?? false,
    };
    this.userSubject.next(user);
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

  async logout(): Promise<void> {
    // Esperar a que signOut() libere el NavigatorLock antes de navegar.
    // onAuthStateChange emitirá session=null y el handler llamará userSubject.next(null).
    await supabase.auth.signOut();
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
