# Sistema de Notificaciones Internas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al admin enviar notificaciones internas a socios; los socios ven una campana en el header con contador de no leídas y un drawer lateral para gestionarlas.

**Architecture:** Migración SQL crea las tablas `notificaciones` y `notificaciones_leidas` con RLS. Un servicio Angular singleton carga y mantiene las notificaciones via signals + Realtime. El header muestra la campana; un drawer en el Shell presenta la lista; el panel admin CRUD completo en rutas protegidas.

**Tech Stack:** Angular 19 (standalone, signals, reactive forms), Supabase (PostgreSQL + Realtime + RLS), Tailwind CSS, Bootstrap Icons.

---

## Mapa de archivos

### Nuevos
- `supabase/migrations/030_notificaciones.sql` — ENUM, tablas, RLS
- `src/app/core/models/notificacion.model.ts` — interfaces Notificacion, NotificacionForm, TipoNotificacion
- `src/app/core/services/notificaciones.service.ts` — carga, realtime, marcar leída, limpiar
- `src/app/shared/components/notificaciones-drawer/notificaciones-drawer.component.ts`
- `src/app/shared/components/notificaciones-drawer/notificaciones-drawer.component.html`
- `src/app/shared/components/notificaciones-drawer/notificaciones-drawer.component.scss`
- `src/app/features/admin/notificaciones/notificaciones-admin.service.ts`
- `src/app/features/admin/notificaciones/lista-notificaciones-admin/lista-notificaciones-admin.component.ts`
- `src/app/features/admin/notificaciones/lista-notificaciones-admin/lista-notificaciones-admin.component.html`
- `src/app/features/admin/notificaciones/lista-notificaciones-admin/lista-notificaciones-admin.component.scss`
- `src/app/features/admin/notificaciones/form-notificacion/form-notificacion.component.ts`
- `src/app/features/admin/notificaciones/form-notificacion/form-notificacion.component.html`
- `src/app/features/admin/notificaciones/form-notificacion/form-notificacion.component.scss`

### Modificados
- `src/app/core/auth/auth.service.ts` — llamar a `notificacionesService.cargar()` / `limpiar()` en login/logout
- `src/app/shared/components/header/header.component.ts` — inyectar NotificacionesService, signal drawerAbierto, output abrirDrawer
- `src/app/shared/components/header/header.component.html` — botón campana
- `src/app/shared/components/header/header.component.scss` — estilos `.header-bell` y `.header-bell__badge`
- `src/app/features/shell/shell.component.ts` — signal drawerAbierto, escuchar output del header
- `src/app/features/shell/shell.component.html` — añadir `<app-notificaciones-drawer>`
- `src/app/features/admin/admin.routes.ts` — rutas notificaciones admin
- `src/app/features/home/home.component.html` — card "Notificaciones" en bloque admin

---

## Task 1: Migración SQL

**Files:**
- Create: `supabase/migrations/030_notificaciones.sql`

- [ ] **Step 1: Crear archivo de migración**

```sql
-- supabase/migrations/030_notificaciones.sql

-- ENUM
CREATE TYPE tipo_notificacion AS ENUM ('torneo', 'cuota', 'aviso', 'resultado', 'otro');

-- Tabla principal
CREATE TABLE IF NOT EXISTS notificaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text NOT NULL,
  cuerpo           text NOT NULL,
  tipo             tipo_notificacion NOT NULL,
  destinatarios    uuid[],
  fecha_expiracion date,
  created_by       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Tabla lecturas
CREATE TABLE IF NOT EXISTS notificaciones_leidas (
  notificacion_id  uuid NOT NULL REFERENCES notificaciones(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leida_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notificacion_id, user_id)
);

-- RLS notificaciones
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "socios_ven_sus_notificaciones" ON notificaciones
  FOR SELECT TO authenticated
  USING (
    (destinatarios IS NULL OR auth.uid() = ANY(destinatarios))
    AND (fecha_expiracion IS NULL OR fecha_expiracion >= CURRENT_DATE)
  );

CREATE POLICY "admin_crud_notificaciones" ON notificaciones
  FOR ALL TO authenticated
  USING (get_my_rol() = 'admin')
  WITH CHECK (get_my_rol() = 'admin');

-- RLS notificaciones_leidas
ALTER TABLE notificaciones_leidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_sus_lecturas" ON notificaciones_leidas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "usuario_inserta_sus_lecturas" ON notificaciones_leidas
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "usuario_borra_sus_lecturas" ON notificaciones_leidas
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Habilitar realtime en notificaciones
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;
```

- [ ] **Step 2: Aplicar migración en Supabase**

```bash
supabase db push
```

- [ ] **Step 3: Commit**

```bash
rtk git add supabase/migrations/030_notificaciones.sql
rtk git commit -m "feat(db): add notificaciones tables, enum, RLS, realtime"
```

---

## Task 2: Modelo TypeScript

**Files:**
- Create: `src/app/core/models/notificacion.model.ts`

- [ ] **Step 1: Crear el modelo**

