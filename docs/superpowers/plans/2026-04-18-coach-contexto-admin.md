# Coach Contexto Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a admin y moderador añadir contenido contextual que el coach inyecta automáticamente en informes y conversaciones.

**Architecture:** Nueva tabla `coach_contexto` en Supabase con RLS. La edge function `gemini-coach` consulta las entradas activas y las inyecta en el prompt. Panel admin Angular con lista + formulario, accesible desde la home de admin/moderador.

**Tech Stack:** Angular 19 standalone, Supabase PostgreSQL + RLS, Deno edge function, Tailwind CSS, Bootstrap Icons.

---

### Task 1: Migración de base de datos

**Files:**
- Create: `supabase/migrations/029_coach_contexto.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/029_coach_contexto.sql

CREATE TYPE categoria_coach AS ENUM (
  'noticia',
  'consejo_tecnico',
  'aviso_torneo',
  'equipamiento'
);

CREATE TABLE IF NOT EXISTS coach_contexto (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text NOT NULL,
  contenido        text NOT NULL,
  categoria        categoria_coach NOT NULL,
  activo           boolean NOT NULL DEFAULT true,
  fecha_expiracion date NULL,
  created_by       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_contexto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_contexto_select"
  ON coach_contexto FOR SELECT TO authenticated USING (true);

CREATE POLICY "coach_contexto_insert"
  ON coach_contexto FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "coach_contexto_update"
  ON coach_contexto FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "coach_contexto_delete"
  ON coach_contexto FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
```

- [ ] **Step 2: Aplicar la migración**

```bash
supabase db push
```

Expected: migración aplicada sin errores.

- [ ] **Step 3: Commit**

```bash
rtk git add supabase/migrations/029_coach_contexto.sql
rtk git commit -m "feat(db): add coach_contexto table with RLS"
```

---

### Task 2: Modelo e interfaz TypeScript

**Files:**
- Modify: `src/app/core/models/coach.model.ts`

- [ ] **Step 1: Añadir tipos al modelo existente**

Abrir `src/app/core/models/coach.model.ts` y añadir al final:

```typescript
export type CategoriaCoach = 'noticia' | 'consejo_tecnico' | 'aviso_torneo' | 'equipamiento';

export interface CoachContexto {
  id: string;
  titulo: string;
  contenido: string;
  categoria: CategoriaCoach;
  activo: boolean;
  fechaExpiracion: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CoachContextoForm {
  titulo: string;
  contenido: string;
  categoria: CategoriaCoach;
  activo: boolean;
  fechaExpiracion: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/app/core/models/coach.model.ts
rtk git commit -m "feat(coach): add CoachContexto model types"
```

---

### Task 3: Servicio `coach-contexto.service.ts`

**Files:**
- Create: `src/app/features/admin/coach/coach-contexto.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { supabase } from '../../../core/supabase/supabase.client';
import { CoachContexto, CoachContextoForm } from '../../../core/models/coach.model';

@Injectable({ providedIn: 'root' })
export class CoachContextoService {

  getAll(): Observable<CoachContexto[]> {
    return from(
      supabase
        .from('coach_contexto')
        .select('*')
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).map(this.mapRow);
      })
    );
  }

  async crear(form: CoachContextoForm, createdBy: string): Promise<void> {
    const { error } = await supabase.from('coach_contexto').insert({
      titulo: form.titulo,
      contenido: form.contenido,
      categoria: form.categoria,
      activo: form.activo,
      fecha_expiracion: form.fechaExpiracion ?? null,
      created_by: createdBy,
    });
    if (error) throw error;
  }

  async actualizar(id: string, form: Partial<CoachContextoForm>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (form.titulo !== undefined)          payload['titulo']           = form.titulo;
    if (form.contenido !== undefined)       payload['contenido']        = form.contenido;
    if (form.categoria !== undefined)       payload['categoria']        = form.categoria;
    if (form.activo !== undefined)          payload['activo']           = form.activo;
    if (form.fechaExpiracion !== undefined) payload['fecha_expiracion'] = form.fechaExpiracion ?? null;

    const { error } = await supabase.from('coach_contexto').update(payload).eq('id', id);
    if (error) throw error;
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await supabase.from('coach_contexto').delete().eq('id', id);
    if (error) throw error;
  }

  async getById(id: string): Promise<CoachContexto | null> {
    const { data, error } = await supabase
      .from('coach_contexto')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return this.mapRow(data);
  }

  private mapRow(row: Record<string, unknown>): CoachContexto {
    return {
      id:              row['id'] as string,
      titulo:          row['titulo'] as string,
      contenido:       row['contenido'] as string,
      categoria:       row['categoria'] as CoachContexto['categoria'],
      activo:          row['activo'] as boolean,
      fechaExpiracion: row['fecha_expiracion'] as string | null,
      createdBy:       row['created_by'] as string,
      createdAt:       row['created_at'] as string,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/app/features/admin/coach/coach-contexto.service.ts
rtk git commit -m "feat(coach): add CoachContextoService"
```

