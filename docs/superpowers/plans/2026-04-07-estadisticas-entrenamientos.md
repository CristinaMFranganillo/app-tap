# Estadísticas y Historial de Entrenamientos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar al socio su historial y estadísticas de entrenamientos: evolución anual, posición en el club, y línea de tiempo unificada con competiciones.

**Architecture:** Se añaden dos métodos a `EntrenamientoService` (`getByUser` y `getRankingAnual`). El perfil recibe una nueva sección "Mis Entrenamientos" con stats + gráfico SVG + posición en el club. El historial de scores se convierte en línea de tiempo unificada (entrenamientos + competiciones juntos, marcados con etiqueta). Sin cambios de BD.

**Tech Stack:** Angular 17+ standalone · signals · computed · Tailwind CSS · SCSS BEM · SVG puro (sin librerías de gráficos) · Supabase

---

## File Map

### Modificar
- `src/app/features/admin/entrenamientos/entrenamiento.service.ts` — añadir `getByUser(userId, year)` y `getRankingAnual(year)`
- `src/app/features/perfil/perfil.component.ts` — añadir señales de entrenamientos, stats y posición en el club
- `src/app/features/perfil/perfil.component.html` — añadir sección "Mis Entrenamientos" con stats + gráfico + posición
- `src/app/features/perfil/perfil.component.scss` — estilos nuevos para sección entrenamientos
- `src/app/features/scores/historial/scores-historial.component.ts` — línea de tiempo unificada
- `src/app/features/scores/historial/scores-historial.component.html` — mostrar entrenamientos + competiciones con etiquetas
- `src/app/features/scores/historial/scores-historial.component.scss` — estilos etiquetas y línea de tiempo

---

## Task 1: Nuevos métodos en EntrenamientoService

**Files:**
- Modify: `src/app/features/admin/entrenamientos/entrenamiento.service.ts`

Los dos métodos nuevos consultan `resultados_entrenamiento` JOIN `escuadras` JOIN `entrenamientos` para obtener resultados del usuario con fecha. El JOIN es necesario porque `resultados_entrenamiento` no tiene fecha directa — la fecha está en `entrenamientos` a través de `escuadras.entrenamiento_id`.

- [ ] **Step 1: Añadir interfaz `ResultadoEntrenamientoConFecha` al modelo**

Añadir al final de `src/app/core/models/entrenamiento.model.ts`:

```typescript
export interface ResultadoEntrenamientoConFecha {
  id: string;
  escuadraId: string;
  entrenamientoId: string;
  userId: string;
  puesto: number;
  platosRotos: number;
  fecha: string;  // YYYY-MM-DD, de entrenamientos.fecha
}

export interface RankingEntrenamientoAnual {
  userId: string;
  mediaPlatos: number;
  totalEntrenamientos: number;
  mejorResultado: number;
}
```

- [ ] **Step 2: Añadir `getByUser` en EntrenamientoService**

Añadir antes del cierre de clase en `entrenamiento.service.ts`:

```typescript
  getByUser(userId: string, year: number): Observable<ResultadoEntrenamientoConFecha[]> {
    const from_ = `${year}-01-01`;
    const to_ = `${year}-12-31`;
    return from(
      supabase
        .from('resultados_entrenamiento')
        .select('*, escuadras!inner(entrenamiento_id, entrenamientos!inner(fecha))')
        .eq('user_id', userId)
        .gte('escuadras.entrenamientos.fecha', from_)
        .lte('escuadras.entrenamientos.fecha', to_)
        .order('escuadras(entrenamientos(fecha))', { ascending: false })
    ).pipe(
      map(({ data }) =>
        (data ?? []).map((row: any) => ({
          id: row['id'] as string,
          escuadraId: row['escuadra_id'] as string,
          entrenamientoId: row['escuadras']['entrenamiento_id'] as string,
          userId: row['user_id'] as string,
          puesto: row['puesto'] as number,
          platosRotos: row['platos_rotos'] as number,
          fecha: row['escuadras']['entrenamientos']['fecha'] as string,
        }))
      )
    );
  }
```

> **Nota:** El import de `from` de rxjs ya existe en el archivo como variable (`from`). Supabase usa el mismo nombre — el import de rxjs está como `from` en la línea 2. Asegúrate de que no haya conflicto: el `from(supabase...)` ya funciona así en los métodos existentes.

- [ ] **Step 3: Añadir `getRankingAnual` en EntrenamientoService**

Añadir después de `getByUser`, antes del cierre de clase:

```typescript
  getRankingAnual(year: number): Observable<RankingEntrenamientoAnual[]> {
    const from_ = `${year}-01-01`;
    const to_ = `${year}-12-31`;
    return from(
      supabase
        .from('resultados_entrenamiento')
        .select('user_id, platos_rotos, escuadras!inner(entrenamientos!inner(fecha))')
        .gte('escuadras.entrenamientos.fecha', from_)
        .lte('escuadras.entrenamientos.fecha', to_)
    ).pipe(
      map(({ data }) => {
        const map = new Map<string, { suma: number; count: number; mejor: number }>();
        for (const row of (data ?? []) as any[]) {
          const uid = row['user_id'] as string;
          const platos = row['platos_rotos'] as number;
          if (!map.has(uid)) map.set(uid, { suma: 0, count: 0, mejor: 0 });
          const entry = map.get(uid)!;
          entry.suma += platos;
          entry.count += 1;
          if (platos > entry.mejor) entry.mejor = platos;
        }
        return Array.from(map.entries()).map(([userId, v]) => ({
          userId,
          mediaPlatos: Math.round((v.suma / v.count) * 10) / 10,
          totalEntrenamientos: v.count,
          mejorResultado: v.mejor,
        })).sort((a, b) => b.mediaPlatos - a.mediaPlatos);
      })
    );
  }
```

- [ ] **Step 4: Añadir imports al modelo**

Verificar que `src/app/core/models/entrenamiento.model.ts` exporta `ResultadoEntrenamientoConFecha` y `RankingEntrenamientoAnual`. Si ya tiene otras exports, añadir al final del archivo sin borrar nada.

- [ ] **Step 5: Verificar compilación**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx tsc --noEmit 2>&1 | grep "entrenamiento"
```

Expected: sin salida (sin errores en archivos de entrenamiento).

- [ ] **Step 6: Commit**

```bash
git add src/app/core/models/entrenamiento.model.ts
git add src/app/features/admin/entrenamientos/entrenamiento.service.ts
git commit -m "feat: add getByUser and getRankingAnual to EntrenamientoService"
```

---

## Task 2: Sección "Mis Entrenamientos" en PerfilComponent (TS)

**Files:**
- Modify: `src/app/features/perfil/perfil.component.ts`

- [ ] **Step 1: Reemplazar el contenido del TS**

```typescript
// src/app/features/perfil/perfil.component.ts
import { Component, inject, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ScoreService } from '../scores/score.service';
import { CompeticionService } from '../scores/competicion.service';
import { EntrenamientoService } from '../admin/entrenamientos/entrenamiento.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { Score } from '../../core/models/score.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [AvatarComponent, DatePipe, EmptyStateComponent],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {
  private authService = inject(AuthService);
  private scoreService = inject(ScoreService);
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);
  private router = inject(Router);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  // ── Año seleccionado ───────────────────────────────────────────
  anioActual = new Date().getFullYear();
  anioSeleccionado = signal(this.anioActual);
  anios = Array.from({ length: 3 }, (_, i) => this.anioActual - i); // [2026, 2025, 2024]

  // ── Competiciones (stats legacy) ──────────────────────────────
  scores = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => this.scoreService.getByUser(u?.id ?? ''))
    ),
    { initialValue: [] as Score[] }
  );

  totalCompeticiones = computed(() => new Set(this.scores().map(s => s.competicionId)).size);

  mediaPlatos = computed(() => {
    const list = this.scores();
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, s) => acc + s.platosRotos, 0);
    return Math.round(sum / list.length);
  });

  podios = computed(() => this.scores().filter(s => s.platosRotos >= 20).length);

  getCompeticionNombre(competicionId: string): string {
    return this.competicionService.getById(competicionId)?.nombre ?? 'Competición';
  }

  getCompeticionTotal(competicionId: string): number {
    const c = this.competicionService.getById(competicionId);
    return c ? c.platosPorSerie * c.numSeries : 25;
  }

  // ── Entrenamientos del año ─────────────────────────────────────
  misEntrenamientos = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u =>
        this.entrenamientoService.getByUser(u?.id ?? '', this.anioSeleccionado())
      )
    ),
    { initialValue: [] }
  );

  rankingAnual = toSignal(
    this.entrenamientoService.getRankingAnual(this.anioSeleccionado()),
    { initialValue: [] }
  );

  // Stats de entrenamientos
  totalEntrenamientos = computed(() => this.misEntrenamientos().length);

  mediaEntrenamientos = computed(() => {
    const list = this.misEntrenamientos();
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, r) => acc + r.platosRotos, 0);
    return Math.round((sum / list.length) * 10) / 10;
  });

  mejorResultado = computed(() =>
    this.misEntrenamientos().reduce((max, r) => Math.max(max, r.platosRotos), 0)
  );

  posicionClub = computed(() => {
    const ranking = this.rankingAnual();
    const userId = this.user()?.id;
    if (!userId || ranking.length === 0) return null;
    const pos = ranking.findIndex(r => r.userId === userId);
    return pos === -1 ? null : { posicion: pos + 1, total: ranking.length };
  });

  mediaClub = computed(() => {
    const ranking = this.rankingAnual();
    if (ranking.length === 0) return 0;
    const sum = ranking.reduce((acc, r) => acc + r.mediaPlatos, 0);
    return Math.round((sum / ranking.length) * 10) / 10;
  });

  // Datos para gráfico SVG de evolución (últimos 12 meses del año)
  puntosSvg = computed(() => {
    const list = [...this.misEntrenamientos()].reverse(); // cronológico asc
    if (list.length < 2) return { points: '', dots: [] as { x: number; y: number; platos: number }[] };
    const W = 300;
    const H = 80;
    const PAD = 8;
    const xs = list.map((_, i) => PAD + (i / (list.length - 1)) * (W - PAD * 2));
    const ys = list.map(r => H - PAD - ((r.platosRotos / 25) * (H - PAD * 2)));
    const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
    const dots = xs.map((x, i) => ({ x, y: ys[i], platos: list[i].platosRotos }));
    return { points, dots };
  });

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx tsc --noEmit 2>&1 | grep "perfil"
```

Expected: sin errores en perfil.component.ts.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/perfil.component.ts
git commit -m "feat: add entrenamiento stats and ranking signals to PerfilComponent"
```