```typescript
// src/app/core/models/notificacion.model.ts
export type TipoNotificacion = 'torneo' | 'cuota' | 'aviso' | 'resultado' | 'otro';

export interface Notificacion {
  id: string;
  titulo: string;
  cuerpo: string;
  tipo: TipoNotificacion;
  destinatarios: string[] | null;
  fechaExpiracion: string | null;
  createdAt: string;
  leida: boolean;
}

export interface NotificacionForm {
  titulo: string;
  cuerpo: string;
  tipo: TipoNotificacion;
  destinatarios: string[] | null;
  fechaExpiracion: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/app/core/models/notificacion.model.ts
rtk git commit -m "feat(model): add Notificacion and NotificacionForm interfaces"
```

---

## Task 3: NotificacionesService (core)

**Files:**
- Create: `src/app/core/services/notificaciones.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// src/app/core/services/notificaciones.service.ts
import { Injectable, computed, signal } from '@angular/core';
import { supabase } from '../supabase/supabase.client';
import { Notificacion } from '../models/notificacion.model';
import type { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  notificaciones = signal<Notificacion[]>([]);
  noLeidas = computed(() => this.notificaciones().filter(n => !n.leida).length);

  private canal: RealtimeChannel | null = null;

  async cargar(): Promise<void> {
    const { data, error } = await supabase
      .from('notificaciones')
      .select(`
        id, titulo, cuerpo, tipo, destinatarios, fecha_expiracion, created_at,
        notificaciones_leidas!left(user_id)
      `)
      .order('created_at', { ascending: false });

    if (error || !data) return;

    const userId = (await supabase.auth.getUser()).data.user?.id;

    const mapeadas: Notificacion[] = data.map((row: Record<string, unknown>) => ({
      id:              row['id'] as string,
      titulo:          row['titulo'] as string,
      cuerpo:          row['cuerpo'] as string,
      tipo:            row['tipo'] as Notificacion['tipo'],
      destinatarios:   (row['destinatarios'] as string[] | null) ?? null,
      fechaExpiracion: (row['fecha_expiracion'] as string | null) ?? null,
      createdAt:       row['created_at'] as string,
      leida:           Array.isArray(row['notificaciones_leidas']) &&
                       (row['notificaciones_leidas'] as Array<{ user_id: string }>)
                         .some(l => l.user_id === userId),
    }));

    this.notificaciones.set(mapeadas);
  }

  suscribirRealtime(): RealtimeChannel {
    this.canal = supabase
      .channel('notificaciones-nuevas')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        async () => {
          // Recarga para respetar RLS (destinatarios puede no incluirnos)
          await this.cargar();
        }
      )
      .subscribe();

    return this.canal;
  }

  async marcarLeida(id: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    await supabase.from('notificaciones_leidas').insert({ notificacion_id: id, user_id: userId });

    this.notificaciones.update(lista =>
      lista.map(n => n.id === id ? { ...n, leida: true } : n)
    );
  }

  async marcarTodasLeidas(): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    const noLeidas = this.notificaciones().filter(n => !n.leida);
    if (noLeidas.length === 0) return;

    const rows = noLeidas.map(n => ({ notificacion_id: n.id, user_id: userId }));
    await supabase.from('notificaciones_leidas').insert(rows);

    this.notificaciones.update(lista => lista.map(n => ({ ...n, leida: true })));
  }

  limpiar(): void {
    if (this.canal) {
      supabase.removeChannel(this.canal);
      this.canal = null;
    }
    this.notificaciones.set([]);
  }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/app/core/services/notificaciones.service.ts
rtk git commit -m "feat(service): add NotificacionesService with signals and realtime"
```

---

## Task 4: Integración en AuthService

**Files:**
- Modify: `src/app/core/auth/auth.service.ts`

- [ ] **Step 1: Inyectar NotificacionesService y llamarlo en login/logout**

En `auth.service.ts`, el `constructor` no puede usar `inject()` directamente con un servicio circular. Usar `inject()` al nivel de campo es suficiente en Angular 19.

Reemplazar el bloque del constructor y `logout()`:

```typescript
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User, UserRole } from '../models/user.model';
import { supabase } from '../supabase/supabase.client';
import { environment } from '../../../environments/environment';
import { NotificacionesService } from '../services/notificaciones.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$ = this.userSubject.asObservable();

  private _accessToken: string | null = null;
  get accessToken(): string | null { return this._accessToken; }

  private readonly sessionReady: Promise<void>;

  // inject() en campo — evita problema de orden de inyección en constructor
  private notificacionesService = inject(NotificacionesService);

  constructor() {
    supabase.auth.onAuthStateChange((_event, session) => {
      this._accessToken = session?.access_token ?? null;
      if (session) {
        void this.loadProfile(session.user.id, session.user.email ?? '', session.access_token);
      } else {
        this.notificacionesService.limpiar();
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

  whenSessionReady(): Promise<void> {
    return this.sessionReady;
  }

  async reloadProfile(): Promise<void> {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      this._accessToken = data.session.access_token;
      await this.loadProfile(data.session.user.id, data.session.user.email ?? '', data.session.access_token);
    }
  }

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
      tipoCuota:   (data['tipo_cuota'] as 'socio' | 'directivo' | 'honor') ?? 'socio',
      favorito:    (data['favorito'] as boolean) ?? false,
    };
    this.userSubject.next(user);

    // Cargar notificaciones y activar realtime tras tener usuario
    await this.notificacionesService.cargar();
    this.notificacionesService.suscribirRealtime();
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
    this.notificacionesService.limpiar();
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
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

Expected: sin errores relacionados con AuthService/NotificacionesService.

- [ ] **Step 3: Commit**

```bash
rtk git add src/app/core/auth/auth.service.ts
rtk git commit -m "feat(auth): load/clear notificaciones on login/logout"
```

---

## Task 5: Campana en el Header

**Files:**
- Modify: `src/app/shared/components/header/header.component.ts`
- Modify: `src/app/shared/components/header/header.component.html`
- Modify: `src/app/shared/components/header/header.component.scss`

- [ ] **Step 1: Actualizar header.component.ts**

```typescript
import { Component, computed, inject, output, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { AvatarComponent } from '../avatar/avatar.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, AvatarComponent, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly notificacionesService = inject(NotificacionesService);
  readonly currentUser$ = this.auth.currentUser$;
  private user = toSignal(this.currentUser$, { initialValue: null });
  esAdmin = computed(() => {
    const rol = this.user()?.rol;
    return rol === 'admin' || rol === 'moderador';
  });
  menuAbierto      = signal(false);
  drawerAbierto    = signal(false);
  cambiarPassword  = output<void>();
  cambiarFoto      = output<void>();
  abrirDrawer      = output<void>();

  toggleMenu(): void {
    this.menuAbierto.update(v => !v);
  }

  abrirNotificaciones(): void {
    this.drawerAbierto.set(true);
    this.abrirDrawer.emit();
  }

  onCambiarPassword(): void {
    this.menuAbierto.set(false);
    this.cambiarPassword.emit();
  }

  onCambiarFoto(): void {
    this.menuAbierto.set(false);
    this.cambiarFoto.emit();
  }

  async logout(): Promise<void> {
    this.menuAbierto.set(false);
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Actualizar header.component.html — añadir campana entre logo y avatar**

```html
<header class="app-header fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-white border-b border-gray-100">
  <a routerLink="/" class="flex items-center gap-2">
    <img
      src="logo.png"
      alt="Logo Campo de Tiro San Isidro"
      class="w-9 h-9 object-contain"
    />
    <div class="leading-tight">
      <p class="text-brand-dark font-semibold text-[14px] tracking-tight">Campo de Tiro</p>
      <p class="text-gray-400 font-medium text-[12px] uppercase tracking-widest">San Isidro</p>
    </div>
  </a>

  <div class="flex items-center gap-3">
    <!-- Campana de notificaciones -->
    <button (click)="abrirNotificaciones()" class="header-bell">
      <i class="bi bi-bell-fill"
         [class.header-bell__icon--active]="notificacionesService.noLeidas() > 0"></i>
      @if (notificacionesService.noLeidas() > 0) {
        <span class="header-bell__badge">
          {{ notificacionesService.noLeidas() > 9 ? '9+' : notificacionesService.noLeidas() }}
        </span>
      }
    </button>

    <!-- Avatar / menú -->
    <div class="header-avatar-wrap">
      <button (click)="toggleMenu()" class="header-avatar-wrap__btn">
        @if (esAdmin()) {
          <div class="header-admin-avatar">
            <i class="bi bi-shield-lock-fill"></i>
          </div>
        } @else {
          <app-avatar
            [nombre]="(currentUser$ | async)?.nombre ?? ''"
            [apellidos]="(currentUser$ | async)?.apellidos ?? ''"
            [avatarUrl]="(currentUser$ | async)?.avatarUrl"
            [size]="30"
          />
        }
      </button>

      @if (menuAbierto()) {
        <div class="header-overlay" (click)="toggleMenu()"></div>

        <div class="header-menu">
          @if (!esAdmin()) {
            <button (click)="onCambiarFoto()" class="header-menu__item">
              <i class="bi bi-camera"></i>
              Cambiar foto de perfil
            </button>
          }
          <button (click)="onCambiarPassword()" class="header-menu__item">
            <i class="bi bi-key"></i>
            Cambiar contraseña
          </button>
          <button (click)="logout()" class="header-menu__item header-menu__item--danger">
            <i class="bi bi-box-arrow-right"></i>
            Cerrar sesión
          </button>
        </div>
      }
    </div>
  </div>
</header>
```

- [ ] **Step 3: Añadir estilos en header.component.scss**

Añadir al final del archivo existente:

```scss
.header-bell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;

  i {
    font-size: 18px;
    color: #9CA3AF; // gris neutro
    transition: color 0.2s;

    &.header-bell__icon--active {
      color: #FFAE00; // ámbar cuando hay no leídas
    }
  }

  &__badge {
    position: absolute;
    top: -2px;
    right: -4px;
    width: 16px;
    height: 16px;
    background: #EF4444;
    border-radius: 50%;
    color: white;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
}
```

- [ ] **Step 4: Commit**

```bash
rtk git add src/app/shared/components/header/header.component.ts src/app/shared/components/header/header.component.html src/app/shared/components/header/header.component.scss
rtk git commit -m "feat(header): add notification bell with unread badge"
```

---

## Task 6: Drawer de Notificaciones

**Files:**
- Create: `src/app/shared/components/notificaciones-drawer/notificaciones-drawer.component.ts`
- Create: `src/app/shared/components/notificaciones-drawer/notificaciones-drawer.component.html`
- Create: `src/app/shared/components/notificaciones-drawer/notificaciones-drawer.component.scss`

- [ ] **Step 1: Crear notificaciones-drawer.component.ts**

```typescript
// src/app/shared/components/notificaciones-drawer/notificaciones-drawer.component.ts
import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { TipoNotificacion } from '../../../core/models/notificacion.model';

@Component({
  selector: 'app-notificaciones-drawer',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './notificaciones-drawer.component.html',
  styleUrl: './notificaciones-drawer.component.scss',
})
export class NotificacionesDrawerComponent {
  @Input() abierto = false;
  @Output() cerrar = new EventEmitter<void>();

  readonly notificacionesService = inject(NotificacionesService);

  onCerrar(): void {
    this.cerrar.emit();
  }

  async onMarcarLeida(id: string): Promise<void> {
    await this.notificacionesService.marcarLeida(id);
  }

  async onMarcarTodas(): Promise<void> {
    await this.notificacionesService.marcarTodasLeidas();
  }

  iconoPorTipo(tipo: TipoNotificacion): string {
    const mapa: Record<TipoNotificacion, string> = {
      torneo:    'bi-trophy-fill',
      cuota:     'bi-credit-card-fill',
      aviso:     'bi-exclamation-triangle-fill',
      resultado: 'bi-bullseye',
      otro:      'bi-info-circle-fill',
    };
    return mapa[tipo];
  }

  colorPorTipo(tipo: TipoNotificacion): string {
    const mapa: Record<TipoNotificacion, string> = {
      torneo:    '#FFAE00',
      cuota:     '#3B82F6',
      aviso:     '#F59E0B',
      resultado: '#10B981',
      otro:      '#6B7280',
    };
    return mapa[tipo];
  }

  fechaRelativa(createdAt: string): string {
    const ahora = Date.now();
    const fecha = new Date(createdAt).getTime();
    const diffMs = ahora - fecha;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 0) return 'Hoy';
    if (diffDias === 1) return 'Ayer';
    return `Hace ${diffDias} días`;
  }
}
```

- [ ] **Step 2: Crear notificaciones-drawer.component.html**

```html
@if (abierto) {
  <!-- Overlay -->
  <div
    class="fixed inset-0 bg-black/40 z-40"
    (click)="onCerrar()"
  ></div>

  <!-- Panel lateral -->
  <div class="drawer-panel fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col shadow-xl">

    <!-- Cabecera -->
    <div class="drawer-header flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <h2 class="text-base font-bold text-gray-800">Notificaciones</h2>
      <div class="flex items-center gap-3">
        @if (notificacionesService.noLeidas() > 0) {
          <button
            class="text-sm font-semibold text-amber-500"
            (click)="onMarcarTodas()"
          >
            Marcar todas leídas
          </button>
        }
        <button (click)="onCerrar()" class="text-gray-400 hover:text-gray-600">
          <i class="bi bi-x-lg text-xl"></i>
        </button>
      </div>
    </div>

    <!-- Lista -->
    <div class="flex-1 overflow-y-auto">
      @if (notificacionesService.notificaciones().length === 0) {
        <div class="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
          <i class="bi bi-bell-slash text-5xl"></i>
          <p class="text-sm">No tienes notificaciones nuevas</p>
        </div>
      } @else {
        @for (n of notificacionesService.notificaciones(); track n.id) {
          <button
            class="drawer-item w-full text-left px-4 py-3 border-b border-gray-50 flex gap-3 items-start"
            [class.drawer-item--leida]="n.leida"
            (click)="onMarcarLeida(n.id)"
          >
            <!-- Punto no leído -->
            <div class="drawer-item__dot-wrap pt-1">
              @if (!n.leida) {
                <span class="drawer-item__dot"></span>
              } @else {
                <span class="drawer-item__dot-placeholder"></span>
              }
            </div>

            <!-- Icono tipo -->
            <i
              class="bi text-xl mt-0.5"
              [class]="'bi ' + iconoPorTipo(n.tipo)"
              [style.color]="colorPorTipo(n.tipo)"
            ></i>

            <!-- Contenido -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-800 truncate">{{ n.titulo }}</p>
              <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ n.cuerpo }}</p>
              <p class="text-xs text-gray-400 mt-1 text-right">{{ fechaRelativa(n.createdAt) }}</p>
            </div>
          </button>
        }
      }
    </div>

  </div>
}
```

- [ ] **Step 3: Crear notificaciones-drawer.component.scss**

```scss
.drawer-panel {
  animation: slideInRight 0.25s ease-out;
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

.drawer-item {
  transition: background 0.15s;

  &:hover {
    background: #F9FAFB;
  }

  &--leida {
    opacity: 0.6;
  }

  &__dot-wrap {
    width: 10px;
    flex-shrink: 0;
  }

  &__dot {
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #F97316;
  }

  &__dot-placeholder {
    display: block;
    width: 8px;
    height: 8px;
  }
}
```

- [ ] **Step 4: Commit**

```bash
rtk git add src/app/shared/components/notificaciones-drawer/
rtk git commit -m "feat(ui): add NotificacionesDrawerComponent"
```

---

## Task 7: Integrar Drawer en Shell

**Files:**
- Modify: `src/app/features/shell/shell.component.ts`
- Modify: `src/app/features/shell/shell.component.html`

- [ ] **Step 1: Actualizar shell.component.ts**

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { CambiarPasswordComponent } from '../../shared/components/cambiar-password/cambiar-password.component';
import { AvatarEditorComponent } from '../../shared/components/avatar-editor/avatar-editor.component';
import { NotificacionesDrawerComponent } from '../../shared/components/notificaciones-drawer/notificaciones-drawer.component';
import { AuthService } from '../../core/auth/auth.service';
import { supabase } from '../../core/supabase/supabase.client';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, BottomNavComponent, CambiarPasswordComponent, AvatarEditorComponent, NotificacionesDrawerComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private auth = inject(AuthService);
  mostrarCambioPassword  = signal(false);
  cambioPasswordManual   = signal(false);
  mostrarEditorAvatar    = signal(false);
  drawerNotificaciones   = signal(false);

  ngOnInit(): void {
    if (this.auth.currentUser?.firstLogin) {
      this.mostrarCambioPassword.set(true);
    }

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.cambioPasswordManual.set(true);
      }
    });
  }

  onPasswordCerrado(): void {
    this.mostrarCambioPassword.set(false);
    this.cambioPasswordManual.set(false);
  }

  abrirCambioPassword(): void {
    this.cambioPasswordManual.set(true);
  }

  abrirCambioFoto(): void {
    this.mostrarEditorAvatar.set(true);
  }

  cerrarEditorAvatar(): void {
    this.mostrarEditorAvatar.set(false);
  }

  abrirDrawerNotificaciones(): void {
    this.drawerNotificaciones.set(true);
  }

  cerrarDrawerNotificaciones(): void {
    this.drawerNotificaciones.set(false);
  }
}
```

- [ ] **Step 2: Actualizar shell.component.html**

```html
<app-header
  (cambiarPassword)="abrirCambioPassword()"
  (cambiarFoto)="abrirCambioFoto()"
  (abrirDrawer)="abrirDrawerNotificaciones()"
