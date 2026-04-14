# Estadísticas avanzadas del tirador — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al perfil del socio un gráfico de evolución mensual con comparativa multi-año y un heatmap de fallos por plato (grid 5x5).

**Architecture:** Se modifica `perfil.component` (TS/HTML/SCSS) para reemplazar el gráfico SVG actual por uno mensual con chips de años, y se añade un nuevo bloque de fallos debajo del heatmap de esquemas. Se añade un método `getFallosByUserAndYear` al `EntrenamientoService` para obtener fallos filtrados por año vía join `entrenamiento_fallos → escuadras → entrenamientos`.

**Tech Stack:** Angular 19 (signals, computed, toSignal), Supabase JS (joins !inner), Tailwind CSS 3, SCSS BEM

**Spec:** `docs/superpowers/specs/2026-04-14-estadisticas-tirador-design.md`

---

## Files

| Acción | Archivo | Responsabilidad |
|---|---|---|
| Modify | `src/app/features/admin/entrenamientos/entrenamiento.service.ts:290` | Nuevo método `getFallosByUserAndYear` |
| Modify | `src/app/features/perfil/perfil.component.ts` | Nuevos signals, computeds y helpers para evolución + fallos |
| Modify | `src/app/features/perfil/perfil.component.html:278-303` | Reemplazar bloque `perfil-grafico` + añadir bloque fallos |
| Modify | `src/app/features/perfil/perfil.component.scss` | Añadir estilos `.perfil-evolucion` y `.perfil-fallos`, eliminar `.perfil-grafico` |

---

### Task 1: Añadir `getFallosByUserAndYear` al service

**Files:**
- Modify: `src/app/features/admin/entrenamientos/entrenamiento.service.ts:290` (después de `getFallosByUser`)

- [ ] **Step 1: Añadir el método al service**

Insertar después de la línea 290 (cierre de `getFallosByUser`), antes de `deleteEntrenamiento`:

```ts
getFallosByUserAndYear(userId: string, year: number): Observable<{ numeroPlato: number; veces: number }[]> {
  const fromDate = `${year}-01-01`;
  const toDate = `${year}-12-31`;
  return from(
    supabase
      .from('entrenamiento_fallos')
      .select('numero_plato, escuadras!inner(entrenamientos!inner(fecha))')
      .eq('user_id', userId)
      .gte('escuadras.entrenamientos.fecha', fromDate)
      .lte('escuadras.entrenamientos.fecha', toDate)
  ).pipe(
    map(({ data }) => {
      const counts = new Map<number, number>();
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const p = row['numero_plato'] as number;
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([numeroPlato, veces]) => ({ numeroPlato, veces }))
        .sort((a, b) => a.numeroPlato - b.numeroPlato);
    })
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx ng build 2>&1 | tail -5`
Expected: Build exitoso (el método no se usa aún, pero debe compilar sin errores de sintaxis).

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/entrenamientos/entrenamiento.service.ts
git commit -m "feat(entrenamientos): añadir getFallosByUserAndYear con filtro por año"
```

---

### Task 2: Añadir signals y computeds de evolución mensual al componente

**Files:**
- Modify: `src/app/features/perfil/perfil.component.ts:1-3` (imports)
- Modify: `src/app/features/perfil/perfil.component.ts:97-215` (sección SOCIO)

- [ ] **Step 1: Actualizar imports**

En la línea 3, añadir `forkJoin` y `of` a los imports de RxJS:

```ts
import { switchMap, combineLatest, EMPTY, forkJoin, of } from 'rxjs';
```

Añadir import del modelo (después de la línea 10):

```ts
import { ResultadoEntrenamientoConFecha } from '../../core/models/entrenamiento.model';
```

- [ ] **Step 2: Añadir signal `aniosComparativos` y helpers**

Insertar después de la línea 103 (`anios = Array.from...`):

```ts
aniosComparativos = signal<number[]>([]);

