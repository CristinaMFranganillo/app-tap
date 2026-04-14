# Escuadras de Entrenamiento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desacoplar escuadras de competiciones para que funcionen como entrenamiento independiente con fecha, número autonumérico por día y registro de platos totales por tirador.

**Architecture:** Se hace `competicion_id` nullable en `escuadras` y se añaden `fecha` y `creado_por`. Nueva tabla `resultados_entrenamiento` con platos totales por tirador. El `EscuadraService` se extiende con métodos para entrenamientos. Se adapta `form-escuadra`, se crean `lista-escuadras` y `registrar-resultado-entrenamiento`, y el perfil pasa a usar `resultados_entrenamiento`.

**Tech Stack:** Angular 19 (signals, standalone), Supabase (Postgres + RLS), TypeScript.

---

## Estructura de archivos

| Acción | Archivo |
|---|---|
| Crear | `supabase/migrations/005_escuadras_entrenamiento.sql` |
| Modificar | `src/app/core/models/escuadra.model.ts` |
| Modificar | `src/app/features/scores/escuadra.service.ts` |
| Modificar | `src/app/features/admin/scores/form-escuadra/form-escuadra.component.ts` |
| Modificar | `src/app/features/admin/scores/form-escuadra/form-escuadra.component.html` |
| Crear | `src/app/features/admin/scores/lista-escuadras/lista-escuadras.component.ts` |
| Crear | `src/app/features/admin/scores/lista-escuadras/lista-escuadras.component.html` |
| Crear | `src/app/features/admin/scores/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts` |
| Crear | `src/app/features/admin/scores/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html` |
| Modificar | `src/app/features/admin/admin.routes.ts` |
| Modificar | `src/app/features/perfil/perfil.component.ts` |
| Modificar | `src/app/features/perfil/perfil.component.html` |

---

### Task 1: Migración BD — desacoplar escuadras y añadir resultados_entrenamiento

**Files:**
- Create: `supabase/migrations/005_escuadras_entrenamiento.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/005_escuadras_entrenamiento.sql

-- 1. Desacoplar escuadras de competiciones
ALTER TABLE escuadras ALTER COLUMN competicion_id DROP NOT NULL;
ALTER TABLE escuadras ADD COLUMN IF NOT EXISTS fecha date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE escuadras ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES profiles(id);

-- 2. Tabla de resultados de entrenamiento (platos totales por tirador)
CREATE TABLE IF NOT EXISTS resultados_entrenamiento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id    uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id),
  puesto         int NOT NULL CHECK (puesto BETWEEN 1 AND 6),
  platos_rotos   int NOT NULL DEFAULT 0,
  registrado_por uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(escuadra_id, user_id)
);

-- 3. RLS para resultados_entrenamiento
ALTER TABLE resultados_entrenamiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "re_select" ON resultados_entrenamiento FOR SELECT TO authenticated USING (true);
CREATE POLICY "re_insert" ON resultados_entrenamiento FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "re_update" ON resultados_entrenamiento FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "re_delete" ON resultados_entrenamiento FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
```

- [ ] **Step 2: Aplicar la migración**

Usar MCP tool `mcp__supabase__apply_migration` con name `escuadras_entrenamiento` y el SQL anterior.

- [ ] **Step 3: Verificar**

Usar MCP tool `mcp__supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'escuadras' ORDER BY ordinal_position;
```
Esperado: columnas `id`, `competicion_id` (nullable), `numero`, `fecha`, `creado_por`.

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'resultados_entrenamiento';
```
Esperado: 1 fila.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_escuadras_entrenamiento.sql
git commit -m "feat: add escuadras_entrenamiento migration"
```

---

### Task 2: Actualizar modelo y EscuadraService

**Files:**
- Modify: `src/app/core/models/escuadra.model.ts`
- Modify: `src/app/features/scores/escuadra.service.ts`

- [ ] **Step 1: Actualizar el modelo**

Reemplazar `src/app/core/models/escuadra.model.ts`:

```typescript
export interface Escuadra {
  id: string;
  competicionId?: string;   // undefined = entrenamiento
  fecha: string;            // YYYY-MM-DD
  numero: number;
  creadoPor?: string;
  tiradores?: EscuadraTirador[];
}

export interface EscuadraTirador {
  id: string;
  escuadraId: string;
  userId: string;
  puesto: number;
}

export interface ResultadoEntrenamiento {
  id: string;
  escuadraId: string;
  userId: string;
  puesto: number;
  platosRotos: number;
}
```

- [ ] **Step 2: Actualizar EscuadraService**

Reemplazar `src/app/features/scores/escuadra.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Escuadra, EscuadraTirador, ResultadoEntrenamiento } from '../../core/models/escuadra.model';
import { supabase } from '../../core/supabase/supabase.client';

function toEscuadra(row: Record<string, unknown>): Escuadra {
  return {
    id: row['id'] as string,
    competicionId: (row['competicion_id'] as string) ?? undefined,
    fecha: row['fecha'] as string,
    numero: row['numero'] as number,
    creadoPor: (row['creado_por'] as string) ?? undefined,
  };
}

function toEscuadraTirador(row: Record<string, unknown>): EscuadraTirador {
  return {
    id: row['id'] as string,
    escuadraId: row['escuadra_id'] as string,
    userId: row['user_id'] as string,
    puesto: row['puesto'] as number,
  };
}

function toResultadoEntrenamiento(row: Record<string, unknown>): ResultadoEntrenamiento {
  return {
    id: row['id'] as string,
    escuadraId: row['escuadra_id'] as string,
    userId: row['user_id'] as string,
    puesto: row['puesto'] as number,
    platosRotos: row['platos_rotos'] as number,
  };
}

@Injectable({ providedIn: 'root' })
export class EscuadraService {
  // ── Escuadras de competición (existente) ──────────────────────────────────

  getByCompeticion(competicionId: string): Observable<Escuadra[]> {
    return from(
      supabase.from('escuadras').select('*').eq('competicion_id', competicionId).order('numero')
    ).pipe(map(({ data }) => (data ?? []).map(toEscuadra)));
  }

  async createEscuadra(competicionId: string, numero: number): Promise<string> {
    const { data, error } = await supabase
      .from('escuadras')
      .insert({ competicion_id: competicionId, numero, fecha: new Date().toISOString().split('T')[0] })
      .select('id')
      .single();
    if (error || !data) throw new Error('Error creando escuadra');
    return (data as Record<string, unknown>)['id'] as string;
  }

  // ── Escuadras de entrenamiento ────────────────────────────────────────────

  getAllEntrenamientos(): Observable<Escuadra[]> {
    return from(
      supabase
        .from('escuadras')
        .select('*')
        .is('competicion_id', null)
        .order('fecha', { ascending: false })
        .order('numero', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toEscuadra)));
  }

  async getNumeroSiguiente(fecha: string): Promise<number> {
    const { data } = await supabase
      .from('escuadras')
      .select('numero')
      .is('competicion_id', null)
      .eq('fecha', fecha);
    const nums = (data ?? []).map((r: Record<string, unknown>) => r['numero'] as number);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }

  async createEntrenamiento(fecha: string, creadoPor: string): Promise<string> {
    const numero = await this.getNumeroSiguiente(fecha);
    const { data, error } = await supabase
      .from('escuadras')
      .insert({ competicion_id: null, fecha, numero, creado_por: creadoPor })
      .select('id')
      .single();
    if (error || !data) throw new Error('Error creando escuadra de entrenamiento');
    return (data as Record<string, unknown>)['id'] as string;
  }

  // ── Tiradores ─────────────────────────────────────────────────────────────

  getTiradoresByEscuadra(escuadraId: string): Observable<EscuadraTirador[]> {
    return from(
      supabase.from('escuadra_tiradores').select('*').eq('escuadra_id', escuadraId).order('puesto')
    ).pipe(map(({ data }) => (data ?? []).map(toEscuadraTirador)));
  }

  async addTirador(escuadraId: string, userId: string, puesto: number): Promise<void> {
    const { error } = await supabase
      .from('escuadra_tiradores')
      .insert({ escuadra_id: escuadraId, user_id: userId, puesto });
    if (error) throw new Error('Error añadiendo tirador');
  }

  async removeTirador(id: string): Promise<void> {
    await supabase.from('escuadra_tiradores').delete().eq('id', id);
  }

  async deleteEscuadra(id: string): Promise<void> {
    await supabase.from('escuadras').delete().eq('id', id);
  }

  // ── Resultados de entrenamiento ───────────────────────────────────────────

  getResultadosByEscuadra(escuadraId: string): Observable<ResultadoEntrenamiento[]> {
    return from(
      supabase.from('resultados_entrenamiento').select('*').eq('escuadra_id', escuadraId)
    ).pipe(map(({ data }) => (data ?? []).map(toResultadoEntrenamiento)));
  }

  getResultadosByUser(userId: string): Observable<ResultadoEntrenamiento[]> {
    return from(
      supabase
        .from('resultados_entrenamiento')
        .select('*, escuadras(fecha, numero)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toResultadoEntrenamiento)));
  }

  async upsertResultado(data: {
    escuadraId: string;
    userId: string;
    puesto: number;
    platosRotos: number;
    registradoPor: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('resultados_entrenamiento')
      .upsert({
        escuadra_id: data.escuadraId,
        user_id: data.userId,
        puesto: data.puesto,
        platos_rotos: data.platosRotos,
        registrado_por: data.registradoPor,
      }, { onConflict: 'escuadra_id,user_id' });
    if (error) throw new Error('Error guardando resultado');
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/escuadra.model.ts src/app/features/scores/escuadra.service.ts
git commit -m "feat: update escuadra model and service for entrenamiento"
```