/>
<main class="shell-main">
  <router-outlet />
</main>
<app-bottom-nav />

<app-notificaciones-drawer
  [abierto]="drawerNotificaciones()"
  (cerrar)="cerrarDrawerNotificaciones()"
/>

@if (mostrarCambioPassword()) {
  <app-cambiar-password (cerrar)="onPasswordCerrado()" />
}

@if (cambioPasswordManual()) {
  <app-cambiar-password [soloPassword]="true" (cerrar)="onPasswordCerrado()" />
}

@if (mostrarEditorAvatar()) {
  <div class="shell-avatar-modal" (click)="cerrarEditorAvatar()">
    <div class="shell-avatar-modal__sheet" (click)="$event.stopPropagation()">
      <app-avatar-editor
        (completado)="cerrarEditorAvatar()"
        (omitido)="cerrarEditorAvatar()"
      />
    </div>
  </div>
}
```

- [ ] **Step 3: Verificar compilación**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
rtk git add src/app/features/shell/shell.component.ts src/app/features/shell/shell.component.html
rtk git commit -m "feat(shell): integrate notificaciones drawer"
```

---

## Task 8: NotificacionesAdminService

**Files:**
- Create: `src/app/features/admin/notificaciones/notificaciones-admin.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// src/app/features/admin/notificaciones/notificaciones-admin.service.ts
import { Injectable, inject } from '@angular/core';
import { supabase } from '../../../core/supabase/supabase.client';
import { AuthService } from '../../../core/auth/auth.service';
import { Notificacion, NotificacionForm } from '../../../core/models/notificacion.model';

@Injectable({ providedIn: 'root' })
export class NotificacionesAdminService {
  private auth = inject(AuthService);

  async getAll(): Promise<Notificacion[]> {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('id, titulo, cuerpo, tipo, destinatarios, fecha_expiracion, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return (data as Record<string, unknown>[]).map(row => ({
      id:              row['id'] as string,
      titulo:          row['titulo'] as string,
      cuerpo:          row['cuerpo'] as string,
      tipo:            row['tipo'] as Notificacion['tipo'],
      destinatarios:   (row['destinatarios'] as string[] | null) ?? null,
      fechaExpiracion: (row['fecha_expiracion'] as string | null) ?? null,
      createdAt:       row['created_at'] as string,
      leida:           false,
    }));
  }

  async getById(id: string): Promise<Notificacion | null> {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('id, titulo, cuerpo, tipo, destinatarios, fecha_expiracion, created_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    return {
      id:              row['id'] as string,
      titulo:          row['titulo'] as string,
      cuerpo:          row['cuerpo'] as string,
      tipo:            row['tipo'] as Notificacion['tipo'],
      destinatarios:   (row['destinatarios'] as string[] | null) ?? null,
      fechaExpiracion: (row['fecha_expiracion'] as string | null) ?? null,
      createdAt:       row['created_at'] as string,
      leida:           false,
    };
  }

  async crear(form: NotificacionForm): Promise<void> {
    const userId = this.auth.currentUser?.id;
    await supabase.from('notificaciones').insert({
      titulo:           form.titulo,
      cuerpo:           form.cuerpo,
      tipo:             form.tipo,
      destinatarios:    form.destinatarios,
      fecha_expiracion: form.fechaExpiracion,
      created_by:       userId,
    });
  }

  async actualizar(id: string, form: NotificacionForm): Promise<void> {
    await supabase.from('notificaciones').update({
      titulo:           form.titulo,
      cuerpo:           form.cuerpo,
      tipo:             form.tipo,
      destinatarios:    form.destinatarios,
      fecha_expiracion: form.fechaExpiracion,
    }).eq('id', id);
  }

  async eliminar(id: string): Promise<void> {
    await supabase.from('notificaciones').delete().eq('id', id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/app/features/admin/notificaciones/notificaciones-admin.service.ts
rtk git commit -m "feat(admin): add NotificacionesAdminService"
```

