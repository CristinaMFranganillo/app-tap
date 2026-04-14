# AppTap — Base + Auth + Socios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la base de la app Angular 19 (Tailwind, Bootstrap Icons, Montserrat, routing, layout compartido) más el sistema completo de autenticación y gestión de socios.

**Architecture:** Standalone Components con lazy loading por ruta. `AuthService` con `BehaviorSubject<User|null>` y token en localStorage. Guards funcionales (`authGuard`, `roleGuard`) protegen las rutas. Layout shell con `HeaderComponent` y `BottomNavComponent` envuelve todas las rutas autenticadas.

**Tech Stack:** Angular 19, Tailwind CSS 3, Bootstrap Icons, Montserrat (Google Fonts), RxJS, Angular Router, Karma/Jasmine.

---

## File Map

### Nuevos archivos — Core
- `src/app/core/models/user.model.ts` — interfaces User, UserRole
- `src/app/core/models/news.model.ts` — interface News
- `src/app/core/models/score.model.ts` — interface Score
- `src/app/core/models/competicion.model.ts` — interface Competicion
- `src/app/core/auth/auth.service.ts` — login, logout, currentUser$, hasRole, token
- `src/app/core/auth/auth.guard.ts` — guard funcional, redirige a /login
- `src/app/core/auth/role.guard.ts` — guard funcional, redirige a / si sin rol
- `src/app/core/interceptors/auth.interceptor.ts` — añade Authorization header

### Nuevos archivos — Shared
- `src/app/shared/pipes/iniciales.pipe.ts` — "Juan García" → "JG"
- `src/app/shared/components/avatar/avatar.component.ts`
- `src/app/shared/components/avatar/avatar.component.html`
- `src/app/shared/components/header/header.component.ts`
- `src/app/shared/components/header/header.component.html`
- `src/app/shared/components/bottom-nav/bottom-nav.component.ts`
- `src/app/shared/components/bottom-nav/bottom-nav.component.html`

### Nuevos archivos — Features
- `src/app/features/auth/login/login.component.ts`
- `src/app/features/auth/login/login.component.html`
- `src/app/features/auth/auth.routes.ts`
- `src/app/features/shell/shell.component.ts` — layout con header + router-outlet + bottom-nav
- `src/app/features/shell/shell.component.html`
- `src/app/features/home/home.component.ts`
- `src/app/features/home/home.component.html`
- `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`
- `src/app/features/admin/socios/lista-socios/lista-socios.component.html`
- `src/app/features/admin/socios/form-socio/form-socio.component.ts`
- `src/app/features/admin/socios/form-socio/form-socio.component.html`
- `src/app/features/admin/socios/user.service.ts`
- `src/app/features/admin/admin.routes.ts`

### Modificados
- `src/app/app.routes.ts` — rutas raíz con lazy loading
- `src/app/app.config.ts` — provideHttpClient, interceptor
- `src/app/app.component.html` — ya limpio (solo `<router-outlet />`)
- `tailwind.config.js` — paleta personalizada
- `src/styles.scss` — Tailwind directives + Montserrat + Bootstrap Icons

### Tests
- `src/app/core/auth/auth.service.spec.ts`
- `src/app/shared/pipes/iniciales.pipe.spec.ts`
- `src/app/core/auth/auth.guard.spec.ts`
- `src/app/core/auth/role.guard.spec.ts`

---

## Task 1: Instalar dependencias y configurar Tailwind + estilos base

**Files:**
- Create: `tailwind.config.js`
- Modify: `src/styles.scss`
- Modify: `package.json` (via npm install)
- Modify: `src/index.html`

- [ ] **Step 1: Instalar Tailwind CSS, Bootstrap Icons**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npm install -D tailwindcss postcss autoprefixer
npm install bootstrap-icons
npx tailwindcss init
```

- [ ] **Step 2: Crear `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          yellow: '#D4E600',
          dark:   '#1A1A1A',
        },
        surface: '#F5F5F5',
        success: '#22C55E',
        danger:  '#EF4444',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Actualizar `src/styles.scss`**

```scss
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
@import 'bootstrap-icons/font/bootstrap-icons.css';

* {
  box-sizing: border-box;
}

body {
  font-family: 'Montserrat', system-ui, sans-serif;
  background-color: #F5F5F5;
  margin: 0;
  padding: 0;
}
```

- [ ] **Step 4: Añadir PostCSS config**

Crear `postcss.config.js` en la raíz del proyecto:

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Verificar compilación**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npm run build 2>&1 | tail -20
```

Esperado: build sin errores.

- [ ] **Step 6: Commit**

```bash
git init
git add tailwind.config.js postcss.config.js src/styles.scss package.json package-lock.json
git commit -m "feat: install tailwind, bootstrap-icons, configure design tokens"
```

---

## Task 2: Modelos de datos TypeScript

**Files:**
- Create: `src/app/core/models/user.model.ts`
- Create: `src/app/core/models/news.model.ts`
- Create: `src/app/core/models/score.model.ts`
- Create: `src/app/core/models/competicion.model.ts`

- [ ] **Step 1: Crear `src/app/core/models/user.model.ts`**

```typescript
export type UserRole = 'socio' | 'moderador' | 'admin';