---

### Task 3: Adaptar form-escuadra para entrenamientos

**Files:**
- Modify: `src/app/features/admin/scores/form-escuadra/form-escuadra.component.ts`
- Modify: `src/app/features/admin/scores/form-escuadra/form-escuadra.component.html`

- [ ] **Step 1: Actualizar el componente**

Reemplazar `src/app/features/admin/scores/form-escuadra/form-escuadra.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { EscuadraService } from '../../../scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-escuadra',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-escuadra.component.html',
})
export class FormEscuadraComponent {
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private auth = inject(AuthService);
  private router = inject(Router);

  socios = toSignal(this.userService.getAll(), { initialValue: [] as User[] });

  fecha = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  puestos: (string | null)[] = [null, null, null, null, null, null];
  loading = signal(false);
  error = signal('');

  async onSubmit(): Promise<void> {
    const asignados = this.puestos.filter(p => p !== null);
    if (asignados.length === 0) { this.error.set('Asigna al menos un tirador'); return; }
    this.loading.set(true);
    this.error.set('');
    try {
      const creadoPor = this.auth.currentUser?.id ?? '';
      const escuadraId = await this.escuadraService.createEntrenamiento(this.fecha, creadoPor);
      for (let i = 0; i < this.puestos.length; i++) {
        const userId = this.puestos[i];
        if (userId) {
          await this.escuadraService.addTirador(escuadraId, userId, i + 1);
        }
      }
      this.router.navigate(['/admin/escuadras']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      this.loading.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/escuadras']);
  }
}
```

- [ ] **Step 2: Actualizar el template**

Reemplazar `src/app/features/admin/scores/form-escuadra/form-escuadra.component.html`:

```html
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-400">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h2 class="text-[11px] font-bold text-brand-dark">Nueva Escuadra</h2>
  </div>

  <label class="block text-[7.5px] font-bold text-brand-dark uppercase tracking-wide mb-1">Fecha</label>
  <input
    type="date"
    [(ngModel)]="fecha"
    class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm mb-4"
  />

  <p class="text-[8px] font-bold text-brand-dark uppercase tracking-wide mb-2">Tiradores por puesto</p>

  @for (puesto of puestos; track $index) {
    <div class="mb-2">
      <label class="block text-[7.5px] font-bold text-brand-dark uppercase tracking-wide mb-1">Puesto {{ $index + 1 }}</label>
      <select
        [(ngModel)]="puestos[$index]"
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm"
      >
        <option [value]="null">— Sin asignar —</option>
        @for (s of socios(); track s.id) {
          <option [value]="s.id">{{ s.nombre }} {{ s.apellidos }} (#{{ s.numeroSocio }})</option>
        }
      </select>
    </div>
  }

  @if (error()) {
    <p class="text-danger text-[9px] font-semibold mt-3">{{ error() }}</p>
  }

  <div class="flex gap-2 mt-4">
    <button (click)="cancel()" class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400">
      Cancelar
    </button>
    <button
      (click)="onSubmit()"
      [disabled]="loading()"
      class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50"
    >
      {{ loading() ? 'Guardando...' : 'Crear escuadra' }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/scores/form-escuadra/
git commit -m "feat: adapt form-escuadra for entrenamiento (no competicion)"
```

---

### Task 4: Crear lista-escuadras

**Files:**
- Create: `src/app/features/admin/scores/lista-escuadras/lista-escuadras.component.ts`
- Create: `src/app/features/admin/scores/lista-escuadras/lista-escuadras.component.html`

- [ ] **Step 1: Crear el componente**

Crear `src/app/features/admin/scores/lista-escuadras/lista-escuadras.component.ts`:

```typescript
import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { EscuadraService } from '../../../scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { Escuadra } from '../../../../core/models/escuadra.model';

interface EscuadraGroup {
  fecha: string;
  label: string;
  escuadras: Escuadra[];
}

@Component({
  selector: 'app-lista-escuadras',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './lista-escuadras.component.html',
})
export class ListaEscuadrasComponent {
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private router = inject(Router);

  private _socios = toSignal(this.userService.getAll(), { initialValue: [] });
  escuadras = toSignal(this.escuadraService.getAllEntrenamientos(), { initialValue: [] as Escuadra[] });

  groups = computed<EscuadraGroup[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const map = new Map<string, Escuadra[]>();
    for (const e of this.escuadras()) {
      const list = map.get(e.fecha) ?? [];
      list.push(e);
      map.set(e.fecha, list);
    }
    return Array.from(map.entries()).map(([fecha, escuadras]) => ({
      fecha,
      label: fecha === today ? 'Hoy' : fecha === yesterday ? 'Ayer' : fecha,
      escuadras,
    }));
  });

  getTiradoresCount(e: Escuadra): number {
    return e.tiradores?.length ?? 0;
  }

  nueva(): void {
    this.router.navigate(['/admin/escuadras/nueva']);
  }

  registrar(id: string): void {
    this.router.navigate(['/admin/escuadras', id, 'resultados']);
  }
}
```

- [ ] **Step 2: Crear el template**

Crear `src/app/features/admin/scores/lista-escuadras/lista-escuadras.component.html`:

```html
<div class="p-3 pb-20">
  <h2 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-4">Escuadras</h2>

  @if (groups().length === 0) {
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <i class="bi bi-people text-[40px] text-gray-200 mb-2"></i>
      <p class="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Sin escuadras</p>
      <p class="text-[8px] text-gray-300 mt-1">Crea la primera usando el botón</p>
    </div>
  }

  @for (group of groups(); track group.fecha) {
    <p class="text-[7.5px] font-bold text-brand-dark uppercase tracking-wide mb-2 mt-3">{{ group.label }}</p>
    @for (e of group.escuadras; track e.id) {
      <div class="bg-white rounded-[12px] px-3 py-2.5 mb-2 shadow-sm flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
          <span class="text-[10px] font-black text-brand-dark">{{ e.numero }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[9.5px] font-bold text-brand-dark">Escuadra {{ e.numero }}</p>
          <p class="text-[7.5px] text-gray-400 font-medium">{{ e.fecha | date:'d MMM yyyy' : '' : 'es' }}</p>
        </div>
        <button
          (click)="registrar(e.id)"
          class="flex-shrink-0 px-3 py-1.5 bg-brand-yellow rounded-[10px] text-[8px] font-bold text-brand-dark"
        >
          Resultados
        </button>
      </div>
    }
  }

  <!-- FAB -->
  <button
    (click)="nueva()"
    class="fixed bottom-20 right-4 w-12 h-12 bg-brand-yellow rounded-full shadow-lg flex items-center justify-center"
  >
    <i class="bi bi-plus text-brand-dark text-[22px]"></i>
  </button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/scores/lista-escuadras/
git commit -m "feat: add lista-escuadras component"
```

