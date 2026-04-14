# Echa un rato Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Echa un rato" section with 2 new minigames (Test de Reflejos + Izquierda o Derecha), a hub page, Supabase persistence, and club ranking.

**Architecture:** New route `/juegos` as hub linking to 3 games (existing Rompe Platos + 2 new). Each game is a standalone component with canvas/DOM-based gameplay. A shared `JuegosService` handles Supabase CRUD against a new `juegos_scores` table. Home socio card is updated to link to the hub.

**Tech Stack:** Angular 19 (standalone components, signals), Supabase (PostgreSQL + RLS), Tailwind CSS 3 + SCSS, RxJS

---

## File Structure

| File | Responsibility |
|------|---------------|
| `supabase/migrations/XXXX_juegos_scores.sql` | Create table + RLS |
| `src/app/features/juegos/juegos.service.ts` | Supabase CRUD: save scores, get ranking, get best marks |
| `src/app/features/juegos/juegos.routes.ts` | Lazy route config for `/juegos/*` |
| `src/app/features/juegos/hub/juegos-hub.component.ts` | Hub page: 3 game cards + ranking |
| `src/app/features/juegos/hub/juegos-hub.component.html` | Hub template |
| `src/app/features/juegos/hub/juegos-hub.component.scss` | Hub styles |
| `src/app/features/juegos/reflejos/reflejos.component.ts` | Test de Reflejos game logic |
| `src/app/features/juegos/reflejos/reflejos.component.html` | Reflejos template |
| `src/app/features/juegos/reflejos/reflejos.component.scss` | Reflejos styles |
| `src/app/features/juegos/lateralidad/lateralidad.component.ts` | Izquierda o Derecha game logic |
| `src/app/features/juegos/lateralidad/lateralidad.component.html` | Lateralidad template |
| `src/app/features/juegos/lateralidad/lateralidad.component.scss` | Lateralidad styles |
| Modify: `src/app/app.routes.ts` | Add `/juegos` lazy route |
| Modify: `src/app/features/home/home.component.ts` | Replace `goToJuego()` with `goToJuegos()` |
| Modify: `src/app/features/home/home.component.html` | Replace "Rompe Platos" card with "Echa un rato" |

---

### Task 1: Supabase Migration — `juegos_scores` table

**Files:**
- Create: `supabase/migrations/20260414120000_juegos_scores.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260414120000_juegos_scores.sql

CREATE TABLE juegos_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo_juego text NOT NULL CHECK (tipo_juego IN ('reflejos', 'lateralidad', 'rompe_platos')),
  valor integer NOT NULL,
  aciertos integer,
  total_rondas integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_juegos_scores_ranking ON juegos_scores(tipo_juego, valor);
CREATE INDEX idx_juegos_scores_user ON juegos_scores(user_id, tipo_juego);

ALTER TABLE juegos_scores ENABLE ROW LEVEL SECURITY;

-- Todos los socios autenticados pueden ver el ranking
CREATE POLICY "juegos_scores_select" ON juegos_scores
  FOR SELECT TO authenticated USING (true);

-- Solo puedes insertar tus propias partidas
CREATE POLICY "juegos_scores_insert" ON juegos_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration to Supabase**

Run: `supabase db push` (or apply via Supabase dashboard SQL editor if remote-only)

Verify: table `juegos_scores` exists with columns `id, user_id, tipo_juego, valor, aciertos, total_rondas, created_at`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260414120000_juegos_scores.sql
git commit -m "feat(juegos): create juegos_scores table with RLS"
```

---

### Task 2: JuegosService — Supabase CRUD

**Files:**
- Create: `src/app/features/juegos/juegos.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/app/features/juegos/juegos.service.ts
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { supabase } from '../../core/supabase/supabase.client';

export interface RankingJuego {
  userId: string;
  nombre: string;
  apellidos: string;
  valor: number;
  aciertos: number | null;
}

@Injectable({ providedIn: 'root' })
export class JuegosService {

  guardarPartida(
    tipoJuego: string,
    valor: number,
    aciertos: number | null,
    totalRondas: number
  ): Observable<void> {
    return from(
      supabase.from('juegos_scores').insert({
        user_id: undefined, // will be set below
        tipo_juego: tipoJuego,
        valor,
        aciertos,
        total_rondas: totalRondas,
      })
    ).pipe(map(() => undefined));
  }

  async guardarPartidaAsync(
    userId: string,
    tipoJuego: string,
    valor: number,
    aciertos: number | null,
    totalRondas: number
  ): Promise<void> {
    await supabase.from('juegos_scores').insert({
      user_id: userId,
      tipo_juego: tipoJuego,
      valor,
      aciertos,
      total_rondas: totalRondas,
    });
  }

  getMejorMarca(userId: string, tipoJuego: string): Observable<number | null> {
    if (tipoJuego === 'rompe_platos') {
      return from(
        supabase
          .from('juegos_scores')
          .select('valor')
          .eq('user_id', userId)
          .eq('tipo_juego', tipoJuego)
          .order('valor', { ascending: false })
          .limit(1)
      ).pipe(map(({ data }) => data && data.length > 0 ? (data[0] as any).valor : null));
    }
    // reflejos y lateralidad: menor ms es mejor
    return from(
      supabase
        .from('juegos_scores')
        .select('valor')
        .eq('user_id', userId)
        .eq('tipo_juego', tipoJuego)
        .order('valor', { ascending: true })
        .limit(1)
    ).pipe(map(({ data }) => data && data.length > 0 ? (data[0] as any).valor : null));
  }

  getMisMejoresMarcas(userId: string): Observable<Map<string, number>> {
    return from(
      supabase
        .from('juegos_scores')
        .select('tipo_juego, valor')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data }) => {
        const m = new Map<string, number>();
        for (const row of (data ?? []) as any[]) {
          const tipo = row.tipo_juego as string;
          const val = row.valor as number;
          const current = m.get(tipo);
          if (current === undefined) {
            m.set(tipo, val);
          } else if (tipo === 'rompe_platos') {
            if (val > current) m.set(tipo, val);
          } else {
            if (val < current) m.set(tipo, val);
          }
        }
        return m;
      })
    );
  }

  getRanking(tipoJuego: string, limit: number = 5): Observable<RankingJuego[]> {
    const ascending = tipoJuego !== 'rompe_platos';
    return from(
      supabase
        .from('juegos_scores')
        .select('user_id, valor, aciertos, profiles!inner(nombre, apellidos)')
        .eq('tipo_juego', tipoJuego)
        .order('valor', { ascending })
        .limit(200)
    ).pipe(
      map(({ data }) => {
        const seen = new Map<string, RankingJuego>();
        for (const row of (data ?? []) as any[]) {
          const uid = row.user_id as string;
          if (seen.has(uid)) continue;
          seen.set(uid, {
            userId: uid,
            nombre: row.profiles.nombre,
            apellidos: row.profiles.apellidos,
            valor: row.valor,
            aciertos: row.aciertos ?? null,
          });
          if (seen.size >= limit) break;
        }
        return Array.from(seen.values());
      })
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx ng build`
Expected: BUILD SUCCESS (no errors related to the new service)

