# Reset Password Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una ruta pública `/auth/reset-password` que capture el token de recuperación de Supabase y permita al usuario establecer una nueva contraseña.

**Architecture:** Un nuevo componente standalone `ResetPasswordComponent` lee el token del hash de la URL al inicializar, establece la sesión con `supabase.auth.setSession()`, muestra el formulario de nueva contraseña, y tras guardar redirige a `/login`. Si el token es inválido o falta, redirige inmediatamente a `/login`.

**Tech Stack:** Angular 17+ standalone components, Angular signals, Angular reactive forms, Supabase JS client, Tailwind CSS (mismas clases que login).

---

## File Map

| Acción   | Archivo |
|----------|---------|
| Crear    | `src/app/features/auth/reset-password/reset-password.component.ts` |
| Crear    | `src/app/features/auth/reset-password/reset-password.component.html` |
| Crear    | `src/app/features/auth/reset-password/reset-password.component.scss` |
| Modificar| `src/app/app.routes.ts` |
| Modificar| `src/app/features/auth/login/login.component.ts` (línea 71) |

---

### Task 1: Crear el componente ResetPasswordComponent

**Files:**
- Create: `src/app/features/auth/reset-password/reset-password.component.ts`
- Create: `src/app/features/auth/reset-password/reset-password.component.html`
- Create: `src/app/features/auth/reset-password/reset-password.component.scss`

- [ ] **Step 1: Crear el archivo TypeScript del componente**

Crear `src/app/features/auth/reset-password/reset-password.component.ts` con este contenido:

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../../core/supabase/supabase.client';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  form = this.fb.group({
    password:  ['', [Validators.required, Validators.minLength(6)]],
    confirmar: ['', Validators.required],
  });

  mostrarPassword  = signal(false);
  mostrarConfirmar = signal(false);
  loading          = signal(false);
  error            = signal('');
  exito            = signal(false);
  tokenValido      = signal(false);

  async ngOnInit(): Promise<void> {
    // El token llega en el hash: #access_token=...&refresh_token=...&type=recovery
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token') ?? '';
    const type         = params.get('type');

    if (!accessToken || type !== 'recovery') {
      this.router.navigate(['/login']);
      return;
    }

    const { error } = await supabase.auth.setSession({
      access_token:  accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      this.router.navigate(['/login']);
      return;
    }

    this.tokenValido.set(true);
  }

  async guardar(): Promise<void> {
    const { password, confirmar } = this.form.value;
    if (password !== confirmar) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { error } = await supabase.auth.updateUser({ password: password! });
    this.loading.set(false);
    if (error) {
      this.error.set('No se pudo cambiar la contraseña. El enlace puede haber expirado.');
    } else {
      this.exito.set(true);
      await supabase.auth.signOut();
      setTimeout(() => this.router.navigate(['/login']), 2500);
    }
  }
}
```

- [ ] **Step 2: Crear el template HTML**

Crear `src/app/features/auth/reset-password/reset-password.component.html` con este contenido:

```html
<div class="login-page">
  <div class="login-hero">
    <div class="login-logo">
      <img src="logo.png" alt="Logo" />
    </div>
  </div>

  <div class="login-body">
    @if (exito()) {
      <h2 class="login-heading">¡Contraseña actualizada!</h2>
      <p class="reset-desc">Tu contraseña se ha cambiado correctamente. En un momento te redirigimos al inicio de sesión.</p>
    } @else if (tokenValido()) {
      <h2 class="login-heading">Nueva contraseña</h2>
      <p class="reset-desc">Elige una contraseña segura de al menos 6 caracteres.</p>

      <form [formGroup]="form" (ngSubmit)="guardar()">
        <label class="form-label">Nueva contraseña</label>
        <div class="login-field login-field--mb">
          <i class="bi bi-lock-fill"></i>
          <input
            formControlName="password"
            [type]="mostrarPassword() ? 'text' : 'password'"
            placeholder="••••••••"
            autocomplete="new-password"
          />
          <button type="button" class="login-field__eye" (click)="mostrarPassword.set(!mostrarPassword())">
            <i [class]="mostrarPassword() ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
          </button>
        </div>

        <label class="form-label">Confirmar contraseña</label>
        <div class="login-field login-field--mb-lg">
          <i class="bi bi-lock-fill"></i>
          <input
            formControlName="confirmar"
            [type]="mostrarConfirmar() ? 'text' : 'password'"
            placeholder="••••••••"
            autocomplete="new-password"
          />
          <button type="button" class="login-field__eye" (click)="mostrarConfirmar.set(!mostrarConfirmar())">
            <i [class]="mostrarConfirmar() ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
          </button>
        </div>

        @if (error()) {
          <p class="login-error">{{ error() }}</p>
        }

        <button type="submit" [disabled]="form.invalid || loading()" class="btn-login">
          <i class="bi bi-check-lg"></i>
          {{ loading() ? 'Guardando...' : 'Guardar contraseña' }}
        </button>
      </form>
    } @else {
      <p class="reset-desc">Verificando enlace...</p>
    }
  </div>