---

### Task 5: Crear registrar-resultado-entrenamiento

**Files:**
- Create: `src/app/features/admin/scores/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts`
- Create: `src/app/features/admin/scores/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html`

- [ ] **Step 1: Crear el componente**

Crear `src/app/features/admin/scores/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { EscuadraService } from '../../../scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { EscuadraTirador } from '../../../../core/models/escuadra.model';

interface PuestoResultado {
  tirador: EscuadraTirador;
  nombre: string;
  platosRotos: number;
}

@Component({
  selector: 'app-registrar-resultado-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registrar-resultado-entrenamiento.component.html',
})
export class RegistrarResultadoEntrenamientoComponent {
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private escuadraId = this.route.snapshot.paramMap.get('id') ?? '';
  private _socios = toSignal(this.userService.getAll(), { initialValue: [] });

  tiradores = toSignal(
    this.escuadraService.getTiradoresByEscuadra(this.escuadraId),
    { initialValue: [] as EscuadraTirador[] }
  );

  puestosResultado = signal<PuestoResultado[]>([]);
  saving = signal(false);
  error = signal('');
  saved = signal(false);

  constructor() {
    // Inicializar puestosResultado cuando lleguen los tiradores
    const interval = setInterval(() => {
      const tiradores = this.tiradores();
      if (tiradores.length > 0) {
        clearInterval(interval);
        this.puestosResultado.set(
          tiradores.map(t => ({
            tirador: t,
            nombre: this.getNombre(t.userId),
            platosRotos: 0,
          }))
        );
      }
    }, 100);
  }

  getNombre(userId: string): string {
    const u = this.userService.getById(userId);
    return u ? `${u.nombre} ${u.apellidos}` : '—';
  }

  async guardar(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const registradoPor = this.auth.currentUser?.id ?? '';
      for (const pr of this.puestosResultado()) {
        await this.escuadraService.upsertResultado({
          escuadraId: this.escuadraId,
          userId: pr.tirador.userId,
          puesto: pr.tirador.puesto,
          platosRotos: pr.platosRotos,
          registradoPor,
        });
      }
      this.saved.set(true);
      setTimeout(() => this.router.navigate(['/admin/escuadras']), 800);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/escuadras']);
  }
}
```

- [ ] **Step 2: Crear el template**

Crear `src/app/features/admin/scores/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html`:

```html
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-400">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h2 class="text-[11px] font-bold text-brand-dark">Registrar Resultados</h2>
  </div>

  @if (puestosResultado().length === 0) {
    <p class="text-[9px] text-gray-400 text-center py-8">Cargando tiradores...</p>
  }

  <div class="flex flex-col gap-3">
    @for (pr of puestosResultado(); track pr.tirador.id) {
      <div class="bg-white rounded-[12px] px-3 py-2.5 shadow-sm flex items-center gap-3">
        <div class="w-7 h-7 rounded-full bg-surface flex items-center justify-center flex-shrink-0">
          <span class="text-[9px] font-black text-brand-dark">{{ pr.tirador.puesto }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[9.5px] font-bold text-brand-dark truncate">{{ pr.nombre }}</p>
          <p class="text-[7.5px] text-gray-400">Puesto {{ pr.tirador.puesto }}</p>
        </div>
        <input
          type="number"
          min="0"
          max="25"
          [(ngModel)]="pr.platosRotos"
          class="w-14 bg-surface rounded-[10px] px-2 py-1.5 text-[11px] font-black text-brand-dark text-center outline-none"
        />
      </div>
    }
  </div>

  @if (error()) {
    <p class="text-danger text-[9px] font-semibold mt-3">{{ error() }}</p>
  }

  @if (saved()) {
    <p class="text-success text-[9px] font-semibold mt-3 text-center">¡Resultados guardados!</p>
  }

  <div class="flex gap-2 mt-4">
    <button (click)="cancel()" class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400">
      Cancelar
    </button>
    <button
      (click)="guardar()"
      [disabled]="saving() || puestosResultado().length === 0"
      class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50"
    >
      {{ saving() ? 'Guardando...' : 'Guardar resultados' }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/scores/registrar-resultado-entrenamiento/
git commit -m "feat: add registrar-resultado-entrenamiento component"
```

---

### Task 6: Actualizar rutas admin

**Files:**
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Añadir rutas de escuadras**

Reemplazar `src/app/features/admin/admin.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

export const adminRoutes: Routes = [
  // Socios
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
  // Noticias
  {
    path: 'noticias',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/lista-noticias-admin/lista-noticias-admin.component').then(m => m.ListaNoticiasAdminComponent),
  },
  {
    path: 'noticias/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  {
    path: 'noticias/:id/editar',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  // Scores — panel principal (competiciones)
  {
    path: 'scores',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/admin-scores/admin-scores.component').then(m => m.AdminScoresComponent),
  },
  {
    path: 'scores/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/form-score/form-score.component').then(m => m.FormScoreComponent),
  },
  // Competiciones
  {
    path: 'competiciones/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./competiciones/form-competicion/form-competicion.component').then(m => m.FormCompeticionComponent),
  },
  // Scores — registrar resultados competicion
  {
    path: 'scores/resultados',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/registrar-resultado/registrar-resultado.component').then(m => m.RegistrarResultadoComponent),
  },
  // Escuadras de entrenamiento
  {
    path: 'escuadras',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/lista-escuadras/lista-escuadras.component').then(m => m.ListaEscuadrasComponent),
  },
  {
    path: 'escuadras/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/form-escuadra/form-escuadra.component').then(m => m.FormEscuadraComponent),
  },
  {
    path: 'escuadras/:id/resultados',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component').then(m => m.RegistrarResultadoEntrenamientoComponent),
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/admin.routes.ts
git commit -m "feat: add escuadras routes to admin"
```

---

### Task 7: Añadir Escuadras al bottom-nav admin

**Files:**
- Modify: `src/app/shared/components/bottom-nav/bottom-nav.component.ts`

- [ ] **Step 1: Actualizar ADMIN_NAV**

En `src/app/shared/components/bottom-nav/bottom-nav.component.ts`, reemplazar `ADMIN_NAV`:

```typescript
const ADMIN_NAV: NavItem[] = [
  { route: '/admin/socios',    icon: 'bi-people-fill', label: 'Socios'    },
  { route: '/admin/noticias',  icon: 'bi-newspaper',   label: 'Noticias'  },
  { route: '/admin/escuadras', icon: 'bi-bullseye',    label: 'Escuadras' },
  { route: '/admin/scores',    icon: 'bi-trophy',      label: 'Torneos'   },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shared/components/bottom-nav/bottom-nav.component.ts
git commit -m "feat: add escuadras to admin bottom-nav"
```

---

### Task 8: Actualizar Perfil para usar resultados_entrenamiento

**Files:**
- Modify: `src/app/features/perfil/perfil.component.ts`
- Modify: `src/app/features/perfil/perfil.component.html`

- [ ] **Step 1: Actualizar el componente**

Reemplazar `src/app/features/perfil/perfil.component.ts`:

```typescript
import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { EscuadraService } from '../scores/escuadra.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ResultadoEntrenamiento } from '../../core/models/escuadra.model';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [AvatarComponent, DatePipe, EmptyStateComponent],
  templateUrl: './perfil.component.html',
})
export class PerfilComponent {
  private authService = inject(AuthService);
  private escuadraService = inject(EscuadraService);
  private router = inject(Router);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  resultados = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => this.escuadraService.getResultadosByUser(u?.id ?? ''))
    ),
    { initialValue: [] as ResultadoEntrenamiento[] }
  );

  totalEscuadras = computed(() => this.resultados().length);

  mediaPlatos = computed(() => {
    const list = this.resultados();
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, r) => acc + r.platosRotos, 0);
    return Math.round(sum / list.length);
  });

  mejorResultado = computed(() => {
    const list = this.resultados();
    if (list.length === 0) return 0;
    return Math.max(...list.map(r => r.platosRotos));
  });

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Actualizar el template**

Reemplazar `src/app/features/perfil/perfil.component.html`:

```html
<div>
  <!-- Hero -->
  <div class="bg-brand-dark px-4 pt-4 pb-6 flex flex-col items-center">
    <app-avatar
      [nombre]="user()?.nombre ?? ''"
      [apellidos]="user()?.apellidos ?? ''"
      [avatarUrl]="user()?.avatarUrl"
      [size]="64"
    />
    <h2 class="text-white font-bold text-[13px] mt-2">
      {{ user()?.nombre }} {{ user()?.apellidos }}
    </h2>
    <p class="text-brand-yellow font-bold text-[8px] uppercase tracking-wider">
      {{ user()?.rol }} · #{{ user()?.numeroSocio }}
    </p>
  </div>

  <!-- Stats -->
  <div class="flex mx-3 -mt-4 bg-white rounded-[14px] shadow-sm overflow-hidden">
    <div class="flex-1 flex flex-col items-center py-3 border-r border-gray-100">
      <p class="text-[17px] font-black text-brand-dark">{{ totalEscuadras() }}</p>
      <p class="text-[7px] font-bold text-gray-300 uppercase tracking-wide">Escuadras</p>
    </div>
    <div class="flex-1 flex flex-col items-center py-3 border-r border-gray-100">
      <p class="text-[17px] font-black text-brand-dark">{{ mediaPlatos() }}</p>
      <p class="text-[7px] font-bold text-gray-300 uppercase tracking-wide">Media platos</p>
    </div>
    <div class="flex-1 flex flex-col items-center py-3">
      <p class="text-[17px] font-black text-brand-dark">{{ mejorResultado() }}</p>
      <p class="text-[7px] font-bold text-gray-300 uppercase tracking-wide">Mejor</p>
    </div>
  </div>

  <!-- Historial -->
  <div class="p-3 mt-2">
    <h3 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-2">Mis Entrenamientos</h3>

    @if (resultados().length === 0) {
      <app-empty-state icon="bi-bullseye" mensaje="Sin entrenamientos registrados" />
    } @else {
      @for (r of resultados(); track r.id) {
        <div class="bg-white rounded-[12px] px-3 py-2.5 mb-2 shadow-sm flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-[9.5px] font-bold text-brand-dark">Escuadra {{ r.escuadraId.slice(0, 6) }}</p>
            <p class="text-[7.5px] text-gray-300 font-medium">Puesto {{ r.puesto }}</p>
          </div>
          <div class="text-right">
            <p class="text-[13px] font-black text-brand-dark">
              {{ r.platosRotos }}<span class="text-[8px] text-gray-300 font-semibold">/25</span>
            </p>
          </div>
        </div>
      }
    }
  </div>

  <!-- Logout -->
  <div class="px-3 pb-4">
    <button
      (click)="logout()"
      class="w-full py-2.5 rounded-[12px] border border-danger text-danger text-[9px] font-bold"
    >
      <i class="bi bi-box-arrow-right mr-1"></i>
      Cerrar sesión
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/
git commit -m "feat: perfil uses resultados_entrenamiento for historial"
```