---

### Task 4: Componente lista admin

**Files:**
- Create: `src/app/features/admin/coach/lista-coach-contexto/lista-coach-contexto.component.ts`
- Create: `src/app/features/admin/coach/lista-coach-contexto/lista-coach-contexto.component.html`
- Create: `src/app/features/admin/coach/lista-coach-contexto/lista-coach-contexto.component.scss`

- [ ] **Step 1: Crear el componente TS**

```typescript
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith } from 'rxjs';
import { DatePipe } from '@angular/common';
import { CoachContextoService } from '../coach-contexto.service';
import { CoachContexto } from '../../../../core/models/coach.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-lista-coach-contexto',
  standalone: true,
  imports: [DatePipe, ConfirmDialogComponent],
  templateUrl: './lista-coach-contexto.component.html',
  styleUrl: './lista-coach-contexto.component.scss',
})
export class ListaCoachContextoComponent {
  private service = inject(CoachContextoService);
  private router  = inject(Router);

  private refresh$ = new Subject<void>();
  pendingDeleteId  = signal<string | null>(null);

  entradas = toSignal(
    this.refresh$.pipe(
      startWith(null),
      switchMap(() => this.service.getAll())
    ),
    { initialValue: [] as CoachContexto[] }
  );

  nueva(): void {
    this.router.navigate(['/admin/coach/nueva']);
  }

  editar(id: string): void {
    this.router.navigate(['/admin/coach', id]);
  }

  confirmarEliminar(id: string): void {
    this.pendingDeleteId.set(id);
  }

  async eliminar(): Promise<void> {
    const id = this.pendingDeleteId();
    if (!id) return;
    this.pendingDeleteId.set(null);
    await this.service.eliminar(id);
    this.refresh$.next();
  }

  cancelarEliminar(): void {
    this.pendingDeleteId.set(null);
  }

  async toggleActivo(entrada: CoachContexto): Promise<void> {
    await this.service.actualizar(entrada.id, { activo: !entrada.activo });
    this.refresh$.next();
  }

  badgeClase(categoria: CoachContexto['categoria']): string {
    const map: Record<string, string> = {
      noticia:        'badge-azul',
      consejo_tecnico:'badge-verde',
      aviso_torneo:   'badge-amber',
      equipamiento:   'badge-morado',
    };
    return map[categoria] ?? '';
  }

  badgeLabel(categoria: CoachContexto['categoria']): string {
    const map: Record<string, string> = {
      noticia:        'Noticia',
      consejo_tecnico:'Consejo técnico',
      aviso_torneo:   'Aviso torneo',
      equipamiento:   'Equipamiento',
    };
    return map[categoria] ?? categoria;
  }
}
```

- [ ] **Step 2: Crear el HTML**