export interface User {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  numeroSocio: string;
  avatarUrl?: string;
  rol: UserRole;
  fechaAlta: Date;
  activo: boolean;
}
```

- [ ] **Step 2: Crear `src/app/core/models/competicion.model.ts`**

```typescript
export interface Competicion {
  id: string;
  nombre: string;
  modalidad: string;
  totalPlatos: number;
  fecha: Date;
  activa: boolean;
  creadaPor: string;
}
```

- [ ] **Step 3: Crear `src/app/core/models/score.model.ts`**

```typescript
export interface Score {
  id: string;
  userId: string;
  competicionId: string;
  platosRotos: number;
  fecha: Date;
  registradoPor: string;
}
```

- [ ] **Step 4: Crear `src/app/core/models/news.model.ts`**

```typescript
export interface News {
  id: string;
  titulo: string;
  contenido: string;
  autorId: string;
  fecha: Date;
  imagenUrl?: string;
  publicada: boolean;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/core/models/
git commit -m "feat: add TypeScript data models (User, News, Score, Competicion)"
```

---

## Task 3: Pipe de iniciales + Avatar component

**Files:**
- Create: `src/app/shared/pipes/iniciales.pipe.ts`
- Create: `src/app/shared/pipes/iniciales.pipe.spec.ts`
- Create: `src/app/shared/components/avatar/avatar.component.ts`
- Create: `src/app/shared/components/avatar/avatar.component.html`

- [ ] **Step 1: Escribir test del pipe**

Crear `src/app/shared/pipes/iniciales.pipe.spec.ts`:

```typescript
import { InicialesPipe } from './iniciales.pipe';

describe('InicialesPipe', () => {
  let pipe: InicialesPipe;

  beforeEach(() => {
    pipe = new InicialesPipe();
  });

  it('returns initials from nombre and apellidos', () => {
    expect(pipe.transform('Juan', 'García Ruiz')).toBe('JG');
  });

  it('handles single word apellidos', () => {
    expect(pipe.transform('Ana', 'López')).toBe('AL');
  });

  it('handles empty strings gracefully', () => {
    expect(pipe.transform('', '')).toBe('?');
  });

  it('uppercases the initials', () => {
    expect(pipe.transform('carlos', 'ruiz')).toBe('CR');
  });
});
```

- [ ] **Step 2: Ejecutar test — debe fallar**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx ng test --include="**/iniciales.pipe.spec.ts" --watch=false 2>&1 | tail -20
```

Esperado: error "InicialesPipe not found" o similar.

- [ ] **Step 3: Implementar `src/app/shared/pipes/iniciales.pipe.ts`**

```typescript
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'iniciales',
  standalone: true,
})
export class InicialesPipe implements PipeTransform {
  transform(nombre: string, apellidos: string): string {
    const n = nombre?.trim();
    const a = apellidos?.trim();
    if (!n && !a) return '?';
    const inicial1 = n ? n[0].toUpperCase() : '';
    const inicial2 = a ? a[0].toUpperCase() : '';
    return inicial1 + inicial2;
  }
}
```

- [ ] **Step 4: Ejecutar test — debe pasar**

```bash
npx ng test --include="**/iniciales.pipe.spec.ts" --watch=false 2>&1 | tail -10
```

Esperado: `4 specs, 0 failures`.

- [ ] **Step 5: Crear `src/app/shared/components/avatar/avatar.component.html`**

```html
<div class="avatar-container" [style.width.px]="size" [style.height.px]="size">
  @if (avatarUrl) {
    <img
      [src]="avatarUrl"
      [alt]="nombre + ' ' + apellidos"
      class="w-full h-full object-cover rounded-full"
    />
  } @else {
    <div
      class="w-full h-full rounded-full bg-brand-dark flex items-center justify-center"
      [style.fontSize.px]="size * 0.35"
    >
      <span class="font-black text-brand-yellow leading-none">
        {{ nombre | iniciales: apellidos }}
      </span>
    </div>
  }
</div>
```

- [ ] **Step 6: Crear `src/app/shared/components/avatar/avatar.component.ts`**

```typescript
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InicialesPipe } from '../../pipes/iniciales.pipe';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule, InicialesPipe],
  templateUrl: './avatar.component.html',
})
export class AvatarComponent {
  @Input() nombre: string = '';
  @Input() apellidos: string = '';
  @Input() avatarUrl?: string;
  @Input() size: number = 40;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/shared/
git commit -m "feat: add InicialesPipe and AvatarComponent"
```

---

## Task 4: AuthService

**Files:**
- Create: `src/app/core/auth/auth.service.ts`
- Create: `src/app/core/auth/auth.service.spec.ts`

- [ ] **Step 1: Escribir tests del AuthService**

Crear `src/app/core/auth/auth.service.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```bash
npx ng test --include="**/auth.service.spec.ts" --watch=false 2>&1 | tail -20
```

Esperado: error "AuthService not found" o similar.

- [ ] **Step 3: Implementar `src/app/core/auth/auth.service.ts`**

```typescript
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
    return raw ? JSON.parse(raw) : null;
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
```

- [ ] **Step 4: Ejecutar tests — deben pasar**

```bash
npx ng test --include="**/auth.service.spec.ts" --watch=false 2>&1 | tail -10
```

Esperado: `5 specs, 0 failures`.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/auth/auth.service.ts src/app/core/auth/auth.service.spec.ts
git commit -m "feat: add AuthService with login/logout/hasRole"
```

---

## Task 5: Guards de autenticación y rol

**Files:**
- Create: `src/app/core/auth/auth.guard.ts`
- Create: `src/app/core/auth/role.guard.ts`
- Create: `src/app/core/auth/auth.guard.spec.ts`
- Create: `src/app/core/auth/role.guard.spec.ts`

- [ ] **Step 1: Escribir tests de authGuard**

Crear `src/app/core/auth/auth.guard.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
    router = jasmine.createSpyObj('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue({} as any);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('returns true when authenticated', () => {
    authService.isAuthenticated.and.returnValue(true);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(result).toBeTrue();
  });

  it('redirects to /login when not authenticated', () => {
    authService.isAuthenticated.and.returnValue(false);
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
```

- [ ] **Step 2: Ejecutar test — debe fallar**

```bash
npx ng test --include="**/auth.guard.spec.ts" --watch=false 2>&1 | tail -20
```

Esperado: error "authGuard not found".

- [ ] **Step 3: Implementar `src/app/core/auth/auth.guard.ts`**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
```

- [ ] **Step 4: Ejecutar test authGuard — debe pasar**

```bash
npx ng test --include="**/auth.guard.spec.ts" --watch=false 2>&1 | tail -10
```

Esperado: `2 specs, 0 failures`.

- [ ] **Step 5: Escribir tests de roleGuard**

Crear `src/app/core/auth/role.guard.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from './auth.service';

describe('roleGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['hasRole']);
    router = jasmine.createSpyObj('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue({} as any);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('returns true when user has required role', () => {
    authService.hasRole.and.returnValue(true);
    const route = { data: { roles: ['admin'] } } as any as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(route, {} as RouterStateSnapshot)
    );
    expect(result).toBeTrue();
  });

  it('redirects to / when user lacks required role', () => {
    authService.hasRole.and.returnValue(false);
    const route = { data: { roles: ['admin'] } } as any as ActivatedRouteSnapshot;
    TestBed.runInInjectionContext(() =>
      roleGuard(route, {} as RouterStateSnapshot)
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});
```

- [ ] **Step 6: Implementar `src/app/core/auth/role.guard.ts`**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from '../models/user.model';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles: UserRole[] = route.data?.['roles'] ?? [];
  return auth.hasRole(roles) ? true : router.createUrlTree(['/']);
};
```

- [ ] **Step 7: Ejecutar todos los tests de guards**

```bash
npx ng test --include="**/*.guard.spec.ts" --watch=false 2>&1 | tail -10
```

Esperado: `4 specs, 0 failures`.

- [ ] **Step 8: Commit**

```bash
git add src/app/core/auth/auth.guard.ts src/app/core/auth/auth.guard.spec.ts
git add src/app/core/auth/role.guard.ts src/app/core/auth/role.guard.spec.ts
git commit -m "feat: add authGuard and roleGuard functional guards"
```

---

## Task 6: Auth Interceptor

**Files:**
- Create: `src/app/core/interceptors/auth.interceptor.ts`

- [ ] **Step 1: Crear `src/app/core/interceptors/auth.interceptor.ts`**

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  if (!token) return next(req);
  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authReq);
};
```

- [ ] **Step 2: Registrar interceptor en `src/app/app.config.ts`**

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add src/app/core/interceptors/auth.interceptor.ts src/app/app.config.ts
git commit -m "feat: add auth HTTP interceptor, register in app config"
```