---

## Task 9: Lista Notificaciones Admin

**Files:**
- Create: `src/app/features/admin/notificaciones/lista-notificaciones-admin/lista-notificaciones-admin.component.ts`
- Create: `src/app/features/admin/notificaciones/lista-notificaciones-admin/lista-notificaciones-admin.component.html`
- Create: `src/app/features/admin/notificaciones/lista-notificaciones-admin/lista-notificaciones-admin.component.scss`

- [ ] **Step 1: Crear lista-notificaciones-admin.component.ts**

```typescript
// src/app/features/admin/notificaciones/lista-notificaciones-admin/lista-notificaciones-admin.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NotificacionesAdminService } from '../notificaciones-admin.service';
import { Notificacion } from '../../../../core/models/notificacion.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-lista-notificaciones-admin',
  standalone: true,
  imports: [DatePipe, ConfirmDialogComponent],
  templateUrl: './lista-notificaciones-admin.component.html',
  styleUrl: './lista-notificaciones-admin.component.scss',
})
export class ListaNotificacionesAdminComponent implements OnInit {
  private service = inject(NotificacionesAdminService);
  private router = inject(Router);

  notificaciones = signal<Notificacion[]>([]);
  pendingDeleteId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.notificaciones.set(await this.service.getAll());
  }

  nueva(): void {
    this.router.navigate(['/admin/notificaciones/nueva']);
  }

  editar(id: string): void {
    this.router.navigate(['/admin/notificaciones', id]);
  }

  confirmarEliminar(id: string): void {
    this.pendingDeleteId.set(id);
  }

  async eliminar(): Promise<void> {
    const id = this.pendingDeleteId();
    if (!id) return;
    await this.service.eliminar(id);
    this.pendingDeleteId.set(null);
    await this.cargar();
  }

  cancelarEliminar(): void {
    this.pendingDeleteId.set(null);
  }

  labelDestinatarios(n: Notificacion): string {
    if (!n.destinatarios) return 'Todos';
    return `${n.destinatarios.length} socio${n.destinatarios.length !== 1 ? 's' : ''}`;
  }

  badgeClass(tipo: string): string {
    const mapa: Record<string, string> = {
      torneo:    'badge--torneo',
      cuota:     'badge--cuota',
      aviso:     'badge--aviso',
      resultado: 'badge--resultado',
      otro:      'badge--otro',
    };
    return mapa[tipo] ?? 'badge--otro';
  }
}
```