```html
<div class="p-4">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-bold text-gray-800">Contexto del Coach</h2>
    <button
      (click)="nueva()"
      class="flex items-center gap-1 bg-amber-400 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-amber-500 transition-colors"
    >
      <i class="bi bi-plus-lg"></i> Nueva entrada
    </button>
  </div>

  @if (entradas().length === 0) {
    <div class="text-center py-10 text-gray-400">
      <i class="bi bi-robot text-3xl mb-2 block"></i>
      <p class="text-sm">Sin entradas. Añade contexto para que el coach lo use.</p>
    </div>
  }

  <div class="flex flex-col gap-3">
    @for (e of entradas(); track e.id) {
      <div class="card p-3 flex flex-col gap-2">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span [class]="'coach-badge ' + badgeClase(e.categoria)">{{ badgeLabel(e.categoria) }}</span>
              @if (!e.activo) {
                <span class="text-xs text-gray-400 italic">Inactivo</span>
              }
              @if (e.fechaExpiracion) {
                <span class="text-xs text-gray-400">Expira: {{ e.fechaExpiracion | date:'dd/MM/yyyy' }}</span>
              }
            </div>
            <p class="text-sm font-semibold text-gray-800">{{ e.titulo }}</p>
            <p class="text-xs text-gray-500 mt-1 line-clamp-2">{{ e.contenido }}</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              (click)="toggleActivo(e)"
              [title]="e.activo ? 'Desactivar' : 'Activar'"
              class="text-lg"
            >
              <i [class]="'bi ' + (e.activo ? 'bi-toggle-on text-amber-400' : 'bi-toggle-off text-gray-300')"></i>
            </button>
            <button (click)="editar(e.id)" class="text-gray-400 hover:text-amber-500 transition-colors">
              <i class="bi bi-pencil"></i>
            </button>
            <button (click)="confirmarEliminar(e.id)" class="text-gray-400 hover:text-red-500 transition-colors">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    }
  </div>
</div>

@if (pendingDeleteId()) {
  <app-confirm-dialog
    mensaje="¿Eliminar esta entrada del coach?"
    (confirmar)="eliminar()"
    (cancelar)="cancelarEliminar()"
  />
}
```

- [ ] **Step 3: Crear el SCSS**

```scss
.coach-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;

  &.badge-azul    { background: #DBEAFE; color: #1D4ED8; }
  &.badge-verde   { background: #D1FAE5; color: #065F46; }
  &.badge-amber   { background: #FEF3C7; color: #92400E; }
  &.badge-morado  { background: #EDE9FE; color: #5B21B6; }
}
```

- [ ] **Step 4: Commit**

```bash
rtk git add src/app/features/admin/coach/
rtk git commit -m "feat(coach): add lista-coach-contexto component"
```

---

### Task 5: Componente formulario crear/editar

**Files:**
- Create: `src/app/features/admin/coach/form-coach-contexto/form-coach-contexto.component.ts`
- Create: `src/app/features/admin/coach/form-coach-contexto/form-coach-contexto.component.html`