---

## Task 7: Header y BottomNav compartidos

**Files:**
- Create: `src/app/shared/components/header/header.component.ts`
- Create: `src/app/shared/components/header/header.component.html`
- Create: `src/app/shared/components/bottom-nav/bottom-nav.component.ts`
- Create: `src/app/shared/components/bottom-nav/bottom-nav.component.html`

- [ ] **Step 1: Crear `src/app/shared/components/header/header.component.html`**

```html
<header class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-brand-dark"
        style="height:54px">
  <div class="flex items-center gap-2">
    <img
      src="assets/logo.png"
      alt="Logo Campo de Tiro San Isidro"
      class="w-8 h-8 rounded-full object-cover border-2 border-brand-yellow bg-white"
    />
    <div class="leading-tight">
      <p class="text-white font-bold text-[10px] tracking-tight">Campo de Tiro</p>
      <p class="text-brand-yellow font-bold text-[7.5px] uppercase tracking-widest">San Isidro</p>
    </div>
  </div>
  <app-avatar
    [nombre]="(currentUser$ | async)?.nombre ?? ''"
    [apellidos]="(currentUser$ | async)?.apellidos ?? ''"
    [avatarUrl]="(currentUser$ | async)?.avatarUrl"
    [size]="30"
  />
</header>
```