- [ ] **Step 2: Crear lista-notificaciones-admin.component.html**

```html
<div class="page-container">
  <div class="page-header">
    <h1 class="page-title">Notificaciones</h1>
    <button class="btn btn-primary" (click)="nueva()">
      <i class="bi bi-plus-lg"></i> Nueva
    </button>
  </div>

  @if (notificaciones().length === 0) {
    <p class="text-gray-400 text-sm text-center mt-12">No hay notificaciones creadas.</p>
  } @else {
    <div class="lista-notif">
      @for (n of notificaciones(); track n.id) {
        <div class="lista-notif__fila card">
          <div class="lista-notif__info">
            <span class="badge" [class]="badgeClass(n.tipo)">{{ n.tipo }}</span>
            <p class="lista-notif__titulo">{{ n.titulo }}</p>
            <p class="lista-notif__meta">
              {{ labelDestinatarios(n) }}
              @if (n.fechaExpiracion) {
                · Expira {{ n.fechaExpiracion | date:'d MMM yyyy' : '' : 'es' }}
              }
              · {{ n.createdAt | date:'d MMM yyyy' : '' : 'es' }}
            </p>
          </div>
          <div class="lista-notif__actions">
            <button class="icon-btn" (click)="editar(n.id)" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="icon-btn icon-btn--danger" (click)="confirmarEliminar(n.id)" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      }
    </div>
  }
</div>

@if (pendingDeleteId()) {
  <app-confirm-dialog
    mensaje="¿Eliminar esta notificación?"
    (confirmar)="eliminar()"
    (cancelar)="cancelarEliminar()"
  />
}
```