- [ ] **Step 1: Crear el componente TS**

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CoachContextoService } from '../coach-contexto.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-form-coach-contexto',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-coach-contexto.component.html',
})
export class FormCoachContextoComponent implements OnInit {
  private fb      = inject(FormBuilder);
  private service = inject(CoachContextoService);
  private auth    = inject(AuthService);
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);

  isEdit    = false;
  editId?: string;
  guardando = false;

  form = this.fb.group({
    titulo:          ['', Validators.required],
    contenido:       ['', Validators.required],
    categoria:       ['noticia', Validators.required],
    activo:          [true],
    fechaExpiracion: [null as string | null],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const entrada = await this.service.getById(id);
      if (entrada) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue({
          titulo:          entrada.titulo,
          contenido:       entrada.contenido,
          categoria:       entrada.categoria,
          activo:          entrada.activo,
          fechaExpiracion: entrada.fechaExpiracion,
        });
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.guardando) return;
    this.guardando = true;
    const val = this.form.value;
    try {
      if (this.isEdit && this.editId) {
        await this.service.actualizar(this.editId, {
          titulo:          val.titulo!,
          contenido:       val.contenido!,
          categoria:       val.categoria as any,
          activo:          val.activo ?? true,
          fechaExpiracion: val.fechaExpiracion ?? null,
        });
      } else {
        const userId = this.auth.currentUser?.id ?? '';
        await this.service.crear({
          titulo:          val.titulo!,
          contenido:       val.contenido!,
          categoria:       val.categoria as any,
          activo:          val.activo ?? true,
          fechaExpiracion: val.fechaExpiracion ?? null,
        }, userId);
      }
      this.router.navigate(['/admin/coach']);
    } finally {
      this.guardando = false;
    }
  }

  cancelar(): void {
    this.router.navigate(['/admin/coach']);
  }
}
```

- [ ] **Step 2: Crear el HTML**

```html
<div class="p-4 max-w-lg mx-auto">
  <h2 class="text-lg font-bold text-gray-800 mb-4">
    {{ isEdit ? 'Editar entrada' : 'Nueva entrada del coach' }}
  </h2>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Título *</label>
      <input
        formControlName="titulo"
        type="text"
        placeholder="Ej: Torneo provincial mayo 2026"
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
      <select
        formControlName="categoria"
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
      >
        <option value="noticia">Noticia</option>
        <option value="consejo_tecnico">Consejo técnico</option>
        <option value="aviso_torneo">Aviso torneo</option>
        <option value="equipamiento">Equipamiento</option>
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Contenido *</label>
      <textarea
        formControlName="contenido"
        rows="5"
        placeholder="Texto que el coach usará como contexto..."
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 resize-none"
      ></textarea>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Fecha de expiración (opcional)</label>
      <input
        formControlName="fechaExpiracion"
        type="date"
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
      />
    </div>

    <div class="flex items-center gap-3">
      <label class="text-sm font-medium text-gray-700">Activo</label>
      <input formControlName="activo" type="checkbox" class="w-4 h-4 accent-amber-400" />
    </div>

    <div class="flex gap-3 mt-2">
      <button
        type="submit"
        [disabled]="form.invalid || guardando"
        class="flex-1 bg-amber-400 text-white font-semibold py-2 rounded-lg disabled:opacity-40 hover:bg-amber-500 transition-colors"
      >
        {{ guardando ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear entrada') }}
      </button>
      <button
        type="button"
        (click)="cancelar()"
        class="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Cancelar
      </button>
    </div>

  </form>
</div>
```

- [ ] **Step 3: Commit**

```bash
rtk git add src/app/features/admin/coach/form-coach-contexto/
rtk git commit -m "feat(coach): add form-coach-contexto component"
```

---

### Task 6: Rutas admin

**Files:**
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Añadir las 3 rutas al final del array `adminRoutes`**

Antes del cierre `];` añadir:

```typescript
  // ── Coach contexto ───────────────────────────────────────────────────────
  {
    path: 'coach',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./coach/lista-coach-contexto/lista-coach-contexto.component')
        .then(m => m.ListaCoachContextoComponent),
  },
  {
    path: 'coach/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./coach/form-coach-contexto/form-coach-contexto.component')
        .then(m => m.FormCoachContextoComponent),
  },
  {
    path: 'coach/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./coach/form-coach-contexto/form-coach-contexto.component')
        .then(m => m.FormCoachContextoComponent),
  },
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/app/features/admin/admin.routes.ts
rtk git commit -m "feat(coach): add /admin/coach routes"
```

---

### Task 7: Card de acceso en home admin/moderador

**Files:**
- Modify: `src/app/features/home/home.component.html`
- Modify: `src/app/features/home/home.component.ts`

- [ ] **Step 1: Añadir método de navegación en home.component.ts**

En `HomeComponent` añadir el método:

```typescript
irCoachContexto(): void {
  this.router.navigate(['/admin/coach']);
}
```

- [ ] **Step 2: Localizar en home.component.html la sección admin**

Busca la línea con `<h3 class="home__section-label">Resumen del club</h3>` y añade la card de acceso rápido justo antes del cierre del bloque `@if (esAdmin())`, después de los últimos entrenamientos:

```html
    <!-- Card acceso rápido coach -->
    <h3 class="home__section-label home__section-label--mt">Asistente IA</h3>
    <button
      (click)="irCoachContexto()"
      class="home-coach-card card w-full text-left p-3 flex items-center gap-3 hover:bg-amber-50 transition-colors"
    >
      <div class="home-coach-card__icon">
        <i class="bi bi-robot text-amber-400 text-xl"></i>
      </div>
      <div>
        <p class="text-sm font-semibold text-gray-800">Contexto del Coach</p>
        <p class="text-xs text-gray-500">Gestiona el conocimiento del asistente</p>
      </div>
      <i class="bi bi-chevron-right text-gray-300 ml-auto"></i>
    </button>