- [ ] **Step 2: Crear `src/app/shared/components/header/header.component.ts`**

```typescript
import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { AvatarComponent } from '../avatar/avatar.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, AvatarComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private auth = inject(AuthService);
  readonly currentUser$ = this.auth.currentUser$;
}
```

- [ ] **Step 3: Crear `src/app/shared/components/bottom-nav/bottom-nav.component.html`**

```html
<nav class="fixed bottom-0 left-0 right-0 z-50 flex justify-around bg-white border-t border-gray-200"
     style="padding: 7px 0 5px">
  @for (item of navItems; track item.route) {
    <a
      [routerLink]="item.route"
      routerLinkActive="active-nav"
      class="nav-item flex flex-col items-center gap-0.5 text-[7px] font-bold uppercase tracking-wide text-gray-300 no-underline"
    >
      <i class="bi text-[17px]" [class]="item.icon"></i>
      {{ item.label }}
    </a>
  }
</nav>

<style>
  .active-nav {
    color: #1A1A1A !important;
  }
  .active-nav i {
    color: #FFE401!important;
  }
</style>
```

- [ ] **Step 4: Crear `src/app/shared/components/bottom-nav/bottom-nav.component.ts`**

```typescript
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  route: string;
  icon: string;
  label: string;
}

const SOCIO_NAV: NavItem[] = [
  { route: '/',          icon: 'bi-house-fill',  label: 'Inicio'   },
  { route: '/noticias',  icon: 'bi-newspaper',   label: 'Noticias' },
  { route: '/scores',    icon: 'bi-trophy',      label: 'Scores'   },
  { route: '/perfil',    icon: 'bi-person',      label: 'Perfil'   },
];

const ADMIN_NAV: NavItem[] = [
  { route: '/admin/socios',   icon: 'bi-people-fill', label: 'Socios'   },
  { route: '/admin/noticias', icon: 'bi-newspaper',   label: 'Noticias' },
  { route: '/admin/scores',   icon: 'bi-trophy',      label: 'Scores'   },
  { route: '/perfil',         icon: 'bi-gear',        label: 'Config'   },
];

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent {
  private auth = inject(AuthService);

  get navItems(): NavItem[] {
    return this.auth.hasRole(['admin', 'moderador']) ? ADMIN_NAV : SOCIO_NAV;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/components/header/ src/app/shared/components/bottom-nav/
git commit -m "feat: add HeaderComponent and BottomNavComponent"
```

---

## Task 8: Shell layout + LoginComponent + Routing raíz

**Files:**
- Create: `src/app/features/shell/shell.component.ts`
- Create: `src/app/features/shell/shell.component.html`
- Create: `src/app/features/auth/login/login.component.ts`
- Create: `src/app/features/auth/login/login.component.html`
- Create: `src/app/features/auth/auth.routes.ts`
- Create: `src/app/features/home/home.component.ts`
- Create: `src/app/features/home/home.component.html`
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Crear `src/app/features/shell/shell.component.html`**

```html
<app-header />
<main class="pt-[54px] pb-[52px] min-h-screen bg-surface">
  <router-outlet />
</main>
<app-bottom-nav />
```