---

## Task 3: HTML de PerfilComponent con sección entrenamientos

**Files:**
- Modify: `src/app/features/perfil/perfil.component.html`

- [ ] **Step 1: Reemplazar el HTML**

```html
<!-- src/app/features/perfil/perfil.component.html -->
<div>

  <!-- Hero -->
  <div class="perfil-hero">
    <app-avatar
      [nombre]="user()?.nombre ?? ''"
      [apellidos]="user()?.apellidos ?? ''"
      [avatarUrl]="user()?.avatarUrl"
      [size]="64"
    />
    <h2 class="perfil-hero__nombre">
      {{ user()?.nombre }} {{ user()?.apellidos }}
    </h2>
    <p class="perfil-hero__rol">
      {{ user()?.rol }} · #{{ user()?.numeroSocio }}
    </p>
  </div>

  <!-- Stats competiciones -->
  <div class="perfil-stats">
    <div class="perfil-stat perfil-stat--border">
      <p class="perfil-stat__value">{{ totalCompeticiones() }}</p>
      <p class="perfil-stat__label">Competiciones</p>
    </div>
    <div class="perfil-stat perfil-stat--border">
      <p class="perfil-stat__value">{{ mediaPlatos() }}</p>
      <p class="perfil-stat__label">Media platos</p>
    </div>
    <div class="perfil-stat">
      <p class="perfil-stat__value">{{ podios() }}</p>
      <p class="perfil-stat__label">Podios</p>
    </div>
  </div>

  <!-- ── Sección entrenamientos ─────────────────────────────── -->
  <div class="perfil-entrena">

    <!-- Cabecera con selector de año -->
    <div class="perfil-entrena__header">
      <h3 class="page-title">Mis Entrenamientos</h3>
      <select
        class="perfil-entrena__anio-select"
        [value]="anioSeleccionado()"
        (change)="anioSeleccionado.set(+$any($event.target).value)"
      >
        @for (a of anios; track a) {
          <option [value]="a">{{ a }}</option>
        }
      </select>
    </div>

    @if (totalEntrenamientos() === 0) {
      <app-empty-state icon="bi-bullseye" mensaje="Sin entrenamientos este año" />
    } @else {

      <!-- Stats entrenamientos -->
      <div class="perfil-stats perfil-stats--entrena">
        <div class="perfil-stat perfil-stat--border">
          <p class="perfil-stat__value">{{ totalEntrenamientos() }}</p>
          <p class="perfil-stat__label">Sesiones</p>
        </div>
        <div class="perfil-stat perfil-stat--border">
          <p class="perfil-stat__value">{{ mediaEntrenamientos() }}</p>
          <p class="perfil-stat__label">Media</p>
        </div>
        <div class="perfil-stat">
          <p class="perfil-stat__value">{{ mejorResultado() }}</p>
          <p class="perfil-stat__label">Mejor</p>
        </div>
      </div>

      <!-- Posición en el club -->
      @if (posicionClub(); as pos) {
        <div class="perfil-posicion card">
          <div class="perfil-posicion__puesto">
            <span class="perfil-posicion__num">{{ pos.posicion }}º</span>
            <span class="perfil-posicion__de">de {{ pos.total }}</span>
          </div>
          <div class="perfil-posicion__metas">
            <p class="perfil-posicion__linea">Tu media: <strong>{{ mediaEntrenamientos() }}</strong></p>
            <p class="perfil-posicion__linea">Media club: <strong>{{ mediaClub() }}</strong></p>
          </div>
        </div>
      }

      <!-- Gráfico de evolución SVG -->
      @if (puntosSvg().dots.length >= 2) {
        <div class="perfil-grafico card">
          <p class="perfil-grafico__titulo">Evolución {{ anioSeleccionado() }}</p>
          <svg
            class="perfil-grafico__svg"
            viewBox="0 0 300 80"
            preserveAspectRatio="none"
          >
            <!-- Líneas de referencia -->
            <line x1="8" y1="8" x2="292" y2="8" stroke="#E5E7EB" stroke-width="0.5"/>
            <line x1="8" y1="40" x2="292" y2="40" stroke="#E5E7EB" stroke-width="0.5"/>
            <line x1="8" y1="72" x2="292" y2="72" stroke="#E5E7EB" stroke-width="0.5"/>

            <!-- Línea de evolución -->
            <polyline
              [attr.points]="puntosSvg().points"
              fill="none"
              stroke="#FFAE00"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />

            <!-- Puntos -->
            @for (d of puntosSvg().dots; track $index) {
              <circle
                [attr.cx]="d.x"
                [attr.cy]="d.y"
                r="3"
                fill="#FFAE00"
                stroke="white"
                stroke-width="1.5"
              />
            }
          </svg>
          <div class="perfil-grafico__leyenda">
            <span>0</span>
            <span>12</span>
            <span>25</span>
          </div>
        </div>
      }

    }
  </div>

  <!-- Historial competiciones -->
  <div class="perfil-historial">
    <h3 class="page-title perfil-historial__title">Mis Resultados</h3>

    @if (scores().length === 0) {
      <app-empty-state icon="bi-trophy" mensaje="Sin resultados registrados" />
    } @else {
      @for (score of scores(); track score.id) {
        <div class="card perfil-score-item">
          <div class="perfil-score-item__info">
            <p class="perfil-score-item__nombre">{{ getCompeticionNombre(score.competicionId) }}</p>
            <p class="perfil-score-item__fecha">{{ score.fecha | date:'d MMM yyyy' : '' : 'es' }}</p>
          </div>
          <div class="perfil-score-item__resultado">
            <p class="perfil-score-item__rotos">
              {{ score.platosRotos }}<span class="perfil-score-item__total">/{{ getCompeticionTotal(score.competicionId) }}</span>
            </p>
          </div>
        </div>
      }
    }
  </div>

  <!-- Logout -->
  <div class="perfil-logout">
    <button (click)="logout()" class="btn-logout">
      <i class="bi bi-box-arrow-right"></i>
      Cerrar sesión
    </button>
  </div>

</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/perfil/perfil.component.html
git commit -m "feat: add training stats section with SVG chart and club ranking to perfil"
```