</div>
```

- [ ] **Step 3: Crear el archivo SCSS**

Crear `src/app/features/auth/reset-password/reset-password.component.scss` con este contenido:

```scss
// Todos los estilos base vienen de login.component.scss mediante las clases compartidas.
// Solo añadimos lo específico de esta pantalla.

.reset-desc {
  @apply text-gray-500 text-[13px] mb-4;
}

.form-label {
  @apply block text-brand-dark text-[13px] font-semibold mb-1;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/auth/reset-password/
git commit -m "feat(auth): add ResetPasswordComponent for password recovery flow"
```

---

### Task 2: Registrar la ruta y actualizar el redirectTo

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/features/auth/login/login.component.ts`

- [ ] **Step 1: Añadir la ruta en app.routes.ts**

En `src/app/app.routes.ts`, añadir la ruta `auth/reset-password` **antes** del wildcard `{ path: '**', redirectTo: '' }`.

El archivo debe quedar así:

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
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
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
        loadChildren: () =>
          import('./features/admin/admin.routes').then(m => m.adminRoutes),
      },
      {
        path: 'juego',
        loadComponent: () =>
          import('./features/juego-platos/juego-platos.component').then(m => m.JuegoPlatosComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 2: Actualizar el redirectTo en login.component.ts**

En `src/app/features/auth/login/login.component.ts`, línea 71, cambiar:

```typescript
redirectTo: `${window.location.origin}/`,
```

Por:

```typescript
redirectTo: 'https://tiroalplatosanisidro.vercel.app/auth/reset-password',
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app.routes.ts src/app/features/auth/login/login.component.ts
git commit -m "feat(auth): register reset-password route and fix recovery redirectTo URL"
```

---

### Task 3: Configurar Supabase Dashboard

> Esta tarea es manual — no hay código que cambiar.

- [ ] **Step 1: Actualizar Site URL y Redirect URLs en Supabase**

Ir a: [https://supabase.com/dashboard/project/llaowdgdzmdgseeoctdq/auth/url-configuration](https://supabase.com/dashboard/project/llaowdgdzmdgseeoctdq/auth/url-configuration)

Configurar:
- **Site URL**: `https://tiroalplatosanisidro.vercel.app`
- **Redirect URLs**: añadir `https://tiroalplatosanisidro.vercel.app/**`

Guardar cambios.

- [ ] **Step 2: Verificar flujo completo**

1. Ir a la app en producción
2. Hacer clic en "¿Olvidaste tu contraseña?"
3. Introducir el email
4. Abrir el email recibido y hacer clic en el enlace
5. Verificar que se abre `https://tiroalplatosanisidro.vercel.app/auth/reset-password`
6. Introducir nueva contraseña y confirmar
7. Verificar que redirige a `/login` y se puede entrar con la nueva contraseña