- [ ] **Step 2: Crear `src/app/features/shell/shell.component.ts`**

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, BottomNavComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {}
```

- [ ] **Step 3: Crear `src/app/features/auth/login/login.component.html`**

```html
<div class="flex flex-col min-h-screen bg-brand-dark">
  <!-- Hero -->
  <div class="flex flex-col items-center gap-2 pt-10 pb-5 px-4">
    <div class="w-[72px] h-[72px] rounded-full bg-white border-[3px] border-gray-800 overflow-hidden">
      <img src="assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
    </div>
    <h1 class="text-white font-black text-[14px] tracking-wide">Campo de Tiro</h1>
    <p class="text-brand-yellow font-bold text-[8px] uppercase tracking-[2px]">San Isidro</p>
  </div>

  <!-- Card form -->
  <div class="flex-1 bg-white rounded-t-[22px] px-4 pt-5 pb-6">
    <h2 class="text-brand-dark font-black text-[14px] mb-4">Acceder</h2>

    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <label class="block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1">Email</label>
      <div class="flex items-center gap-2 bg-surface rounded-[10px] px-3 py-2 mb-3">
        <i class="bi bi-envelope-fill text-gray-300 text-[13px]"></i>
        <input
          formControlName="email"
          type="email"
          placeholder="socio@sanisidro.es"
          class="flex-1 bg-transparent text-[10px] font-medium text-brand-dark outline-none placeholder-gray-300"
        />
      </div>

      <label class="block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1">Contraseña</label>
      <div class="flex items-center gap-2 bg-surface rounded-[10px] px-3 py-2 mb-4">
        <i class="bi bi-lock-fill text-gray-300 text-[13px]"></i>
        <input
          formControlName="password"
          type="password"
          placeholder="••••••••"
          class="flex-1 bg-transparent text-[10px] font-medium text-brand-dark outline-none placeholder-gray-300"
        />
      </div>

      @if (error) {
        <p class="text-danger text-[9px] font-semibold mb-3">{{ error }}</p>
      }

      <button
        type="submit"
        [disabled]="form.invalid || loading"
        class="w-full flex items-center justify-center gap-2 bg-brand-yellow text-brand-dark font-bold text-[11px] tracking-wide rounded-[12px] py-3 disabled:opacity-50"
      >
        <i class="bi bi-box-arrow-in-right"></i>
        {{ loading ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>

    <p class="text-center mt-3 text-[8.5px] text-gray-300 font-semibold">¿Olvidaste tu contraseña?</p>
  </div>
</div>
```

- [ ] **Step 4: Crear `src/app/features/auth/login/login.component.ts`**

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { User } from '../../../core/models/user.model';

// Mock user para desarrollo — reemplazar con llamada HTTP real
const MOCK_USERS: (User & { password: string; token: string })[] = [
  {
    id: '1', nombre: 'Juan', apellidos: 'García', email: 'admin@test.es',
    numeroSocio: '0001', rol: 'admin', fechaAlta: new Date(), activo: true,
    password: '1234', token: 'mock-admin-token',
  },
  {
    id: '2', nombre: 'María', apellidos: 'López', email: 'mod@test.es',
    numeroSocio: '0002', rol: 'moderador', fechaAlta: new Date(), activo: true,
    password: '1234', token: 'mock-mod-token',
  },
  {
    id: '3', nombre: 'Carlos', apellidos: 'Ruiz', email: 'socio@test.es',
    numeroSocio: '0003', rol: 'socio', fechaAlta: new Date(), activo: true,
    password: '1234', token: 'mock-socio-token',
  },
];

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  error = '';
  loading = false;

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    const { email, password } = this.form.value;
    const found = MOCK_USERS.find(u => u.email === email && u.password === password);

    setTimeout(() => {
      this.loading = false;
      if (found) {
        const { password: _, token, ...user } = found;
        this.auth.login(user, token);
        this.router.navigate(['/']);
      } else {
        this.error = 'Email o contraseña incorrectos.';
      }
    }, 400);
  }
}
```

- [ ] **Step 5: Crear `src/app/features/home/home.component.html`**

```html
<div class="p-4">
  <h2 class="text-brand-dark font-bold text-[12px] uppercase tracking-wider mb-3">Inicio</h2>
  <p class="text-[10px] text-gray-500 font-medium">Bienvenido a Campo de Tiro San Isidro.</p>
</div>
```

- [ ] **Step 6: Crear `src/app/features/home/home.component.ts`**

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <div class="p-4">
      <h2 class="text-brand-dark font-bold text-[12px] uppercase tracking-wider mb-3">Inicio</h2>
      <p class="text-[10px] text-gray-500 font-medium">Bienvenido a Campo de Tiro San Isidro.</p>
    </div>
  `,
})
export class HomeComponent {}
```

- [ ] **Step 7: Copiar logo al directorio de assets**

```bash
cp src/asset/logo.png src/assets/logo.png
```

Verificar que `src/assets/` existe; si no, crearlo:
```bash
mkdir -p src/assets && cp src/asset/logo.png src/assets/logo.png
```

- [ ] **Step 8: Actualizar `src/app/app.routes.ts`**

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'noticias',
        loadChildren: () =>
          import('./features/noticias/noticias.routes').then(m => m.noticiasRoutes),
      },
      {
        path: 'scores',
        loadChildren: () =>
          import('./features/scores/scores.routes').then(m => m.scoresRoutes),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/perfil/perfil.component').then(m => m.PerfilComponent),
      },
      {
        path: 'admin',
        canActivate: [authGuard],
        loadChildren: () =>
          import('./features/admin/admin.routes').then(m => m.adminRoutes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 9: Crear stubs para rutas que aún no existen**

Crear `src/app/features/noticias/noticias.routes.ts`:
```typescript
import { Routes } from '@angular/router';
import { Component } from '@angular/core';

@Component({ standalone: true, template: '<p class="p-4 text-sm">Noticias — próximamente</p>' })
class NoticiasPlaceholderComponent {}

export const noticiasRoutes: Routes = [
  { path: '', component: NoticiasPlaceholderComponent },
];
```

Crear `src/app/features/scores/scores.routes.ts`:
```typescript
import { Routes } from '@angular/router';
import { Component } from '@angular/core';

@Component({ standalone: true, template: '<p class="p-4 text-sm">Scores — próximamente</p>' })
class ScoresPlaceholderComponent {}

export const scoresRoutes: Routes = [
  { path: '', component: ScoresPlaceholderComponent },
];
```

Crear `src/app/features/perfil/perfil.component.ts`:
```typescript
import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: '<p class="p-4 text-sm">Perfil — próximamente</p>',
})
export class PerfilComponent {}
```

- [ ] **Step 10: Verificar que la app arranca**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npm start
```

Abrir `http://localhost:4200` — debe redirigir a `/login`. Probar login con `admin@test.es` / `1234` — debe navegar a `/` con header y bottom nav.

- [ ] **Step 11: Commit**

```bash
git add src/app/features/ src/app/app.routes.ts src/assets/
git commit -m "feat: add shell layout, login screen, home stub, root routing"
```

---

## Task 9: Gestión de Socios (Admin)

**Files:**
- Create: `src/app/features/admin/socios/user.service.ts`
- Create: `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`
- Create: `src/app/features/admin/socios/lista-socios/lista-socios.component.html`
- Create: `src/app/features/admin/socios/form-socio/form-socio.component.ts`
- Create: `src/app/features/admin/socios/form-socio/form-socio.component.html`
- Create: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Crear `src/app/features/admin/socios/user.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User, UserRole } from '../../../core/models/user.model';

const MOCK_SOCIOS: User[] = [
  { id: '1', nombre: 'Juan', apellidos: 'García', email: 'admin@test.es', numeroSocio: '0001', rol: 'admin', fechaAlta: new Date('2023-01-15'), activo: true },
  { id: '2', nombre: 'María', apellidos: 'López', email: 'mod@test.es', numeroSocio: '0002', rol: 'moderador', fechaAlta: new Date('2023-03-10'), activo: true },
  { id: '3', nombre: 'Carlos', apellidos: 'Ruiz', email: 'socio@test.es', numeroSocio: '0003', rol: 'socio', fechaAlta: new Date('2024-06-01'), activo: false },
  { id: '4', nombre: 'Ana', apellidos: 'Martínez', email: 'ana@test.es', numeroSocio: '0004', rol: 'socio', fechaAlta: new Date('2024-09-20'), activo: true },
];

@Injectable({ providedIn: 'root' })
export class UserService {
  private sociosSubject = new BehaviorSubject<User[]>(MOCK_SOCIOS);
  readonly socios$ = this.sociosSubject.asObservable();

  getAll(): Observable<User[]> {
    return this.socios$;
  }

  getById(id: string): User | undefined {
    return this.sociosSubject.getValue().find(u => u.id === id);
  }

  create(data: Omit<User, 'id'>): void {
    const current = this.sociosSubject.getValue();
    const newUser: User = { ...data, id: Date.now().toString() };
    this.sociosSubject.next([...current, newUser]);
  }

  update(id: string, data: Partial<User>): void {
    const current = this.sociosSubject.getValue();
    this.sociosSubject.next(current.map(u => u.id === id ? { ...u, ...data } : u));
  }

  toggleActivo(id: string): void {
    const current = this.sociosSubject.getValue();
    this.sociosSubject.next(current.map(u => u.id === id ? { ...u, activo: !u.activo } : u));
  }
}
```

- [ ] **Step 2: Crear `src/app/features/admin/socios/lista-socios/lista-socios.component.html`**

```html
<div class="p-3">
  <!-- Buscador -->
  <div class="flex items-center gap-2 bg-white rounded-[10px] px-3 py-2 mb-3 shadow-sm">
    <i class="bi bi-search text-gray-300 text-[13px]"></i>
    <input
      [(ngModel)]="searchTerm"
      placeholder="Buscar socio..."
      class="flex-1 bg-transparent text-[9px] font-medium text-brand-dark outline-none placeholder-gray-300"
    />
  </div>

  <h3 class="section-title">Socios ({{ filteredSocios().length }})</h3>

  @for (socio of filteredSocios(); track socio.id) {
    <div class="flex items-center gap-2 bg-white rounded-[12px] px-3 py-2 mb-2 shadow-sm">
      <app-avatar [nombre]="socio.nombre" [apellidos]="socio.apellidos" [avatarUrl]="socio.avatarUrl" [size]="34" />
      <div class="flex-1 min-w-0">
        <p class="text-[9.5px] font-bold text-brand-dark truncate">{{ socio.nombre }} {{ socio.apellidos }}</p>
        <p class="text-[8px] text-gray-400 font-medium truncate">{{ socio.email }} · {{ socio.rol | titlecase }}</p>
      </div>
      <div class="flex flex-col items-end gap-1">
        <div class="w-2 h-2 rounded-full" [class]="socio.activo ? 'bg-success' : 'bg-gray-200'"></div>
        <span class="text-[7.5px] text-gray-300 font-semibold">#{{ socio.numeroSocio }}</span>
      </div>
    </div>
  }

  @if (filteredSocios().length === 0) {
    <p class="text-center text-[9px] text-gray-400 mt-6">No se encontraron socios.</p>
  }
</div>

<!-- FAB -->
<button
  (click)="goToCreate()"
  class="fixed bottom-[60px] right-4 w-[42px] h-[42px] rounded-full bg-brand-yellow text-brand-dark flex items-center justify-center shadow-lg z-40"
>
  <i class="bi bi-plus-lg text-[18px] font-black"></i>
</button>
```

- [ ] **Step 3: Crear `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`**

```typescript
import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { UserService } from '../user.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { User } from '../../../../core/models/user.model';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-lista-socios',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, AvatarComponent],
  templateUrl: './lista-socios.component.html',
})
export class ListaSociosComponent {
  private userService = inject(UserService);
  private router = inject(Router);

  searchTerm = '';
  private socios = toSignal(this.userService.getAll(), { initialValue: [] as User[] });

  filteredSocios = computed(() => {
    const term = this.searchTerm.toLowerCase();
    if (!term) return this.socios();
    return this.socios().filter(s =>
      s.nombre.toLowerCase().includes(term) ||
      s.apellidos.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.numeroSocio.includes(term)
    );
  });

  goToCreate(): void {
    this.router.navigate(['/admin/socios/nuevo']);
  }
}
```

- [ ] **Step 4: Crear `src/app/features/admin/socios/form-socio/form-socio.component.html`**

```html
<div class="p-3">
  <h3 class="section-title">{{ isEdit ? 'Editar Socio' : 'Nuevo Socio' }}</h3>

  <div class="bg-white rounded-[12px] p-3 shadow-sm">
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <label class="form-label">Nombre</label>
      <div class="form-field">
        <i class="bi bi-person"></i>
        <input formControlName="nombre" placeholder="Nombre" class="form-input" />
      </div>

      <label class="form-label">Apellidos</label>
      <div class="form-field">
        <i class="bi bi-person"></i>
        <input formControlName="apellidos" placeholder="Apellidos" class="form-input" />
      </div>

      <label class="form-label">Email</label>
      <div class="form-field">
        <i class="bi bi-envelope"></i>
        <input formControlName="email" type="email" placeholder="email@ejemplo.es" class="form-input" />
      </div>

      <label class="form-label">Nº Socio</label>
      <div class="form-field">
        <i class="bi bi-hash"></i>
        <input formControlName="numeroSocio" placeholder="0001" class="form-input" />
      </div>

      <label class="form-label">Rol</label>
      <div class="form-field">
        <i class="bi bi-shield"></i>
        <select formControlName="rol" class="form-input">
          <option value="socio">Socio</option>
          <option value="moderador">Moderador</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <button
        type="submit"
        [disabled]="form.invalid"
        class="w-full flex items-center justify-center gap-2 bg-brand-yellow text-brand-dark font-bold text-[10px] tracking-wide rounded-[10px] py-2.5 mt-2 disabled:opacity-50"
      >
        <i class="bi bi-person-plus-fill"></i>
        {{ isEdit ? 'Guardar cambios' : 'Crear socio' }}
      </button>

      <button
        type="button"
        (click)="cancel()"
        class="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-400 font-bold text-[10px] rounded-[10px] py-2.5 mt-2"
      >
        <i class="bi bi-x"></i> Cancelar
      </button>
    </form>
  </div>
</div>
```

- [ ] **Step 5: Crear `src/app/features/admin/socios/form-socio/form-socio.component.ts`**

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../user.service';
import { UserRole } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-socio',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-socio.component.html',
})
export class FormSocioComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  private editId?: string;

  form = this.fb.group({
    nombre:      ['', Validators.required],
    apellidos:   ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    numeroSocio: ['', Validators.required],
    rol:         ['socio' as UserRole, Validators.required],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const user = this.userService.getById(id);
      if (user) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue(user);
      }
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    if (this.isEdit && this.editId) {
      this.userService.update(this.editId, {
        nombre: val.nombre!,
        apellidos: val.apellidos!,
        email: val.email!,
        numeroSocio: val.numeroSocio!,
        rol: val.rol as UserRole,
      });
    } else {
      this.userService.create({
        nombre: val.nombre!,
        apellidos: val.apellidos!,
        email: val.email!,
        numeroSocio: val.numeroSocio!,
        rol: val.rol as UserRole,
        fechaAlta: new Date(),
        activo: true,
      });
    }
    this.router.navigate(['/admin/socios']);
  }

  cancel(): void {
    this.router.navigate(['/admin/socios']);
  }
}
```

- [ ] **Step 6: Crear `src/app/features/admin/admin.routes.ts`**

```typescript
import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