```

- [ ] **Step 3: Commit**

```bash
rtk git add src/app/features/home/home.component.html src/app/features/home/home.component.ts
rtk git commit -m "feat(home): add coach-contexto quick access card for admin/moderador"
```

---

### Task 8: Edge function — inyectar coach_contexto en el prompt

**Files:**
- Modify: `supabase/functions/gemini-coach/index.ts`

- [ ] **Step 1: Añadir función helper para obtener contexto activo**

Justo antes de la función `construirPromptInforme`, añadir:

```typescript
async function obtenerContextoClub(supabaseAdmin: ReturnType<typeof createClient>): Promise<string> {
  const hoy = new Date().toISOString().split('T')[0]

  const { data } = await supabaseAdmin
    .from('coach_contexto')
    .select('titulo, contenido, categoria')
    .eq('activo', true)
    .or(`fecha_expiracion.is.null,fecha_expiracion.gte.${hoy}`)
    .order('created_at', { ascending: false })

  if (!data || data.length === 0) return ''

  // Máximo 3 por categoría
  const porCategoria = new Map<string, typeof data>()
  for (const row of data) {
    const cat = row.categoria as string
    if (!porCategoria.has(cat)) porCategoria.set(cat, [])
    const arr = porCategoria.get(cat)!
    if (arr.length < 3) arr.push(row)
  }

  const etiquetas: Record<string, string> = {
    noticia:         'NOTICIA',
    consejo_tecnico: 'CONSEJO TÉCNICO',
    aviso_torneo:    'AVISO TORNEO',
    equipamiento:    'EQUIPAMIENTO',
  }

  let bloque = '## CONTEXTO ACTUALIZADO DEL CLUB\n\n'
  for (const [cat, entradas] of porCategoria) {
    for (const e of entradas) {
      bloque += `[${etiquetas[cat] ?? cat.toUpperCase()}] ${e.titulo}\n${e.contenido}\n\n`
    }
  }
  return bloque
}
```

- [ ] **Step 2: Inyectar el contexto en modo `informe`**

En el bloque `if (modo === 'informe')`, cambiar:

```typescript
    if (modo === 'informe') {
      const { nombre, contexto } = body
      const prompt = construirPromptInforme(nombre, contexto)
      const respuesta = await llamarGroq(apiKey, [
        { role: 'user', content: prompt }
      ])
```

Por:

```typescript
    if (modo === 'informe') {
      const { nombre, contexto } = body
      const contextoClub = await obtenerContextoClub(supabaseAdmin)
      const prompt = construirPromptInforme(nombre, contexto)
      const promptFinal = contextoClub ? `${contextoClub}\n---\n${prompt}` : prompt
      const respuesta = await llamarGroq(apiKey, [
        { role: 'user', content: promptFinal }
      ])
```

- [ ] **Step 3: Inyectar el contexto en modo `chat`**

En el bloque `if (modo === 'chat')`, cambiar:

```typescript
      const messages = [
        { role: 'user', content: `Contexto del análisis previo del tirador:\n\n${informeResumen}\n\nA partir de ahora responde a sus preguntas usando este contexto.` },
```

Por:

```typescript
      const contextoClub = await obtenerContextoClub(supabaseAdmin)
      const contextoCompleto = contextoClub
        ? `${contextoClub}\n---\nContexto del análisis previo del tirador:\n\n${informeResumen}`
        : `Contexto del análisis previo del tirador:\n\n${informeResumen}`

      const messages = [
        { role: 'user', content: `${contextoCompleto}\n\nA partir de ahora responde a sus preguntas usando este contexto.` },
```

- [ ] **Step 4: Redesplegar la edge function**

```bash
supabase functions deploy gemini-coach
```

- [ ] **Step 5: Commit**

```bash
rtk git add supabase/functions/gemini-coach/index.ts
rtk git commit -m "feat(coach): inject coach_contexto into prompt for informe and chat modes"
```

---

### Task 9: Verificación manual

- [ ] Abrir la app como admin → home → ver card "Contexto del Coach"
- [ ] Navegar a `/admin/coach` → lista vacía
- [ ] Crear una entrada de tipo "Aviso torneo" con fecha de expiración futura → aparece en lista con badge naranja
- [ ] Crear una entrada de tipo "Consejo técnico" sin fecha → aparece en lista con badge verde
- [ ] Desactivar una entrada → el toggle cambia a gris
- [ ] Editar una entrada → formulario precargado, guardar vuelve a lista
- [ ] Eliminar una entrada → confirm dialog, desaparece de lista
- [ ] Como socio, pedir un nuevo informe al coach → verificar que el informe menciona el contexto añadido
- [ ] Hacer una pregunta en el chat del coach → verificar que usa el contexto del club