- [ ] **Step 3: Commit**

```bash
git add src/app/features/juegos/juegos.service.ts
git commit -m "feat(juegos): add JuegosService with ranking and scores CRUD"
```

---

### Task 3: Routes — `/juegos` lazy loading

**Files:**
- Create: `src/app/features/juegos/juegos.routes.ts`
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Create juegos routes file**

```typescript
// src/app/features/juegos/juegos.routes.ts
import { Routes } from '@angular/router';

export const juegosRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./hub/juegos-hub.component').then(m => m.JuegosHubComponent),
  },
  {
    path: 'reflejos',
    loadComponent: () =>
      import('./reflejos/reflejos.component').then(m => m.ReflejosComponent),
  },
  {
    path: 'lateralidad',
    loadComponent: () =>
      import('./lateralidad/lateralidad.component').then(m => m.LateralidadComponent),
  },
];
```

- [ ] **Step 2: Add `/juegos` to app.routes.ts**

In `src/app/app.routes.ts`, inside the `children` array of the shell route (after the `juego` route at line ~50), add:

```typescript
      {
        path: 'juegos',
        loadChildren: () =>
          import('./features/juegos/juegos.routes').then(m => m.juegosRoutes),
      },
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/juegos/juegos.routes.ts src/app/app.routes.ts
git commit -m "feat(juegos): add lazy-loaded routes for /juegos hub and games"
```

---

### Task 4: JuegosHubComponent — hub page with 3 cards + ranking

**Files:**
- Create: `src/app/features/juegos/hub/juegos-hub.component.ts`
- Create: `src/app/features/juegos/hub/juegos-hub.component.html`
- Create: `src/app/features/juegos/hub/juegos-hub.component.scss`

- [ ] **Step 1: Create the component TypeScript**

```typescript
// src/app/features/juegos/hub/juegos-hub.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { JuegosService, RankingJuego } from '../juegos.service';

interface JuegoCard {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  fondoIcono: string;
  colorMarca: string;
  ruta: string;
  tipoJuego: string;
  unidad: string;
}

const JUEGOS: JuegoCard[] = [
  {
    id: 'rompe_platos',
    nombre: 'Rompe Platos',
    descripcion: '25 platos · Puntería y velocidad',
    icono: '🎯',
    fondoIcono: '#FFF3D0',
    colorMarca: '#FFAE00',
    ruta: '/juego',
    tipoJuego: 'rompe_platos',
    unidad: '',
  },
  {
    id: 'reflejos',
    nombre: 'Test de Reflejos',
    descripcion: '5 rondas · Reacción pura',
    icono: '⚡',
    fondoIcono: '#E8F5E9',
    colorMarca: '#10B981',
    ruta: '/juegos/reflejos',
    tipoJuego: 'reflejos',
    unidad: 'ms',
  },
  {
    id: 'lateralidad',
    nombre: 'Izquierda o Derecha',
    descripcion: '10 platos · Decisión lateral rápida',
    icono: '↔️',
    fondoIcono: '#E3F2FD',
    colorMarca: '#3B82F6',
    ruta: '/juegos/lateralidad',
    tipoJuego: 'lateralidad',
    unidad: 'ms',
  },
];

@Component({
  selector: 'app-juegos-hub',
  standalone: true,
  templateUrl: './juegos-hub.component.html',
  styleUrl: './juegos-hub.component.scss',
})
export class JuegosHubComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private juegosService = inject(JuegosService);

  juegos = JUEGOS;
  rankingTipo = signal<string>('reflejos');

  private user = toSignal(this.authService.currentUser$, { initialValue: null });
  userId = computed(() => this.user()?.id ?? null);

  mejoresMarcas = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => this.juegosService.getMisMejoresMarcas(u?.id ?? ''))
    ),
    { initialValue: new Map<string, number>() }
  );

  ranking = toSignal(
    toObservable(this.rankingTipo).pipe(
      switchMap(tipo => this.juegosService.getRanking(tipo, 5))
    ),
    { initialValue: [] as RankingJuego[] }
  );

  formatMarca(juego: JuegoCard): string {
    const val = this.mejoresMarcas().get(juego.tipoJuego);
    if (val === undefined) return '—';
    return juego.unidad ? `${val}${juego.unidad}` : `${val}`;
  }

  formatRankingValor(val: number): string {
    const tipo = this.rankingTipo();
    return tipo === 'rompe_platos' ? `${val}` : `${val}ms`;
  }

  irAJuego(ruta: string): void {
    this.router.navigate([ruta]);
  }

  cambiarRanking(tipo: string): void {
    this.rankingTipo.set(tipo);
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/features/juegos/hub/juegos-hub.component.html -->
<div class="juegos-hub">
  <h3 class="page-title">Echa un rato</h3>

  <div class="juegos-hub__cards">
    @for (j of juegos; track j.id) {
      <button class="juegos-hub__card card" (click)="irAJuego(j.ruta)">
        <div class="juegos-hub__card-icon" [style.background]="j.fondoIcono">
          <span>{{ j.icono }}</span>
        </div>
        <div class="juegos-hub__card-info">
          <p class="juegos-hub__card-nombre">{{ j.nombre }}</p>
          <p class="juegos-hub__card-desc">{{ j.descripcion }}</p>
        </div>
        <div class="juegos-hub__card-marca" [style.color]="j.colorMarca">
          {{ formatMarca(j) }}
        </div>
      </button>
    }
  </div>

  <!-- Ranking -->
  <div class="juegos-hub__ranking">
    <p class="juegos-hub__ranking-titulo">Top Club</p>
    <div class="juegos-hub__ranking-chips">
      @for (j of juegos; track j.id) {
        <button
          class="juegos-hub__chip"
          [class.juegos-hub__chip--activo]="rankingTipo() === j.tipoJuego"
          (click)="cambiarRanking(j.tipoJuego)">
          {{ j.icono }} {{ j.nombre }}
        </button>
      }
    </div>

    @if (ranking().length === 0) {
      <p class="juegos-hub__ranking-vacio">Sin partidas aún</p>
    } @else {
      <div class="juegos-hub__ranking-lista card">
        @for (r of ranking(); track r.userId; let i = $index) {
          <div
            class="juegos-hub__ranking-fila"
            [class.juegos-hub__ranking-fila--yo]="r.userId === userId()">
            <div class="juegos-hub__ranking-left">
              <span class="juegos-hub__ranking-pos" [class.juegos-hub__ranking-pos--gold]="i === 0">{{ i + 1 }}.</span>
              <span class="juegos-hub__ranking-nombre">{{ r.nombre }} {{ r.apellidos | slice:0:1 }}.</span>
            </div>
            <span class="juegos-hub__ranking-valor">{{ formatRankingValor(r.valor) }}</span>
          </div>
        }
      </div>
    }
  </div>
</div>
```

