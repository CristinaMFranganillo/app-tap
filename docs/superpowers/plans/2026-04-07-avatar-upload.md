# Avatar Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a los socios subir una foto de perfil desde la pantalla de perfil y, opcionalmente, al completar el primer login.

**Architecture:** Se crea un `AvatarUploadService` compartido que redimensiona la imagen en el cliente (Canvas API), la sube al bucket `avatars` de Supabase Storage con el path `{userId}.jpg`, y actualiza `profiles.avatar_url`. Se reutiliza en dos puntos de entrada: el hero del perfil (icono de cámara sobre el avatar) y el modal de primer login (paso 2 tras cambiar contraseña).

**Tech Stack:** Angular 17+ standalone · Supabase Storage · Canvas API (redimensionado cliente) · Tailwind CSS

---

## File Map

### Crear
- `src/app/core/services/avatar-upload.service.ts` — redimensiona imagen, sube a Storage, actualiza profiles.avatar_url y recarga AuthService
- `src/app/shared/components/avatar-editor/avatar-editor.component.ts/html/scss` — componente reutilizable: input file oculto + preview + botón confirmar/cancelar

### Modificar
- `src/app/features/perfil/perfil.component.ts` — inyectar AvatarUploadService, añadir método onAvatarClick
- `src/app/features/perfil/perfil.component.html` — envolver avatar en botón con icono cámara
- `src/app/features/perfil/perfil.component.scss` — estilos del botón cámara superpuesto
- `src/app/shared/components/cambiar-password/cambiar-password.component.ts` — añadir fase 'avatar' tras guardar contraseña, usar AvatarEditorComponent
- `src/app/shared/components/cambiar-password/cambiar-password.component.html` — añadir paso 2 con AvatarEditorComponent
- `src/app/core/auth/auth.service.ts` — añadir método `reloadProfile()` público

---

## Task 1: AvatarUploadService

**Files:**
- Create: `src/app/core/services/avatar-upload.service.ts`
- Modify: `src/app/core/auth/auth.service.ts`

- [ ] **Step 1: Añadir `reloadProfile()` público en AuthService**

En `src/app/core/auth/auth.service.ts`, hacer público el método `loadProfile` o añadir un wrapper:

```typescript
async reloadProfile(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await this.loadProfile(user.id);
}
```

Añadir justo después del método `loadProfile` existente (línea ~53).

- [ ] **Step 2: Crear AvatarUploadService**