---

## Task 4: SCSS de PerfilComponent — estilos sección entrenamientos

**Files:**
- Modify: `src/app/features/perfil/perfil.component.scss`

- [ ] **Step 1: Leer el SCSS actual**

Leer `src/app/features/perfil/perfil.component.scss` para ver los estilos existentes antes de añadir.

- [ ] **Step 2: Añadir estilos al final del archivo**

Añadir al final del archivo existente (sin borrar nada):

```scss
// ── Sección entrenamientos ─────────────────────────────────────

.perfil-entrena {
  @apply flex flex-col gap-3 px-3 pb-2;

  &__header {
    @apply flex items-center justify-between;
  }

  &__anio-select {
    @apply text-sm font-bold text-secondary bg-neutral-100
           rounded-input px-2 py-1 outline-none border-none;
  }
}

.perfil-stats--entrena {
  @apply mt-1;
}

// ── Posición en el club ────────────────────────────────────────

.perfil-posicion {
  @apply flex items-center gap-4;

  &__puesto {
    @apply flex items-baseline gap-1 flex-shrink-0;
  }

  &__num {
    @apply text-[32px] font-black text-secondary leading-none;
  }

  &__de {
    @apply text-xs text-neutral-300 font-medium;
  }

  &__metas {
    @apply flex flex-col gap-0.5;
  }

  &__linea {
    @apply text-sm text-neutral-400;

    strong { @apply text-secondary font-black; }
  }
}

// ── Gráfico SVG ────────────────────────────────────────────────

.perfil-grafico {
  @apply flex flex-col gap-2;

  &__titulo {
    @apply text-xs font-bold text-neutral-400 uppercase tracking-wider;
  }

  &__svg {
    @apply w-full;
    height: 80px;
  }

  &__leyenda {
    @apply flex justify-between text-[10px] text-neutral-300 font-medium px-1;
  }
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx tsc --noEmit 2>&1 | grep "perfil"
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/perfil/perfil.component.scss
git commit -m "feat: add SCSS styles for entrenamiento section in perfil"
```