- [ ] **Step 3: Crear lista-notificaciones-admin.component.scss**

```scss
.lista-notif {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;

  &__fila {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__titulo {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1F2937;
    margin-top: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    font-size: 0.75rem;
    color: #9CA3AF;
    margin-top: 0.125rem;
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;

  &--torneo    { background: #FEF3C7; color: #D97706; }
  &--cuota     { background: #DBEAFE; color: #1D4ED8; }
  &--aviso     { background: #FEF9C3; color: #A16207; }
  &--resultado { background: #D1FAE5; color: #065F46; }
  &--otro      { background: #F3F4F6; color: #6B7280; }
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6B7280;
  transition: background 0.15s;

  &:hover { background: #F3F4F6; }

  &--danger {
    color: #EF4444;
    &:hover { background: #FEF2F2; }
  }
}
```

- [ ] **Step 4: Commit**

```bash
rtk git add src/app/features/admin/notificaciones/lista-notificaciones-admin/
rtk git commit -m "feat(admin): add ListaNotificacionesAdminComponent"
```

---

## Task 10: Formulario de Notificación (Admin)

**Files:**
- Create: `src/app/features/admin/notificaciones/form-notificacion/form-notificacion.component.ts`
- Create: `src/app/features/admin/notificaciones/form-notificacion/form-notificacion.component.html`
- Create: `src/app/features/admin/notificaciones/form-notificacion/form-notificacion.component.scss`

- [ ] **Step 1: Crear form-notificacion.component.ts**

Nota: para el selector de socios necesitamos cargar la lista. Usamos UserService que ya existe.

```typescript
// src/app/features/admin/notificaciones/form-notificacion/form-notificacion.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificacionesAdminService } from '../notificaciones-admin.service';
import { UserService } from '../../socios/user.service';
import { User } from '../../../../core/models/user.model';
import { NotificacionForm } from '../../../../core/models/notificacion.model';

@Component({
  selector: 'app-form-notificacion',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-notificacion.component.html',
  styleUrl: './form-notificacion.component.scss',
})
export class FormNotificacionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(NotificacionesAdminService);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  private editId?: string;

  socios = signal<User[]>([]);
  sociosSeleccionados = signal<string[]>([]);
  destinatariosTodos = signal(true);

  tipos = ['torneo', 'cuota', 'aviso', 'resultado', 'otro'] as const;

  form = this.fb.group({
    titulo:          ['', Validators.required],
    tipo:            ['aviso', Validators.required],
    cuerpo:          ['', Validators.required],
    fechaExpiracion: [''],
  });

  async ngOnInit(): Promise<void> {
    const listaSocios = await this.userService.getAll();
    this.socios.set(listaSocios.filter(s => s.activo));

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const notif = await this.service.getById(id);
      if (notif) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue({
          titulo:          notif.titulo,
          tipo:            notif.tipo,
          cuerpo:          notif.cuerpo,
          fechaExpiracion: notif.fechaExpiracion ?? '',
        });
        if (notif.destinatarios) {
          this.destinatariosTodos.set(false);
          this.sociosSeleccionados.set(notif.destinatarios);
        }
      }
    }
  }

  toggleDestinatarios(todos: boolean): void {
    this.destinatariosTodos.set(todos);
    if (todos) this.sociosSeleccionados.set([]);
  }

  toggleSocio(id: string): void {
    const actual = this.sociosSeleccionados();
    if (actual.includes(id)) {
      this.sociosSeleccionados.set(actual.filter(s => s !== id));
    } else {
      this.sociosSeleccionados.set([...actual, id]);
    }
  }

  isSocioSeleccionado(id: string): boolean {
    return this.sociosSeleccionados().includes(id);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const val = this.form.value;
    const data: NotificacionForm = {
      titulo:          val.titulo!,
      tipo:            val.tipo as NotificacionForm['tipo'],
      cuerpo:          val.cuerpo!,
      destinatarios:   this.destinatariosTodos() ? null : this.sociosSeleccionados(),
      fechaExpiracion: val.fechaExpiracion || null,
    };

    if (this.isEdit && this.editId) {
      await this.service.actualizar(this.editId, data);
    } else {
      await this.service.crear(data);
    }

    this.router.navigate(['/admin/notificaciones']);
  }

  cancelar(): void {
    this.router.navigate(['/admin/notificaciones']);
  }
}
```

- [ ] **Step 2: Crear form-notificacion.component.html**