Crear `src/app/core/services/avatar-upload.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { supabase } from '../supabase/supabase.client';

const MAX_SIZE = 300; // px

@Injectable({ providedIn: 'root' })
export class AvatarUploadService {
  private auth = inject(AuthService);

  async upload(file: File): Promise<void> {
    const userId = this.auth.currentUser?.id;
    if (!userId) throw new Error('No hay sesión activa');

    const resized = await this.resizeImage(file, MAX_SIZE);
    const path = `${userId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, resized, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (updateError) throw new Error(updateError.message);

    await this.auth.reloadProfile();
  }

  private resizeImage(file: File, maxSize: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Error al procesar la imagen'));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = url;
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/avatar-upload.service.ts src/app/core/auth/auth.service.ts
git commit -m "feat: add AvatarUploadService and reloadProfile to AuthService"
```

---

## Task 2: AvatarEditorComponent

**Files:**
- Create: `src/app/shared/components/avatar-editor/avatar-editor.component.ts`
- Create: `src/app/shared/components/avatar-editor/avatar-editor.component.html`
- Create: `src/app/shared/components/avatar-editor/avatar-editor.component.scss`

- [ ] **Step 1: Crear el componente TS**

Crear `src/app/shared/components/avatar-editor/avatar-editor.component.ts`:

```typescript
import { Component, inject, output, signal } from '@angular/core';
import { AvatarUploadService } from '../../../core/services/avatar-upload.service';

@Component({
  selector: 'app-avatar-editor',
  standalone: true,
  templateUrl: './avatar-editor.component.html',
  styleUrl: './avatar-editor.component.scss',
})
export class AvatarEditorComponent {
  private uploadService = inject(AvatarUploadService);

  completado = output<void>();
  omitido    = output<void>();

  preview   = signal<string | null>(null);
  saving    = signal(false);
  error     = signal('');
  private selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Solo se permiten imágenes.');
      return;
    }
    this.selectedFile = file;
    this.error.set('');
    const reader = new FileReader();
    reader.onload = e => this.preview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async guardar(): Promise<void> {
    if (!this.selectedFile) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.uploadService.upload(this.selectedFile);
      this.completado.emit();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al subir la imagen.');
    } finally {
      this.saving.set(false);
    }
  }

  omitir(): void {
    this.omitido.emit();
  }
}
```

- [ ] **Step 2: Crear el HTML**

Crear `src/app/shared/components/avatar-editor/avatar-editor.component.html`:

```html
<div class="avatar-editor">
  <p class="avatar-editor__titulo">Añade una foto de perfil</p>
  <p class="avatar-editor__sub">Opcional · puedes cambiarla más adelante desde tu perfil</p>

  @if (error()) {
    <p class="avatar-editor__error">{{ error() }}</p>
  }

  <label class="avatar-editor__zona" [class.avatar-editor__zona--preview]="preview()">
    @if (preview()) {
      <img [src]="preview()!" alt="Preview" class="avatar-editor__preview" />
    } @else {
      <i class="bi bi-camera-fill avatar-editor__icono"></i>
      <span class="avatar-editor__hint">Toca para seleccionar</span>
    }
    <input
      type="file"
      accept="image/*"
      class="avatar-editor__input"
      (change)="onFileSelected($event)"
    />
  </label>

  <div class="avatar-editor__actions">
    <button type="button" (click)="omitir()" class="btn-secondary">Ahora no</button>
    <button
      type="button"
      (click)="guardar()"
      [disabled]="!preview() || saving()"
      class="btn-primary"
    >
      {{ saving() ? 'Subiendo...' : 'Guardar foto' }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Crear los estilos**

Crear `src/app/shared/components/avatar-editor/avatar-editor.component.scss`:

```scss
.avatar-editor {
  @apply flex flex-col items-center gap-3 w-full;

  &__titulo {
    font-size: 14px;
    font-weight: 800;
    color: #1A1A1A;
    margin: 0;
  }

  &__sub {
    font-size: 11px;
    color: #9CA3AF;
    font-weight: 500;
    margin: 0;
    text-align: center;
  }

  &__error {
    font-size: 12px;
    font-weight: 600;
    color: #EF4444;
    margin: 0;
  }

  &__zona {
    @apply flex flex-col items-center justify-center cursor-pointer;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    border: 2px dashed #E5E7EB;
    background: #F5F5F5;
    overflow: hidden;
    position: relative;
    transition: border-color 150ms;

    &:hover { border-color: #F5E000; }

    &--preview {
      border-style: solid;
      border-color: #F5E000;
    }
  }

  &__icono {
    font-size: 24px;
    color: #9CA3AF;
  }

  &__hint {
    font-size: 9px;
    font-weight: 700;
    color: #9CA3AF;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 4px;
  }

  &__preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  &__actions {
    @apply flex gap-2 w-full pt-1;

    button { @apply flex-1; }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/components/avatar-editor/
git commit -m "feat: add AvatarEditorComponent for photo upload"
```

---

## Task 3: Avatar editable en Perfil

**Files:**
- Modify: `src/app/features/perfil/perfil.component.ts`
- Modify: `src/app/features/perfil/perfil.component.html`
- Modify: `src/app/features/perfil/perfil.component.scss`

- [ ] **Step 1: Actualizar PerfilComponent TS**

En `src/app/features/perfil/perfil.component.ts`:

Añadir import:
```typescript
import { AvatarEditorComponent } from '../../shared/components/avatar-editor/avatar-editor.component';
```

Añadir en `imports` del decorador:
```typescript
imports: [AvatarComponent, DatePipe, EmptyStateComponent, AvatarEditorComponent],
```

Añadir signal y método en la clase:
```typescript
mostrarEditorAvatar = signal(false);

abrirEditorAvatar(): void {
  this.mostrarEditorAvatar.set(true);
}

onAvatarCompletado(): void {
  this.mostrarEditorAvatar.set(false);
}

onAvatarOmitido(): void {
  this.mostrarEditorAvatar.set(false);
}
```

- [ ] **Step 2: Actualizar HTML del perfil**

Reemplazar la sección hero en `src/app/features/perfil/perfil.component.html`:

```html
<!-- Hero -->
<div class="perfil-hero">
  <button class="perfil-hero__avatar-btn" (click)="abrirEditorAvatar()">
    <app-avatar
      [nombre]="user()?.nombre ?? ''"
      [apellidos]="user()?.apellidos ?? ''"
      [avatarUrl]="user()?.avatarUrl"
      [size]="64"
    />
    <span class="perfil-hero__camara">
      <i class="bi bi-camera-fill"></i>
    </span>
  </button>
  <h2 class="perfil-hero__nombre">
    {{ user()?.nombre }} {{ user()?.apellidos }}
  </h2>
  <p class="perfil-hero__rol">
    {{ user()?.rol }} · #{{ user()?.numeroSocio }}
  </p>
</div>

@if (mostrarEditorAvatar()) {
  <div class="perfil-avatar-modal">
    <div class="perfil-avatar-modal__sheet">
      <app-avatar-editor
        (completado)="onAvatarCompletado()"
        (omitido)="onAvatarOmitido()"
      />
    </div>
  </div>
}
```

- [ ] **Step 3: Añadir estilos**

En `src/app/features/perfil/perfil.component.scss`, añadir al final:

```scss
.perfil-hero__avatar-btn {
  position: relative;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: inline-block;
}

.perfil-hero__camara {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #F5E000;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;

  i {
    font-size: 10px;
    color: #1A1A1A;
  }
}

.perfil-avatar-modal {
  @apply fixed inset-0 z-50 flex items-end justify-center;
  background: rgba(0, 0, 0, 0.5);

  &__sheet {
    @apply w-full p-5 pb-8;
    background: white;
    border-radius: 20px 20px 0 0;
    max-width: 480px;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/perfil/
git commit -m "feat: add avatar upload button to perfil hero"
```

---

## Task 4: Paso de avatar en primer login

**Files:**
- Modify: `src/app/shared/components/cambiar-password/cambiar-password.component.ts`
- Modify: `src/app/shared/components/cambiar-password/cambiar-password.component.html`

- [ ] **Step 1: Actualizar CambiarPasswordComponent TS**

Reemplazar `src/app/shared/components/cambiar-password/cambiar-password.component.ts`:

```typescript
import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { UserService } from '../../../features/admin/socios/user.service';
import { supabase } from '../../../core/supabase/supabase.client';
import { AvatarEditorComponent } from '../avatar-editor/avatar-editor.component';

@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarEditorComponent],
  templateUrl: './cambiar-password.component.html',
  styleUrl: './cambiar-password.component.scss',
})
export class CambiarPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private userService = inject(UserService);

  cerrar = output<void>();

  fase    = signal<'password' | 'avatar'>('password');
  saving  = signal(false);
  error   = signal('');

  form = this.fb.group({
    password:  ['', [Validators.required, Validators.minLength(6)]],
    confirmar: ['', Validators.required],
  });

  async guardar(): Promise<void> {
    const { password, confirmar } = this.form.value;
    if (password !== confirmar) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const { error } = await supabase.auth.updateUser({ password: password! });
      if (error) throw new Error(error.message);
      await this.marcarLoginDone();
      this.fase.set('avatar'); // pasar al paso 2
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al cambiar la contraseña.');
    } finally {
      this.saving.set(false);
    }
  }

  async omitir(): Promise<void> {
    await this.marcarLoginDone();
    this.cerrar.emit();
  }

  onAvatarCompletado(): void {
    this.cerrar.emit();
  }

  onAvatarOmitido(): void {
    this.cerrar.emit();
  }

  private async marcarLoginDone(): Promise<void> {
    const id = this.auth.currentUser?.id;
    if (id) await this.userService.setFirstLoginDone(id);
  }
}
```

- [ ] **Step 2: Actualizar HTML**

Reemplazar `src/app/shared/components/cambiar-password/cambiar-password.component.html`:

```html
<div class="modal-backdrop">
  <div class="modal-sheet">

    @if (fase() === 'password') {
      <h2 class="text-[12px] font-bold text-brand-dark mb-1">¡Bienvenido!</h2>
      <p class="text-[13px] text-gray-400 font-medium mb-4">
        Estás usando una contraseña provisional. ¿Quieres cambiarla ahora?
      </p>

      @if (error()) {
        <p class="text-[13px] text-danger font-semibold mb-3">{{ error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="guardar()" class="flex flex-col gap-3">
        <div>
          <label class="form-label">Nueva contraseña</label>
          <input formControlName="password" type="password" placeholder="Mínimo 6 caracteres" class="form-input-surface" />
        </div>
        <div>
          <label class="form-label">Confirmar contraseña</label>
          <input formControlName="confirmar" type="password" placeholder="Repite la contraseña" class="form-input-surface" />
        </div>

        <div class="flex gap-2 pt-1">
          <button type="button" (click)="omitir()" class="btn-secondary">Ahora no</button>
          <button type="submit" [disabled]="form.invalid || saving()" class="btn-primary">
            {{ saving() ? 'Guardando...' : 'Cambiar contraseña' }}
          </button>
        </div>
      </form>
    }

    @if (fase() === 'avatar') {
      <app-avatar-editor
        (completado)="onAvatarCompletado()"
        (omitido)="onAvatarOmitido()"
      />
    }

  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/components/cambiar-password/
git commit -m "feat: add optional avatar upload step to first-login flow"
```

---

## Task 5: Push final y verificación

- [ ] **Step 1: Build de verificación**

```bash
npx ng build --configuration production
```

Esperado: `Application bundle generation complete` sin errores.

- [ ] **Step 2: Push a Vercel**

```bash
git push tiroalplato main
```

- [ ] **Step 3: Verificar en app**

1. Entrar con un socio nuevo → aparece modal contraseña → cambiar → aparece paso de foto
2. Pulsar "Ahora no" → cierra
3. Ir a Perfil → pulsar icono cámara sobre avatar → seleccionar imagen → "Guardar foto" → avatar actualizado en toda la app