---

## Task 5: Línea de tiempo unificada en ScoresHistorialComponent

**Files:**
- Modify: `src/app/features/scores/historial/scores-historial.component.ts`
- Modify: `src/app/features/scores/historial/scores-historial.component.html`
- Modify: `src/app/features/scores/historial/scores-historial.component.scss`

- [ ] **Step 1: Reemplazar el TS**

```typescript
// src/app/features/scores/historial/scores-historial.component.ts
import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, combineLatest } from 'rxjs';
import { DatePipe } from '@angular/common';
import { ResultadoService } from '../resultado.service';
import { CompeticionService } from '../competicion.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EntrenamientoService } from '../../admin/entrenamientos/entrenamiento.service';
import { Resultado } from '../../../core/models/resultado.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

interface ItemHistorial {
  tipo: 'entrenamiento' | 'competicion';
  fecha: Date;
  titulo: string;
  platosRotos: number;
  totalPlatos: number;
}

@Component({
  selector: 'app-scores-historial',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './scores-historial.component.html',
  styleUrl: './scores-historial.component.scss',
})
export class ScoresHistorialComponent {
  private auth = inject(AuthService);
  private resultadoService = inject(ResultadoService);
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);

  private anio = new Date().getFullYear();

  resultados = toSignal(
    this.auth.currentUser$.pipe(
      switchMap(user => this.resultadoService.getByUser(user?.id ?? ''))
    ),
    { initialValue: [] as Resultado[] }
  );

  entrenamientos = toSignal(
    this.auth.currentUser$.pipe(
      switchMap(user =>
        this.entrenamientoService.getByUser(user?.id ?? '', this.anio)
      )
    ),
    { initialValue: [] }
  );

  timeline = computed<ItemHistorial[]>(() => {
    // Competiciones
    const compMap = new Map<string, { rotos: number; total: number; fecha: Date }>();
    for (const r of this.resultados()) {
      const comp = this.competicionService.getById(r.competicionId);
      const total = comp ? comp.platosPorSerie * comp.numSeries : 25;
      if (!compMap.has(r.competicionId)) {
        compMap.set(r.competicionId, { rotos: 0, total, fecha: r.fecha });
      }
      compMap.get(r.competicionId)!.rotos += r.resultado;
    }
    const competicionItems: ItemHistorial[] = Array.from(compMap.entries()).map(
      ([competicionId, v]) => ({
        tipo: 'competicion' as const,
        fecha: v.fecha,
        titulo: this.competicionService.getById(competicionId)?.nombre ?? 'Competición',
        platosRotos: v.rotos,
        totalPlatos: v.total,
      })
    );

    // Entrenamientos
    const entrenamientoItems: ItemHistorial[] = this.entrenamientos().map(e => ({
      tipo: 'entrenamiento' as const,
      fecha: new Date(e.fecha),
      titulo: 'Entrenamiento',
      platosRotos: e.platosRotos,
      totalPlatos: 25,
    }));

    // Unir y ordenar descendente por fecha
    return [...competicionItems, ...entrenamientoItems].sort(
      (a, b) => b.fecha.getTime() - a.fecha.getTime()
    );
  });

  getPorcentaje(rotos: number, total: number): number {
    return total > 0 ? Math.round((rotos / total) * 100) : 0;
  }
}
```