toggleAnioComparativo(anio: number): void {
  if (anio === this.anioSeleccionado()) return;
  const current = this.aniosComparativos();
  if (current.includes(anio)) {
    this.aniosComparativos.set(current.filter(a => a !== anio));
  } else if (current.length < 2) {
    this.aniosComparativos.set([...current, anio]);
  }
}
```

- [ ] **Step 3: Añadir signal `entrenamientosComparativos`**

Insertar después de `misEntrenamientos` (después de la línea 115):

```ts
entrenamientosComparativos = toSignal(
  combineLatest([
    this.authService.currentUser$,
    toObservable(this.aniosComparativos),
  ]).pipe(
    switchMap(([u, years]) => {
      if (!u?.id || years.length === 0) return of(new Map<number, ResultadoEntrenamientoConFecha[]>());
      const obs: Record<string, Observable<ResultadoEntrenamientoConFecha[]>> = {};
      for (const y of years) obs[String(y)] = this.entrenamientoService.getByUser(u.id, y);
      return forkJoin(obs).pipe(
        map(result => {
          const m = new Map<number, ResultadoEntrenamientoConFecha[]>();
          for (const [k, v] of Object.entries(result)) m.set(Number(k), v);
          return m;
        })
      );
    })
  ),
  { initialValue: new Map<number, ResultadoEntrenamientoConFecha[]>() }
);
```

Añadir `map` al import de RxJS si no está (ya está en la línea 3 vía `switchMap` — verificar. Si no, añadir):

```ts
import { switchMap, combineLatest, EMPTY, forkJoin, of, map } from 'rxjs';
```

Nota: `map` de RxJS puede conflictuar con `map` de `@angular/core/rxjs-interop`. Verificar que se importa desde `rxjs`. El service ya usa `map` en sus `pipe()`.

Actualizar la línea 3 para incluir todo:

```ts
import { switchMap, combineLatest, EMPTY, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
```

Comprobar que el import existente de `map` en el service (`import { from, Observable, map } from 'rxjs'`) no conflictúa. En el componente `perfil.component.ts` actualmente no se usa `map` — añadirlo.

- [ ] **Step 4: Añadir computed `evolucionMensual` y `svgEvolucion`**

Insertar antes de `puntosSvg` (antes de la línea 203):

```ts
readonly mesesAbrev = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

private calcularMediasMensuales(list: ResultadoEntrenamientoConFecha[]): (number | null)[] {
  const buckets = Array.from({ length: 12 }, () => [] as number[]);
  for (const r of list) {
    const mes = new Date(r.fecha).getMonth();
    buckets[mes].push(r.platosRotos);
  }
  return buckets.map(arr =>
    arr.length === 0 ? null : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
  );
}

evolucionMensual = computed(() => {
  const result = new Map<number, (number | null)[]>();
  result.set(this.anioSeleccionado(), this.calcularMediasMensuales(this.misEntrenamientos()));
  const comp = this.entrenamientosComparativos();
  for (const [year, list] of comp.entries()) {
    result.set(year, this.calcularMediasMensuales(list));
  }
  return result;
});

svgEvolucion = computed(() => {
  const data = this.evolucionMensual();
  const W = 300, H = 120, PAD_X = 30, PAD_Y = 8;
  const colores = [
    { anio: this.anioSeleccionado(), color: '#FFAE00' },
    ...this.aniosComparativos().map((a, i) =>
      ({ anio: a, color: i === 0 ? '#60A5FA' : '#A78BFA' })
    )
  ];
  const lineas: { anio: number; color: string; points: string; dots: { x: number; y: number; media: number }[] }[] = [];

  for (const { anio, color } of colores) {
    const medias = data.get(anio);
    if (!medias) continue;
    const dots: { x: number; y: number; media: number }[] = [];
    for (let m = 0; m < 12; m++) {
      if (medias[m] === null) continue;
      const x = PAD_X + (m / 11) * (W - PAD_X * 2);
      const y = H - PAD_Y - ((medias[m]! / 25) * (H - PAD_Y * 2));
      dots.push({ x, y, media: medias[m]! });
    }
    const points = dots.map(d => `${d.x},${d.y}`).join(' ');
    lineas.push({ anio, color, points, dots });
  }
  return lineas;
});
```

- [ ] **Step 5: Verificar que compila**

Run: `npx ng build 2>&1 | tail -5`
Expected: Build exitoso.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/perfil/perfil.component.ts
git commit -m "feat(perfil): añadir signals y computeds para evolución mensual multi-año"
```

---

### Task 3: Reemplazar gráfico SVG en el HTML por evolución mensual

**Files:**
- Modify: `src/app/features/perfil/perfil.component.html:278-303` (bloque `perfil-grafico`)

- [ ] **Step 1: Reemplazar el bloque `perfil-grafico`**

Reemplazar las líneas 278-303 (desde `@if (puntosSvg()...` hasta el cierre `}` del bloque) por:

```html
        @if (totalEntrenamientos() > 0) {
          <div class="perfil-evolucion card">
            <p class="perfil-evolucion__titulo">Evolución mensual</p>
            <div class="perfil-evolucion__chips">
              @for (a of anios; track a) {
                <button
                  class="perfil-evolucion__chip"
                  [class.perfil-evolucion__chip--activo]="a === anioSeleccionado()"
                  [class.perfil-evolucion__chip--comparar]="aniosComparativos().includes(a)"
                  (click)="toggleAnioComparativo(a)">
                  {{ a }}
                </button>
              }
            </div>
            <div class="perfil-evolucion__chart-area">
              <div class="perfil-evolucion__eje-y">
                <span>25</span>
                <span>20</span>
                <span>15</span>
                <span>10</span>
                <span>0</span>
              </div>
              <svg class="perfil-evolucion__svg" viewBox="0 0 300 120">
                <line x1="0" y1="8" x2="300" y2="8" stroke="#f3f4f6" stroke-width="0.5" stroke-dasharray="4"/>
                <line x1="0" y1="32" x2="300" y2="32" stroke="#f3f4f6" stroke-width="0.5" stroke-dasharray="4"/>
                <line x1="0" y1="56" x2="300" y2="56" stroke="#f3f4f6" stroke-width="0.5" stroke-dasharray="4"/>
                <line x1="0" y1="80" x2="300" y2="80" stroke="#f3f4f6" stroke-width="0.5" stroke-dasharray="4"/>
                <line x1="0" y1="112" x2="300" y2="112" stroke="#e5e7eb" stroke-width="0.5"/>
                @for (linea of svgEvolucion(); track linea.anio) {
                  @if (linea.dots.length >= 2) {
                    <polyline
                      [attr.points]="linea.points"
                      fill="none"
                      [attr.stroke]="linea.color"
                      stroke-width="2"
                      stroke-linejoin="round"
                      stroke-linecap="round"
                    />
                  }
                  @for (d of linea.dots; track $index) {
                    <circle [attr.cx]="d.x" [attr.cy]="d.y" r="3" [attr.fill]="linea.color" stroke="white" stroke-width="1.5"/>
                  }
                }
              </svg>
            </div>
            <div class="perfil-evolucion__eje-x">
              @for (m of mesesAbrev; track $index) {
                <span>{{ m }}</span>
              }
            </div>
            @if (aniosComparativos().length > 0) {
              <div class="perfil-evolucion__leyenda">
                <span class="perfil-evolucion__leyenda-item">
                  <span class="perfil-evolucion__leyenda-linea" style="background:#FFAE00"></span>
                  {{ anioSeleccionado() }}
                </span>
                @for (a of aniosComparativos(); track a; let i = $index) {
                  <span class="perfil-evolucion__leyenda-item">
                    <span class="perfil-evolucion__leyenda-linea"
                      [style.background]="i === 0 ? '#60A5FA' : '#A78BFA'"></span>
                    {{ a }}
                  </span>
                }
              </div>
            }
          </div>
        }
```

- [ ] **Step 2: Verificar que compila**

Run: `npx ng build 2>&1 | tail -5`
Expected: Build exitoso.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/perfil.component.html
git commit -m "feat(perfil): reemplazar gráfico por sesión con evolución mensual multi-año"
```

---

### Task 4: Estilos de evolución mensual + eliminar estilos antiguos

**Files:**
- Modify: `src/app/features/perfil/perfil.component.scss`

- [ ] **Step 1: Reemplazar bloque `.perfil-grafico` por `.perfil-evolucion`**

Buscar y reemplazar todo el bloque `.perfil-grafico { ... }` (líneas 159-176 del SCSS) por:

```scss
// ── Evolución mensual ────────────────────────────────────────

.perfil-evolucion {
  @apply flex flex-col gap-2;

  &__titulo {
    @apply text-xs font-semibold text-neutral-400 uppercase tracking-[1.5px];
  }

  &__chips {
    @apply flex gap-1.5;
  }

  &__chip {
    @apply text-[11px] font-bold px-2.5 py-1 rounded-full
           bg-neutral-100 text-neutral-400 border-0 cursor-pointer
           transition-all duration-fast;

    &--activo {
      @apply bg-secondary text-white;
    }

    &--comparar {
      @apply bg-blue-100 text-blue-600;
    }
  }

  &__chart-area {
    @apply flex gap-1;
  }

  &__eje-y {
    @apply flex flex-col justify-between text-[9px] text-neutral-400 font-medium
           w-5 flex-shrink-0 py-0.5;
    text-align: right;
  }

  &__svg {
    @apply flex-1;
    height: 120px;
  }

  &__eje-x {
    @apply flex justify-between text-[9px] text-neutral-400 font-medium pl-6;
  }

  &__leyenda {
    @apply flex gap-3 justify-center mt-1;
  }

  &__leyenda-item {
    @apply flex items-center gap-1 text-[11px] font-semibold text-secondary;
  }

  &__leyenda-linea {
    @apply w-3 h-[3px] rounded-sm inline-block;
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx ng build 2>&1 | tail -5`
Expected: Build exitoso.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/perfil.component.scss
git commit -m "feat(perfil): estilos evolución mensual, eliminar estilos gráfico antiguo"
```

---

### Task 5: Añadir signals y computeds de heatmap de fallos

**Files:**
- Modify: `src/app/features/perfil/perfil.component.ts` (sección SOCIO, después de `svgEvolucion`)

- [ ] **Step 1: Añadir signal de fallos del año**

Insertar después de `svgEvolucion` computed, antes de `puntosSvg` (que ya no se usa pero se eliminará en el paso 3):

```ts
misFallosAnuales = toSignal(
  combineLatest([
    this.authService.currentUser$,
    toObservable(this.anioSeleccionado),
  ]).pipe(
    switchMap(([u, year]) =>
      u?.id ? this.entrenamientoService.getFallosByUserAndYear(u.id, year) : of([])
    )
  ),
  { initialValue: [] as { numeroPlato: number; veces: number }[] }
);

totalFallos = computed(() => this.misFallosAnuales().reduce((sum, f) => sum + f.veces, 0));

heatmapFallos = computed(() => {
  const fallos = this.misFallosAnuales();
  const fallosMap = new Map(fallos.map(f => [f.numeroPlato, f.veces]));
  const maxVeces = fallos.length > 0 ? Math.max(...fallos.map(f => f.veces)) : 0;
  return Array.from({ length: 25 }, (_, i) => ({
    plato: i + 1,
    veces: fallosMap.get(i + 1) ?? 0,
    maxVeces,
  }));
});

platoMasFallado = computed(() => {
  const con = this.heatmapFallos().filter(c => c.veces > 0);
  if (con.length === 0) return null;
  return con.reduce((max, c) => c.veces > max.veces ? c : max);
});

platoMenosFallado = computed(() => {
  const con = this.heatmapFallos().filter(c => c.veces > 0);
  if (con.length <= 1) return null;
  return con.reduce((min, c) => c.veces < min.veces ? c : min);
});

platosMasFallados = computed(() => {
  const con = this.heatmapFallos().filter(c => c.veces > 0);
  return con.sort((a, b) => b.veces - a.veces).slice(0, 3).map(c => c.plato);
});

platosMenosFallados = computed(() => {
  const con = this.heatmapFallos().filter(c => c.veces > 0);
  if (con.length <= 1) return [] as number[];
  return con.sort((a, b) => a.veces - b.veces).slice(0, 3).map(c => c.plato);
});

claseCeldaFallo(celda: { plato: number; veces: number; maxVeces: number }): string {
  const classes: string[] = ['perfil-fallos__celda'];
  const { veces, maxVeces } = celda;

  if (maxVeces === 0) {
    classes.push('bg-neutral-100');
  } else if (veces === 0) {
    classes.push('bg-green-200');
  } else {
    const pct = (veces / maxVeces) * 100;
    if (pct < 25) classes.push('bg-green-100');
    else if (pct < 50) classes.push('bg-yellow-100');
    else if (pct < 75) classes.push('bg-orange-200');
    else classes.push('bg-red-200');
  }

  const peor = this.platoMasFallado();
  const mejor = this.platoMenosFallado();
  if (peor && celda.plato === peor.plato) classes.push('perfil-fallos__celda--peor');
  else if (mejor && celda.plato === mejor.plato) classes.push('perfil-fallos__celda--mejor');

  return classes.join(' ');
}
```

- [ ] **Step 2: Eliminar `puntosSvg` computed**

Eliminar el computed `puntosSvg` completo (líneas ~203-214 del archivo original, ahora desplazado). Ya no se usa en el template.

- [ ] **Step 3: Verificar que compila**

Run: `npx ng build 2>&1 | tail -5`
Expected: Build exitoso.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/perfil/perfil.component.ts
git commit -m "feat(perfil): añadir signals y computeds para heatmap de fallos por plato"
```

---

### Task 6: Añadir bloque HTML del heatmap de fallos

**Files:**
- Modify: `src/app/features/perfil/perfil.component.html` (después del bloque `perfil-heatmap`, antes del cierre de `}` del `@else`)

- [ ] **Step 1: Insertar bloque fallos**

Después del cierre del bloque `perfil-heatmap` (después de `</div>` + `}` del `@if (totalEntrenamientos() > 0)` del heatmap esquemas), insertar:

```html
        @if (totalFallos() > 0) {
          <div class="perfil-fallos card">
            <p class="perfil-fallos__titulo">Fallos por plato</p>
            <div class="perfil-fallos__grid">
              @for (celda of heatmapFallos(); track celda.plato) {
                <div [class]="claseCeldaFallo(celda)">
                  <span class="perfil-fallos__num">{{ celda.plato }}</span>
                  <span class="perfil-fallos__veces">{{ celda.veces > 0 ? celda.veces : '—' }}</span>
                </div>
              }
            </div>
            <div class="perfil-fallos__resumen">
              @if (platosMasFallados().length > 0) {
                <p class="perfil-fallos__linea perfil-fallos__linea--peor">
                  <i class="bi bi-caret-up-fill"></i>
                  Más fallados: {{ platosMasFallados().join(', ') }}
                </p>
              }
              @if (platosMenosFallados().length > 0) {
                <p class="perfil-fallos__linea perfil-fallos__linea--mejor">
                  <i class="bi bi-caret-down-fill"></i>
                  Menos fallados: {{ platosMenosFallados().join(', ') }}
                </p>
              }
            </div>
          </div>
        }
```

- [ ] **Step 2: Verificar que compila**

Run: `npx ng build 2>&1 | tail -5`
Expected: Build exitoso.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/perfil.component.html
git commit -m "feat(perfil): añadir bloque HTML heatmap de fallos por plato"
```

---

### Task 7: Estilos del heatmap de fallos

**Files:**
- Modify: `src/app/features/perfil/perfil.component.scss` (al final, antes de `// ── Enlace contabilidad`)

- [ ] **Step 1: Añadir estilos `.perfil-fallos`**

Insertar antes del bloque `// ── Enlace contabilidad`:

```scss
// ── Heatmap fallos por plato ────────────────────────────────

.perfil-fallos {
  @apply p-3 flex flex-col gap-2;

  &__titulo {
    @apply text-xs font-semibold text-neutral-400 uppercase tracking-[1.5px];
  }

  &__grid {
    @apply grid grid-cols-5 gap-1;
  }

  &__celda {
    @apply aspect-square flex flex-col items-center justify-center
           rounded-[8px] border border-neutral-200;

    &--peor  { @apply border-2 border-danger; }
    &--mejor { @apply border-2 border-success; }
  }

  &__num   { @apply text-[10px] font-semibold text-neutral-400 leading-none; }
  &__veces { @apply text-sm font-bold text-secondary leading-none mt-0.5; }

  &__resumen { @apply flex flex-col gap-0.5 mt-1; }
  &__linea {
    @apply text-[12px] font-medium flex items-center gap-1;
    &--peor  { @apply text-danger; }
    &--mejor { @apply text-success; }
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx ng build 2>&1 | tail -5`
Expected: Build exitoso.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/perfil.component.scss
git commit -m "feat(perfil): estilos del heatmap de fallos por plato"
```

---

### Task 8: Limpiar código muerto y resetear `aniosComparativos` al cambiar año

**Files:**
- Modify: `src/app/features/perfil/perfil.component.ts`
- Modify: `src/app/features/perfil/perfil.component.html:238`

- [ ] **Step 1: Añadir reset de `aniosComparativos` al cambiar año**

En el HTML, modificar el `(change)` del select de año (línea ~238) para que además vacíe los comparativos:

Reemplazar:
```html
(change)="anioSeleccionado.set(+$any($event.target).value)"
```
Por:
```html
(change)="anioSeleccionado.set(+$any($event.target).value); aniosComparativos.set([])"
```

- [ ] **Step 2: Eliminar `puntosSvg` si no se eliminó en Task 5**

Verificar que el computed `puntosSvg` no existe en `perfil.component.ts`. Si aún está, eliminarlo.

- [ ] **Step 3: Build final completo**

Run: `npx ng build 2>&1 | tail -10`
Expected: Build exitoso sin errores. Warnings preexistentes de budgets son aceptables.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/perfil/perfil.component.ts src/app/features/perfil/perfil.component.html
git commit -m "fix(perfil): reset años comparativos al cambiar año, eliminar código muerto"
```

---

### Task 9: Verificación manual

- [ ] **Step 1: Arrancar el servidor de desarrollo**

Run: `npm start`

- [ ] **Step 2: Verificar como socio con entrenamientos**

1. Login como socio que tenga entrenamientos en varios meses
2. Verificar que aparece el gráfico de evolución mensual con puntos y línea
3. Click en chip de año anterior → debe aparecer segunda línea en azul
4. Click en segundo chip → tercera línea en violeta
5. Click en chip ya activo → se desactiva
6. Cambiar año en el selector → chips comparativos se vacían
7. Verificar heatmap de esquemas sigue funcionando
8. Verificar heatmap de fallos aparece si hay fallos registrados
9. Verificar resumen "Más fallados" y "Menos fallados"

- [ ] **Step 3: Verificar como socio sin entrenamientos**

1. Login como socio sin entrenamientos en el año seleccionado
2. Verificar que ni evolución ni heatmap de fallos aparecen
3. Solo debe verse el empty-state

- [ ] **Step 4: Verificar como admin**

1. Login como admin
2. Verificar que no aparece ninguno de los nuevos bloques
3. El perfil admin sigue mostrando la contabilidad