export const adminRoutes: Routes = [
  {
    path: 'socios',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/lista-socios/lista-socios.component').then(m => m.ListaSociosComponent),
  },
  {
    path: 'socios/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  {
    path: 'socios/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  {
    path: 'noticias',
    loadComponent: () => import('@angular/core').then(() => {
      const { Component } = require('@angular/core');
      @Component({ standalone: true, template: '<p class="p-4 text-sm">Noticias admin — plan B</p>' })
      class NoticiasAdminPlaceholder {}
      return { NoticiasAdminPlaceholder };
    }),
  },
  {
    path: 'scores',
    loadComponent: () => {
      const { Component } = require('@angular/core');
      @Component({ standalone: true, template: '<p class="p-4 text-sm">Scores admin — plan B</p>' })
      class ScoresAdminPlaceholder {}
      return Promise.resolve(ScoresAdminPlaceholder);
    },
  },
];
```

> **Nota:** Las rutas de noticias y scores admin son stubs temporales. Se implementan en el Plan B. Reemplaza el contenido de `admin.routes.ts` después de ejecutar el Plan B.

- [ ] **Step 7: Añadir clases de utilidad Tailwind a `styles.scss`**

Añadir al final de `src/styles.scss`:

```scss
@layer components {
  .section-title {
    @apply text-[9px] font-bold text-brand-dark uppercase tracking-[.8px] mb-2.5 flex items-center gap-1.5;
    &::after {
      content: '';
      @apply flex-1 h-px bg-gray-200;
    }
  }
  .form-label {
    @apply block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1;
  }
  .form-field {
    @apply flex items-center gap-2 bg-surface rounded-[10px] px-3 py-2 mb-2.5;
    i { @apply text-gray-300 text-[13px]; }
  }
  .form-input {
    @apply flex-1 bg-transparent text-[10px] font-medium text-brand-dark outline-none placeholder-gray-300;
  }
}
```

- [ ] **Step 8: Verificar la app completa**

```bash
npm start
```

- Ir a `http://localhost:4200` → redirige a `/login`
- Login con `admin@test.es` / `1234` → navega a `/`, bottom nav muestra items de admin
- Navegar a `/admin/socios` → lista de socios con buscador y FAB
- Pulsar FAB → formulario de nuevo socio
- Crear socio → vuelve a lista con el nuevo socio
- Login con `socio@test.es` / `1234` → bottom nav muestra items de socio, `/admin/socios` redirige a `/`