- [ ] **Step 2: Reemplazar el HTML**

```html
<!-- src/app/features/scores/historial/scores-historial.component.html -->
<div class="historial">

  @if (timeline().length === 0) {
    <app-empty-state icon="bi-clock-history" mensaje="Sin actividad registrada" />
  } @else {
    @for (item of timeline(); track $index) {
      <div class="card historial-item">

        <div class="historial-item__top">
          <span
            class="historial-item__badge"
            [class.historial-item__badge--competicion]="item.tipo === 'competicion'"
            [class.historial-item__badge--entrenamiento]="item.tipo === 'entrenamiento'"
          >
            @if (item.tipo === 'competicion') {
              <i class="bi bi-trophy-fill"></i> Competición
            } @else {
              <i class="bi bi-bullseye"></i> Entrenamiento
            }
          </span>
          <span class="historial-item__fecha">{{ item.fecha | date:'d MMM yyyy' : '' : 'es' }}</span>
        </div>

        <p class="historial-item__titulo">{{ item.titulo }}</p>

        <div class="historial-item__bottom">
          <div class="historial-item__barra-wrap">
            <div
              class="historial-item__barra"
              [style.width.%]="getPorcentaje(item.platosRotos, item.totalPlatos)"
              [class.historial-item__barra--competicion]="item.tipo === 'competicion'"
            ></div>
          </div>
          <span class="historial-item__resultado">
            {{ item.platosRotos }}/{{ item.totalPlatos }}
            <span class="historial-item__pct">({{ getPorcentaje(item.platosRotos, item.totalPlatos) }}%)</span>
          </span>
        </div>

      </div>
    }
  }

</div>
```

- [ ] **Step 3: Reemplazar el SCSS**

```scss
// src/app/features/scores/historial/scores-historial.component.scss
.historial {
  @apply p-3 flex flex-col gap-3;
}

.historial-item {
  @apply flex flex-col gap-2;

  &__top {
    @apply flex items-center justify-between;
  }

  &__badge {
    @apply inline-flex items-center gap-1 text-[11px] font-bold
           uppercase tracking-wide px-2 py-0.5 rounded-full;

    &--entrenamiento {
      @apply bg-primary/20 text-secondary;
    }

    &--competicion {
      @apply bg-secondary/10 text-secondary;
    }
  }

  &__fecha {
    @apply text-xs text-neutral-300 font-medium;
  }

  &__titulo {
    @apply text-sm font-bold text-secondary;
  }

  &__bottom {
    @apply flex items-center gap-3;
  }

  &__barra-wrap {
    @apply flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden;
  }

  &__barra {
    @apply h-full bg-primary rounded-full transition-all duration-300;

    &--competicion {
      @apply bg-secondary;
    }
  }

  &__resultado {
    @apply text-sm font-black text-secondary flex-shrink-0;
  }

  &__pct {
    @apply text-xs font-medium text-neutral-300;
  }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx tsc --noEmit 2>&1 | grep "historial"
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scores/historial/
git commit -m "feat: unified timeline with entrenamientos and competiciones in historial"
```

---

## Self-Review

### Cobertura de spec
- ✅ Línea de tiempo unificada (entrenamientos + competiciones, marcados con etiqueta)
- ✅ Competiciones NO alimentan stats de entrenamientos (son independientes)
- ✅ Estadísticas de entrenamientos: sesiones, media, mejor resultado
- ✅ Evolución anual con gráfico SVG (sin librerías externas)
- ✅ Selector de año (3 años: actual y 2 anteriores)
- ✅ Posición en el club: "Xº de Y tiradores"
- ✅ Comparativa media personal vs media club
- ✅ Sin cambios de BD — usa tablas existentes
- ✅ Admins/moderadores no necesitan cambios adicionales (el ranking completo se gestiona desde admin-scores)

### Tipos consistentes
- `ResultadoEntrenamientoConFecha` definida en Task 1, usada en Task 2 y Task 5
- `RankingEntrenamientoAnual` definida en Task 1, usada en Task 2
- `getByUser(userId, year)` definida en Task 1, llamada en Tasks 2 y 5 con misma firma
- `getRankingAnual(year)` definida en Task 1, llamada en Task 2 con misma firma
- `puntosSvg()` retorna `{ points: string, dots: {x,y,platos}[] }` — usado en Task 3 con `puntosSvg().points` y `puntosSvg().dots`

### Placeholder scan
- Sin TBDs ni TODOs
- Todos los code blocks son completos y ejecutables