```html
<div class="page-container">
  <div class="page-header">
    <h1 class="page-title">{{ isEdit ? 'Editar' : 'Nueva' }} Notificación</h1>
  </div>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-notif">

    <div class="form-field">
      <label class="form-label">Título *</label>
      <input formControlName="titulo" type="text" class="form-input" placeholder="Ej. Recordatorio cuota 2026" />
    </div>

    <div class="form-field">
      <label class="form-label">Tipo *</label>
      <select formControlName="tipo" class="form-input">
        @for (t of tipos; track t) {
          <option [value]="t">{{ t | titlecase }}</option>
        }
      </select>
    </div>

    <div class="form-field">
      <label class="form-label">Mensaje *</label>
      <textarea formControlName="cuerpo" class="form-input" rows="4" placeholder="Texto del aviso..."></textarea>
    </div>

    <div class="form-field">
      <label class="form-label">Destinatarios</label>
      <div class="radio-group">
        <label class="radio-option">
          <input type="radio" [checked]="destinatariosTodos()" (change)="toggleDestinatarios(true)" />
          Todos los socios
        </label>
        <label class="radio-option">
          <input type="radio" [checked]="!destinatariosTodos()" (change)="toggleDestinatarios(false)" />
          Socios específicos
        </label>
      </div>

      @if (!destinatariosTodos()) {
        <div class="socios-lista">
          @for (s of socios(); track s.id) {
            <label class="socio-check">
              <input
                type="checkbox"
                [checked]="isSocioSeleccionado(s.id)"
                (change)="toggleSocio(s.id)"
              />
              {{ s.nombre }} {{ s.apellidos }}
            </label>
          }
        </div>
      }
    </div>

    <div class="form-field">
      <label class="form-label">Fecha de expiración (opcional)</label>
      <input formControlName="fechaExpiracion" type="date" class="form-input" />
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-secondary" (click)="cancelar()">Cancelar</button>
      <button type="submit" class="btn btn-primary" [disabled]="form.invalid">
        {{ isEdit ? 'Guardar cambios' : 'Enviar notificación' }}
      </button>
    </div>

  </form>
</div>
```

- [ ] **Step 3: Crear form-notificacion.component.scss**

```scss
.form-notif {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.form-input {
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: #1F2937;
  background: white;
  width: 100%;
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: #FFAE00;
    box-shadow: 0 0 0 2px rgba(255, 174, 0, 0.15);
  }
}

.radio-group {
  display: flex;
  gap: 1.5rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
}

.socios-lista {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 0.5rem;
}

.socio-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;

  &:hover {
    background: #F9FAFB;
  }
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
}
```

- [ ] **Step 4: Commit**

```bash
rtk git add src/app/features/admin/notificaciones/form-notificacion/
rtk git commit -m "feat(admin): add FormNotificacionComponent"
```

---

## Task 11: Rutas Admin y Card en Home

**Files:**
- Modify: `src/app/features/admin/admin.routes.ts`
- Modify: `src/app/features/home/home.component.html`
- Modify: `src/app/features/home/home.component.ts` (añadir import del Router para irNotificaciones)

- [ ] **Step 1: Añadir rutas en admin.routes.ts**

Al final del array `adminRoutes`, antes del cierre `]`:

```typescript
  // ── Notificaciones ───────────────────────────────────────────────────────
  {
    path: 'notificaciones',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./notificaciones/lista-notificaciones-admin/lista-notificaciones-admin.component')
        .then(m => m.ListaNotificacionesAdminComponent),
  },
  {
    path: 'notificaciones/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./notificaciones/form-notificacion/form-notificacion.component')
        .then(m => m.FormNotificacionComponent),
  },
  {
    path: 'notificaciones/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./notificaciones/form-notificacion/form-notificacion.component')
        .then(m => m.FormNotificacionComponent),
  },
```

- [ ] **Step 2: Añadir card "Notificaciones" en home.component.html**

Dentro del bloque `@if (esAdmin())`, después del bloque "Asistente IA":

```html
    <!-- Card acceso rápido notificaciones -->
    <h3 class="home__section-label home__section-label--mt">Comunicaciones</h3>
    <button
      (click)="irNotificaciones()"
      class="card w-full text-left p-3 flex items-center gap-3 hover:bg-amber-50 transition-colors"
    >
      <i class="bi bi-bell-fill text-amber-400 text-xl"></i>
      <div>
        <p class="text-sm font-semibold text-gray-800">Notificaciones</p>
        <p class="text-xs text-gray-500">Envía avisos a los socios</p>
      </div>
      <i class="bi bi-chevron-right text-gray-300 ml-auto"></i>
    </button>
```

- [ ] **Step 3: Añadir método irNotificaciones() en home.component.ts**

Añadir dentro de la clase `HomeComponent`:

```typescript
  irNotificaciones(): void {
    this.router.navigate(['/admin/notificaciones']);
  }
```

(El `router` ya está inyectado en el componente.)

- [ ] **Step 4: Verificar compilación final**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/features/admin/admin.routes.ts src/app/features/home/home.component.html src/app/features/home/home.component.ts
rtk git commit -m "feat(admin): add notificaciones routes and home card"
```

---

## Notas de verificación manual

Después de implementar todo:

1. **Socio**: Iniciar sesión → campana en header sin badge → ir a `/admin/notificaciones` con admin → crear notificación para "Todos" → volver a la sesión de socio → campana con badge → abrir drawer → ítem aparece → tocar para marcar leído → badge desaparece.
2. **Admin**: Crear, editar y eliminar notificaciones desde el panel.
3. **Expiración**: Crear notificación con fecha pasada → no aparece en el drawer del socio (RLS la filtra).
4. **Realtime**: Con dos pestañas abiertas (una admin, una socio), crear notificación → la campana del socio se actualiza sin recargar.