- [ ] **Step 9: Commit final**

```bash
git add src/app/features/admin/ src/app/app.routes.ts src/styles.scss
git commit -m "feat: add admin socios management (list, create, edit) with role guard"
```

---

## Self-Review

**Spec coverage:**
- ✅ Sec 1: Stack Angular 19 standalone — Task 1, 8
- ✅ Sec 2: Roles y permisos — Task 5 (guards), Task 9 (admin routes con roleGuard)
- ✅ Sec 3: Modelos User, Competicion, Score, News — Task 2
- ✅ Sec 4: Arquitectura carpetas — reflejada en todos los file paths
- ✅ Sec 5: Routing con lazy loading y guards — Task 8
- ✅ Sec 6: Diseño (Tailwind, Montserrat, Bootstrap Icons, avatar iniciales, logo bg blanco) — Task 1, 3, 7, 8
- ✅ Sec 7: AuthService, guards, interceptor — Tasks 4, 5, 6
- ✅ Sec 8: Login, Shell, Home, Lista Socios, Form Socio — Tasks 8, 9
- ✅ Sec 9: UserService con mock data — Task 9
- ✅ Sec 10: Tailwind config con paleta + Bootstrap Icons — Task 1

**Gaps:** Noticias, Scores, Competiciones, Perfil, y las pantallas admin restantes se cubren en el Plan B.

**Placeholder scan:** Ninguno. Todas las rutas admin stub tienen template inline explícito.

**Type consistency:** `UserRole` definido en Task 2, usado en Tasks 4, 5, 9 con el mismo import path. `User` interface usada consistentemente. `UserService.create()` recibe `Omit<User, 'id'>` y el formulario provee todos los campos requeridos.