- [ ] **Step 3: Create the styles**

```scss
// src/app/features/juegos/hub/juegos-hub.component.scss
.juegos-hub {
  @apply p-3 flex flex-col gap-3;

  &__cards {
    @apply flex flex-col gap-2;
  }

  &__card {
    @apply w-full flex items-center gap-3 p-3 text-left cursor-pointer
           active:scale-[.99] transition-transform duration-fast;
  }

  &__card-icon {
    @apply w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0;
  }

  &__card-info {
    @apply flex-1 min-w-0;
  }

  &__card-nombre {
    @apply text-sm font-bold text-secondary m-0;
  }

  &__card-desc {
    @apply text-[11px] text-neutral-400 m-0 mt-0.5;
  }

  &__card-marca {
    @apply text-[11px] font-bold flex-shrink-0;
  }

  &__ranking {
    @apply flex flex-col gap-2 mt-1;
  }

  &__ranking-titulo {
    @apply text-xs font-semibold text-neutral-400 uppercase tracking-[1.5px] m-0;
  }

  &__ranking-chips {
    @apply flex gap-1.5 overflow-x-auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  &__chip {
    @apply text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap
           bg-neutral-100 text-neutral-400 border-0 cursor-pointer
           transition-all duration-fast;

    &--activo {
      @apply bg-secondary text-white;
    }
  }

  &__ranking-vacio {
    @apply text-sm text-neutral-400 text-center py-4 m-0;
  }

  &__ranking-lista {
    @apply p-0 overflow-hidden;
  }

  &__ranking-fila {
    @apply flex items-center justify-between px-3 py-2.5
           border-b border-neutral-100 last:border-b-0;

    &--yo {
      background: #FFFDE7;
    }
  }

  &__ranking-left {
    @apply flex items-center gap-2;
  }

  &__ranking-pos {
    @apply text-sm font-bold text-neutral-400;

    &--gold {
      @apply text-brand-yellow;
    }
  }

  &__ranking-nombre {
    @apply text-sm font-semibold text-secondary;
  }

  &__ranking-valor {
    @apply text-sm font-bold text-secondary;
  }
}
```

- [ ] **Step 4: Add `SlicePipe` import to the component**

In `juegos-hub.component.ts`, add `SlicePipe` to imports:

```typescript
import { SlicePipe } from '@angular/common';

@Component({
  // ...
  imports: [SlicePipe],
  // ...
})
```

- [ ] **Step 5: Verify build**

Run: `npx ng build`
Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add src/app/features/juegos/hub/
git commit -m "feat(juegos): add JuegosHubComponent with game cards and ranking"
```

---

### Task 5: ReflejosComponent — Test de Reflejos game

**Files:**
- Create: `src/app/features/juegos/reflejos/reflejos.component.ts`
- Create: `src/app/features/juegos/reflejos/reflejos.component.html`
- Create: `src/app/features/juegos/reflejos/reflejos.component.scss`

- [ ] **Step 1: Create the component TypeScript**

```typescript
// src/app/features/juegos/reflejos/reflejos.component.ts
import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { JuegosService } from '../juegos.service';
import { toSignal } from '@angular/core/rxjs-interop';

type Fase = 'intro' | 'espera' | 'plato' | 'prematuro' | 'resultado';

const TOTAL_RONDAS = 5;
const MIN_ESPERA = 1000;
const MAX_ESPERA = 4000;

@Component({
  selector: 'app-reflejos',
  standalone: true,
  templateUrl: './reflejos.component.html',
  styleUrl: './reflejos.component.scss',
})
export class ReflejosComponent implements OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private juegosService = inject(JuegosService);
  private user = toSignal(this.authService.currentUser$, { initialValue: null });

  fase = signal<Fase>('intro');
  rondaActual = signal(0);
  tiempos = signal<(number | null)[]>([]);
  private platoTimestamp = 0;
  private esperaTimeout: ReturnType<typeof setTimeout> | null = null;
  private prematuroTimeout: ReturnType<typeof setTimeout> | null = null;

  guardado = signal(false);
  posicionClub = signal<number | null>(null);

  readonly totalRondas = TOTAL_RONDAS;

  mediaMs = computed(() => {
    const validos = this.tiempos().filter((t): t is number => t !== null);
    if (validos.length === 0) return null;
    return Math.round(validos.reduce((a, b) => a + b, 0) / validos.length);
  });

  mejorMs = computed(() => {
    const validos = this.tiempos().filter((t): t is number => t !== null);
    return validos.length > 0 ? Math.min(...validos) : null;
  });

  peorMs = computed(() => {
    const validos = this.tiempos().filter((t): t is number => t !== null);
    return validos.length > 0 ? Math.max(...validos) : null;
  });

  rondasNulas = computed(() => this.tiempos().filter(t => t === null).length);

  ngOnDestroy(): void {
    this.limpiarTimers();
  }

  empezar(): void {
    this.tiempos.set([]);
    this.rondaActual.set(1);
    this.guardado.set(false);
    this.posicionClub.set(null);
    this.iniciarEspera();
  }

  private iniciarEspera(): void {
    this.fase.set('espera');
    const delay = MIN_ESPERA + Math.random() * (MAX_ESPERA - MIN_ESPERA);
    this.esperaTimeout = setTimeout(() => {
      this.platoTimestamp = performance.now();
      this.fase.set('plato');
    }, delay);
  }

  onToque(): void {
    const f = this.fase();
    if (f === 'espera') {
      // Toque prematuro
      this.limpiarTimers();
      this.fase.set('prematuro');
      this.tiempos.update(t => [...t, null]);
      this.prematuroTimeout = setTimeout(() => this.siguienteRonda(), 1000);
    } else if (f === 'plato') {
      const ms = Math.round(performance.now() - this.platoTimestamp);
      this.tiempos.update(t => [...t, ms]);
      this.siguienteRonda();
    }
  }

  private siguienteRonda(): void {
    if (this.rondaActual() >= TOTAL_RONDAS) {
      this.fase.set('resultado');
      this.guardarResultado();
    } else {
      this.rondaActual.update(r => r + 1);
      this.iniciarEspera();
    }
  }

  private async guardarResultado(): Promise<void> {
    const media = this.mediaMs();
    const uid = this.user()?.id;
    if (media === null || !uid) return;

    try {
      await this.juegosService.guardarPartidaAsync(uid, 'reflejos', media, null, TOTAL_RONDAS);
      this.guardado.set(true);

      // Calcular posición
      this.juegosService.getRanking('reflejos', 100).subscribe(ranking => {
        const pos = ranking.findIndex(r => r.userId === uid);
        if (pos !== -1) this.posicionClub.set(pos + 1);
      });
    } catch {
      // silently fail — game experience > persistence
    }
  }

  jugarDeNuevo(): void {
    this.empezar();
  }

  volver(): void {
    this.router.navigate(['/juegos']);
  }

  private limpiarTimers(): void {
    if (this.esperaTimeout) { clearTimeout(this.esperaTimeout); this.esperaTimeout = null; }
    if (this.prematuroTimeout) { clearTimeout(this.prematuroTimeout); this.prematuroTimeout = null; }
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/features/juegos/reflejos/reflejos.component.html -->
<div class="reflejos">

  @if (fase() === 'intro') {
    <div class="reflejos__intro">
      <span class="reflejos__intro-icon">⚡</span>
      <h2 class="reflejos__intro-titulo">Test de Reflejos</h2>
      <p class="reflejos__intro-desc">
        Cuando la pantalla se ponga verde y aparezca el plato, toca lo más rápido posible.
        Si tocas antes de tiempo, la ronda es nula.
      </p>
      <p class="reflejos__intro-rondas">{{ totalRondas }} rondas</p>
      <button class="reflejos__btn-empezar" (click)="empezar()">Empezar</button>
    </div>
  }

  @if (fase() === 'espera') {
    <div class="reflejos__espera" (click)="onToque()">
      <p class="reflejos__ronda-num">Ronda {{ rondaActual() }} / {{ totalRondas }}</p>
      <div class="reflejos__plato-ghost">🎯</div>
      <p class="reflejos__espera-txt">Espera...</p>
      <p class="reflejos__espera-aviso">Si tocas antes → ronda nula</p>
    </div>
  }

  @if (fase() === 'plato') {
    <div class="reflejos__plato" (click)="onToque()">
      <p class="reflejos__ronda-num reflejos__ronda-num--light">Ronda {{ rondaActual() }} / {{ totalRondas }}</p>
      <div class="reflejos__plato-activo">🎯</div>
      <p class="reflejos__toca-txt">¡TOCA!</p>
    </div>
  }

  @if (fase() === 'prematuro') {
    <div class="reflejos__prematuro">
      <p class="reflejos__ronda-num reflejos__ronda-num--light">Ronda {{ rondaActual() }} / {{ totalRondas }}</p>
      <p class="reflejos__prematuro-txt">¡Demasiado pronto!</p>
      <p class="reflejos__prematuro-sub">Ronda nula</p>
    </div>
  }

  @if (fase() === 'resultado') {
    <div class="reflejos__resultado">
      <p class="reflejos__resultado-label">Tu tiempo medio</p>
      @if (mediaMs() !== null) {
        <p class="reflejos__resultado-valor">
          {{ mediaMs() }}<span class="reflejos__resultado-unidad">ms</span>
        </p>
      } @else {
        <p class="reflejos__resultado-valor reflejos__resultado-valor--nulo">Sin resultado</p>
      }

      <div class="reflejos__resultado-stats">
        <div class="reflejos__resultado-stat">
          <p class="reflejos__resultado-stat-val">{{ mejorMs() ?? '—' }}</p>
          <p class="reflejos__resultado-stat-label">Mejor</p>
        </div>
        <div class="reflejos__resultado-stat">
          <p class="reflejos__resultado-stat-val">{{ peorMs() ?? '—' }}</p>
          <p class="reflejos__resultado-stat-label">Peor</p>
        </div>
        <div class="reflejos__resultado-stat">
          <p class="reflejos__resultado-stat-val">{{ rondasNulas() }}</p>
          <p class="reflejos__resultado-stat-label">Nulas</p>
        </div>
      </div>

      @if (posicionClub() !== null) {
        <div class="reflejos__resultado-badges">
          <span class="reflejos__badge reflejos__badge--ranking">
            🏆 {{ posicionClub() }}º del club
          </span>
        </div>
      }

      <div class="reflejos__resultado-acciones">
        <button class="reflejos__btn-replay" (click)="jugarDeNuevo()">Jugar de nuevo</button>
        <button class="reflejos__btn-volver" (click)="volver()">Volver</button>
      </div>
    </div>
  }

</div>
```

- [ ] **Step 3: Create the styles**

```scss
// src/app/features/juegos/reflejos/reflejos.component.scss
.reflejos {
  @apply min-h-screen;

  // ── Intro ──────────────────────────────────────
  &__intro {
    @apply flex flex-col items-center justify-center min-h-screen p-6 text-center;
    background: #f8f9fa;
  }

  &__intro-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  &__intro-titulo {
    @apply text-xl font-bold text-secondary m-0;
  }

  &__intro-desc {
    @apply text-sm text-neutral-400 mt-2 max-w-xs;
  }

  &__intro-rondas {
    @apply text-xs font-bold text-neutral-400 uppercase tracking-wider mt-4 mb-6;
  }

  &__btn-empezar {
    @apply px-8 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer;
    background: #1a1a2e;
  }

  // ── Espera ─────────────────────────────────────
  &__espera {
    @apply flex flex-col items-center justify-center min-h-screen cursor-pointer select-none;
    background: #374151;
  }

  &__ronda-num {
    @apply absolute top-3 right-4 text-xs text-neutral-500 m-0;
    position: absolute;

    &--light {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  &__plato-ghost {
    @apply flex items-center justify-center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 3px dashed rgba(255, 255, 255, 0.15);
    font-size: 32px;
    opacity: 0.3;
  }

  &__espera-txt {
    @apply text-base font-bold text-white mt-5 m-0;
  }

  &__espera-aviso {
    @apply text-xs mt-6 m-0;
    color: #EF4444;
    opacity: 0.7;
  }

  // ── Plato (verde) ──────────────────────────────
  &__plato {
    @apply flex flex-col items-center justify-center min-h-screen cursor-pointer select-none;
    background: #10B981;
    position: relative;
  }

  &__plato-activo {
    @apply flex items-center justify-center;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    font-size: 48px;
    animation: pulso 0.5s infinite alternate;
  }

  &__toca-txt {
    @apply text-2xl font-extrabold text-white mt-4 m-0;
  }

  // ── Prematuro (rojo) ───────────────────────────
  &__prematuro {
    @apply flex flex-col items-center justify-center min-h-screen select-none;
    background: #EF4444;
    position: relative;
  }

  &__prematuro-txt {
    @apply text-xl font-extrabold text-white m-0;
  }

  &__prematuro-sub {
    @apply text-sm text-white mt-2 m-0;
    opacity: 0.7;
  }

  // ── Resultado ──────────────────────────────────
  &__resultado {
    @apply flex flex-col items-center justify-center min-h-screen p-6 text-center;
    background: #f8f9fa;
  }

  &__resultado-label {
    @apply text-xs font-semibold text-neutral-400 uppercase tracking-wider m-0;
  }

  &__resultado-valor {
    @apply text-5xl font-extrabold text-secondary m-0 mt-1;

    &--nulo {
      @apply text-xl text-neutral-400;
    }
  }

  &__resultado-unidad {
    @apply text-lg font-semibold text-neutral-400;
  }

  &__resultado-stats {
    @apply flex gap-2 mt-4;
  }

  &__resultado-stat {
    @apply bg-white rounded-xl px-4 py-2 shadow-sm;

    &-val {
      @apply text-lg font-extrabold text-secondary m-0;
    }

    &-label {
      @apply text-[10px] text-neutral-400 m-0 mt-0.5;
    }
  }

  &__resultado-badges {
    @apply flex gap-2 mt-4;
  }

  &__badge {
    @apply text-[11px] font-bold px-3 py-1 rounded-full;

    &--ranking {
      background: #FFF3D0;
      color: #FFAE00;
    }
  }

  &__resultado-acciones {
    @apply flex gap-2 mt-6;
  }

  &__btn-replay {
    @apply px-6 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer;
    background: #1a1a2e;
  }

  &__btn-volver {
    @apply px-6 py-3 rounded-xl text-sm font-bold text-neutral-500 border-0 cursor-pointer;
    background: #f3f4f6;
  }
}

@keyframes pulso {
  from { transform: scale(1); }
  to { transform: scale(1.08); }
}
```

- [ ] **Step 4: Verify build**

Run: `npx ng build`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add src/app/features/juegos/reflejos/
git commit -m "feat(juegos): add ReflejosComponent — reaction time test game"
```

---

### Task 6: LateralidadComponent — Izquierda o Derecha game

**Files:**
- Create: `src/app/features/juegos/lateralidad/lateralidad.component.ts`
- Create: `src/app/features/juegos/lateralidad/lateralidad.component.html`
- Create: `src/app/features/juegos/lateralidad/lateralidad.component.scss`

- [ ] **Step 1: Create the component TypeScript**

```typescript
// src/app/features/juegos/lateralidad/lateralidad.component.ts
import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { JuegosService } from '../juegos.service';
import { toSignal } from '@angular/core/rxjs-interop';

type Fase = 'intro' | 'espera' | 'volando' | 'feedback' | 'resultado';

const TOTAL_RONDAS = 10;
const TIMEOUT_MS = 1500;
const PAUSA_ENTRE_RONDAS = 600;
const FEEDBACK_MS = 300;

@Component({
  selector: 'app-lateralidad',
  standalone: true,
  templateUrl: './lateralidad.component.html',
  styleUrl: './lateralidad.component.scss',
})
export class LateralidadComponent implements OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private juegosService = inject(JuegosService);
  private user = toSignal(this.authService.currentUser$, { initialValue: null });

  fase = signal<Fase>('intro');
  rondaActual = signal(0);
  direccion = signal<'izq' | 'dcha'>('izq');
  feedbackOk = signal<boolean | null>(null);

  private resultados: { acierto: boolean; ms: number | null }[] = [];
  private platoTimestamp = 0;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private pausaTimer: ReturnType<typeof setTimeout> | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private respondido = false;

  guardado = signal(false);
  posicionClub = signal<number | null>(null);

  readonly totalRondas = TOTAL_RONDAS;

  aciertos = computed(() => this.resultadosFinal().filter(r => r.acierto).length);
  fallos = computed(() => this.resultadosFinal().filter(r => !r.acierto).length);
  precision = computed(() => {
    const total = this.resultadosFinal().length;
    return total > 0 ? Math.round((this.aciertos() / total) * 100) : 0;
  });

  mediaMs = computed(() => {
    const validos = this.resultadosFinal().filter(r => r.acierto && r.ms !== null);
    if (validos.length === 0) return null;
    return Math.round(validos.reduce((a, r) => a + r.ms!, 0) / validos.length);
  });

  mejorMs = computed(() => {
    const validos = this.resultadosFinal().filter(r => r.acierto && r.ms !== null).map(r => r.ms!);
    return validos.length > 0 ? Math.min(...validos) : null;
  });

  // Signal to trigger reactivity on resultado
  resultadosFinal = signal<{ acierto: boolean; ms: number | null }[]>([]);

  ngOnDestroy(): void {
    this.limpiarTimers();
  }

  empezar(): void {
    this.resultados = [];
    this.resultadosFinal.set([]);
    this.rondaActual.set(1);
    this.guardado.set(false);
    this.posicionClub.set(null);
    this.iniciarPausa();
  }

  private iniciarPausa(): void {
    this.fase.set('espera');
    this.pausaTimer = setTimeout(() => {
      this.lanzarPlato();
    }, PAUSA_ENTRE_RONDAS);
  }

  private lanzarPlato(): void {
    this.respondido = false;
    this.direccion.set(Math.random() < 0.5 ? 'izq' : 'dcha');
    this.platoTimestamp = performance.now();
    this.fase.set('volando');

    this.timeoutTimer = setTimeout(() => {
      if (!this.respondido) {
        this.respondido = true;
        this.resultados.push({ acierto: false, ms: null });
        this.mostrarFeedback(false);
      }
    }, TIMEOUT_MS);
  }

  pulsar(lado: 'izq' | 'dcha'): void {
    if (this.fase() !== 'volando' || this.respondido) return;
    this.respondido = true;
    if (this.timeoutTimer) { clearTimeout(this.timeoutTimer); this.timeoutTimer = null; }

    const ms = Math.round(performance.now() - this.platoTimestamp);
    const acierto = lado === this.direccion();
    this.resultados.push({ acierto, ms: acierto ? ms : null });
    this.mostrarFeedback(acierto);
  }

  private mostrarFeedback(ok: boolean): void {
    this.feedbackOk.set(ok);
    this.fase.set('feedback');
    this.feedbackTimer = setTimeout(() => {
      this.feedbackOk.set(null);
      this.siguienteRonda();
    }, FEEDBACK_MS);
  }

  private siguienteRonda(): void {
    if (this.rondaActual() >= TOTAL_RONDAS) {
      this.resultadosFinal.set([...this.resultados]);
      this.fase.set('resultado');
      this.guardarResultado();
    } else {
      this.rondaActual.update(r => r + 1);
      this.iniciarPausa();
    }
  }

  private async guardarResultado(): Promise<void> {
    const media = this.mediaMs();
    const uid = this.user()?.id;
    const valor = media ?? 9999;

    if (!uid) return;

    try {
      await this.juegosService.guardarPartidaAsync(uid, 'lateralidad', valor, this.aciertos(), TOTAL_RONDAS);
      this.guardado.set(true);

      this.juegosService.getRanking('lateralidad', 100).subscribe(ranking => {
        const pos = ranking.findIndex(r => r.userId === uid);
        if (pos !== -1) this.posicionClub.set(pos + 1);
      });
    } catch {
      // silently fail
    }
  }

  jugarDeNuevo(): void {
    this.empezar();
  }

  volver(): void {
    this.router.navigate(['/juegos']);
  }

  private limpiarTimers(): void {
    if (this.timeoutTimer) { clearTimeout(this.timeoutTimer); this.timeoutTimer = null; }
    if (this.pausaTimer) { clearTimeout(this.pausaTimer); this.pausaTimer = null; }
    if (this.feedbackTimer) { clearTimeout(this.feedbackTimer); this.feedbackTimer = null; }
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/features/juegos/lateralidad/lateralidad.component.html -->
<div class="lateralidad">

  @if (fase() === 'intro') {
    <div class="lateralidad__intro">
      <span class="lateralidad__intro-icon">↔️</span>
      <h2 class="lateralidad__intro-titulo">Izquierda o Derecha</h2>
      <p class="lateralidad__intro-desc">
        Un plato volará hacia un lado. Pulsa el botón correcto lo más rápido posible.
        Si no pulsas a tiempo, cuenta como fallo.
      </p>
      <p class="lateralidad__intro-rondas">{{ totalRondas }} rondas</p>
      <button class="lateralidad__btn-empezar" (click)="empezar()">Empezar</button>
    </div>
  }

  @if (fase() === 'espera') {
    <div class="lateralidad__cielo">
      <p class="lateralidad__ronda">Ronda {{ rondaActual() }} / {{ totalRondas }}</p>
      <div class="lateralidad__botones">
        <button class="lateralidad__btn-lado" disabled>← IZQ</button>
        <button class="lateralidad__btn-lado" disabled>DCHA →</button>
      </div>
    </div>
  }

  @if (fase() === 'volando') {
    <div class="lateralidad__cielo">
      <p class="lateralidad__ronda">Ronda {{ rondaActual() }} / {{ totalRondas }}</p>
      <div class="lateralidad__plato-zona">
        <div
          class="lateralidad__plato"
          [class.lateralidad__plato--izq]="direccion() === 'izq'"
          [class.lateralidad__plato--dcha]="direccion() === 'dcha'">
          🎯
        </div>
      </div>
      <div class="lateralidad__botones">
        <button class="lateralidad__btn-lado" (click)="pulsar('izq')">← IZQ</button>
        <button class="lateralidad__btn-lado" (click)="pulsar('dcha')">DCHA →</button>
      </div>
    </div>
  }

  @if (fase() === 'feedback') {
    <div
      class="lateralidad__feedback"
      [class.lateralidad__feedback--ok]="feedbackOk() === true"
      [class.lateralidad__feedback--fail]="feedbackOk() === false">
      <span class="lateralidad__feedback-icon">{{ feedbackOk() ? '✓' : '✗' }}</span>
    </div>
  }

  @if (fase() === 'resultado') {
    <div class="lateralidad__resultado">
      <p class="lateralidad__resultado-label">Tu tiempo medio</p>
      @if (mediaMs() !== null) {
        <p class="lateralidad__resultado-valor">
          {{ mediaMs() }}<span class="lateralidad__resultado-unidad">ms</span>
        </p>
      } @else {
        <p class="lateralidad__resultado-valor lateralidad__resultado-valor--nulo">Sin aciertos</p>
      }

      <div class="lateralidad__resultado-stats">
        <div class="lateralidad__resultado-stat">
          <p class="lateralidad__resultado-stat-val lateralidad__resultado-stat-val--ok">{{ aciertos() }}</p>
          <p class="lateralidad__resultado-stat-label">Aciertos</p>
        </div>
        <div class="lateralidad__resultado-stat">
          <p class="lateralidad__resultado-stat-val lateralidad__resultado-stat-val--fail">{{ fallos() }}</p>
          <p class="lateralidad__resultado-stat-label">Fallos</p>
        </div>
        <div class="lateralidad__resultado-stat">
          <p class="lateralidad__resultado-stat-val">{{ mejorMs() ?? '—' }}</p>
          <p class="lateralidad__resultado-stat-label">Mejor ms</p>
        </div>
      </div>

      <div class="lateralidad__resultado-badges">
        <span class="lateralidad__badge lateralidad__badge--precision">{{ precision() }}% precisión</span>
        @if (posicionClub() !== null) {
          <span class="lateralidad__badge lateralidad__badge--ranking">🏆 {{ posicionClub() }}º del club</span>
        }
      </div>

      <div class="lateralidad__resultado-acciones">
        <button class="lateralidad__btn-replay" (click)="jugarDeNuevo()">Jugar de nuevo</button>
        <button class="lateralidad__btn-volver" (click)="volver()">Volver</button>
      </div>
    </div>
  }

</div>
```

- [ ] **Step 3: Create the styles**

```scss
// src/app/features/juegos/lateralidad/lateralidad.component.scss
.lateralidad {
  @apply min-h-screen;

  // ── Intro ──────────────────────────────────────
  &__intro {
    @apply flex flex-col items-center justify-center min-h-screen p-6 text-center;
    background: #f8f9fa;
  }

  &__intro-icon { font-size: 48px; margin-bottom: 12px; }
  &__intro-titulo { @apply text-xl font-bold text-secondary m-0; }
  &__intro-desc { @apply text-sm text-neutral-400 mt-2 max-w-xs; }
  &__intro-rondas { @apply text-xs font-bold text-neutral-400 uppercase tracking-wider mt-4 mb-6; }
  &__btn-empezar {
    @apply px-8 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer;
    background: #1a1a2e;
  }

  // ── Cielo (espera + volando) ───────────────────
  &__cielo {
    @apply flex flex-col items-center justify-center min-h-screen select-none;
    background: #87CEEB;
    position: relative;
  }

  &__ronda {
    @apply absolute top-3 text-xs font-semibold m-0;
    color: rgba(255, 255, 255, 0.7);
  }

  &__plato-zona {
    @apply relative;
    width: 100%;
    height: 200px;
  }

  &__plato {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 48px;

    &--izq {
      animation: vuela-izq 1.5s linear forwards;
    }

    &--dcha {
      animation: vuela-dcha 1.5s linear forwards;
    }
  }

  &__botones {
    @apply absolute bottom-4 left-3 right-3 flex gap-3;
  }

  &__btn-lado {
    @apply flex-1 py-4 rounded-xl text-lg font-extrabold border-2 cursor-pointer
           active:scale-95 transition-transform;
    background: white;
    border-color: #e5e7eb;
    color: #1a1a2e;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  // ── Feedback flash ─────────────────────────────
  &__feedback {
    @apply flex items-center justify-center min-h-screen;

    &--ok { background: #10B981; }
    &--fail { background: #EF4444; }
  }

  &__feedback-icon {
    @apply text-5xl font-extrabold text-white;
  }

  // ── Resultado ──────────────────────────────────
  &__resultado {
    @apply flex flex-col items-center justify-center min-h-screen p-6 text-center;
    background: #f8f9fa;
  }

  &__resultado-label {
    @apply text-xs font-semibold text-neutral-400 uppercase tracking-wider m-0;
  }

  &__resultado-valor {
    @apply text-5xl font-extrabold text-secondary m-0 mt-1;

    &--nulo { @apply text-xl text-neutral-400; }
  }

  &__resultado-unidad {
    @apply text-lg font-semibold text-neutral-400;
  }

  &__resultado-stats {
    @apply flex gap-2 mt-4;
  }

  &__resultado-stat {
    @apply bg-white rounded-xl px-4 py-2 shadow-sm;

    &-val {
      @apply text-lg font-extrabold text-secondary m-0;
      &--ok { @apply text-success; }
      &--fail { @apply text-danger; }
    }

    &-label {
      @apply text-[10px] text-neutral-400 m-0 mt-0.5;
    }
  }

  &__resultado-badges {
    @apply flex gap-2 mt-4;
  }

  &__badge {
    @apply text-[11px] font-bold px-3 py-1 rounded-full;

    &--precision { background: #E3F2FD; color: #3B82F6; }
    &--ranking { background: #FFF3D0; color: #FFAE00; }
  }

  &__resultado-acciones {
    @apply flex gap-2 mt-6;
  }

  &__btn-replay {
    @apply px-6 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer;
    background: #1a1a2e;
  }

  &__btn-volver {
    @apply px-6 py-3 rounded-xl text-sm font-bold text-neutral-500 border-0 cursor-pointer;
    background: #f3f4f6;
  }
}

@keyframes vuela-izq {
  from { left: 50%; opacity: 1; }
  to   { left: -15%; opacity: 0.3; }
}

@keyframes vuela-dcha {
  from { left: 50%; opacity: 1; }
  to   { left: 115%; opacity: 0.3; }
}
```

- [ ] **Step 4: Verify build**

Run: `npx ng build`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add src/app/features/juegos/lateralidad/
git commit -m "feat(juegos): add LateralidadComponent — left/right decision game"
```

---

### Task 7: Home — Replace "Rompe Platos" card with "Echa un rato"

**Files:**
- Modify: `src/app/features/home/home.component.ts`
- Modify: `src/app/features/home/home.component.html`

- [ ] **Step 1: Update the TypeScript**

In `src/app/features/home/home.component.ts`, replace the `goToJuego` method (line ~131):

```typescript
  // Replace:
  goToJuego(): void {
    this.router.navigate(['/juego']);
  }

  // With:
  goToJuegos(): void {
    this.router.navigate(['/juegos']);
  }
```

- [ ] **Step 2: Update the template**

In `src/app/features/home/home.component.html`, replace the button at lines 79–88:

```html
    <!-- Replace the existing Rompe Platos button with: -->
    <button class="home-juego" (click)="goToJuegos()">
      <div class="home-juego__left">
        <span class="home-juego__icon">🧠</span>
        <div>
          <p class="home-juego__titulo">Echa un rato</p>
          <p class="home-juego__sub">Entrena reflejos y concentración</p>
        </div>
      </div>
      <i class="bi bi-chevron-right home-juego__play"></i>
    </button>
```

- [ ] **Step 3: Verify build**

Run: `npx ng build`
Expected: BUILD SUCCESS

- [ ] **Step 4: Test manually**

1. Run `npm start` and open `http://localhost:4200`
2. Login as a socio
3. Verify home shows "Echa un rato" card with 🧠 icon
4. Click the card → navigates to `/juegos`
5. Hub shows 3 game cards
6. Click "Rompe Platos" → navigates to `/juego` (existing game)
7. Click "Test de Reflejos" → navigates to `/juegos/reflejos`, play a full game
8. Click "Izquierda o Derecha" → navigates to `/juegos/lateralidad`, play a full game
9. Verify results show and ranking updates
10. Go back to hub → verify best marks update

- [ ] **Step 5: Commit**

```bash
git add src/app/features/home/home.component.ts src/app/features/home/home.component.html
git commit -m "feat(home): replace Rompe Platos card with Echa un rato hub link"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|-----------------|------|
| RF1: Hub with 3 cards + best marks | Task 4 |
| RF2: Ranking top 5, switchable | Task 4 |
| RF3: Reflejos 5 rounds, 1-4s wait | Task 5 |
| RF4: Premature touch = null round | Task 5 |
| RF5: Reflejos result screen | Task 5 |
| RF6: Lateralidad 10 rounds, L/R buttons | Task 6 |
| RF7: Timeout 1500ms = auto fail | Task 6 |
| RF8: Lateralidad result screen | Task 6 |
| RF9: Save results to juegos_scores | Tasks 5, 6 |
| RF10: Ranking by best value | Task 2 |
| RF11: Home card replacement | Task 7 |
| RF12: Table with RLS | Task 1 |
