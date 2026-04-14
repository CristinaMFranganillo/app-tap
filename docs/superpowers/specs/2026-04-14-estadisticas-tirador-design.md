# Estadísticas avanzadas del tirador — Diseño

**Fecha:** 2026-04-14
**Estado:** Aprobado por usuario

## Objetivo

Añadir al perfil del socio dos bloques de estadísticas avanzadas:
1. **Evolución mensual** — gráfico de media de platos por mes con comparativa multi-año (hasta 3 años superpuestos)
2. **Heatmap de fallos por plato** — grid 5x5 mostrando la frecuencia de fallo en cada plato (1-25), filtrado por año

Ambos ayudan al tirador a identificar tendencias temporales y debilidades técnicas específicas.

## Alcance

- **Quién lo ve:** únicamente el socio en su propio perfil, sección "Mis Entrenamientos".
- **No se aplica a:** admin/moderador (su perfil muestra contabilidad).
- **Año:** usa `anioSeleccionado` existente. Los chips multi-año solo aplican al gráfico de evolución.
- **Reemplaza:** el gráfico SVG actual (`perfil-grafico`) de puntos por sesión individual.

## Posición en el perfil del socio

Dentro de la rama `@else { (no es admin) }`, tras el `empty-state`:

1. Stats (Sesiones / Media / Mejor) — ya existe
2. Posición en el club — ya existe
3. **Evolución mensual (NUEVO)** — reemplaza `perfil-grafico`
4. Heatmap esquemas — ya existe
5. **Heatmap fallos por plato (NUEVO)**

---

## Feature 1: Evolución mensual

### RF1 — Datos

Reutiliza `getByUser(userId, year)` que ya alimenta `misEntrenamientos`. Para años comparativos, se hacen llamadas adicionales con los años activados.

Nuevo computed `evolucionMensual`:
- Recibe un array de `ResultadoEntrenamientoConFecha[]` (uno por año activo)
- Agrupa por mes (1-12) extrayendo el mes de `fecha`
- Para cada mes: `mediaPlatos = Math.round((sum / count) * 10) / 10`. `null` si no hay datos ese mes.
- Devuelve `Map<number, { mes: number; media: number | null }[]>` donde la clave es el año.

### RF2 — Años comparativos

- Signal `aniosComparativos = signal<number[]>([])` — array de hasta 2 años adicionales activados por el usuario.
- Los años disponibles para comparar son los que no coinciden con `anioSeleccionado`, del array `anios` existente (3 años).
- Activar/desactivar: click en chip toggle. Si ya hay 2 activos y se intenta activar un tercero, se ignora.
- Al cambiar `anioSeleccionado`, se vacía `aniosComparativos` para evitar duplicados.

### RF3 — Datos de años comparativos

Nuevo signal derivado `entrenamientosComparativos`:
- Observa `aniosComparativos` y `authService.currentUser$`
- Por cada año en `aniosComparativos`, llama a `entrenamientoService.getByUser(userId, year)`
- Devuelve `Map<number, ResultadoEntrenamientoConFecha[]>`

### RF4 — Colores de línea

| Línea | Color | Uso |
|---|---|---|
| Año principal (seleccionado) | `#FFAE00` (primary) | Siempre visible |
| Segundo año | `#60A5FA` (blue-400) | Solo si activado |
| Tercer año | `#A78BFA` (violet-400) | Solo si activado |

### RF5 — Gráfico SVG

- ViewBox: `0 0 300 120`
- Eje Y: 0-25 (fijo), con líneas guía en 0, 10, 15, 20, 25
- Eje X: 12 posiciones equidistantes (Ene-Dic)
- Cada línea: `<polyline>` conectando solo los meses con datos (meses sin datos no generan punto, la línea salta)
- Puntos: `<circle>` r=3 en cada mes con datos
- Labels eje X: abreviaturas de 3 letras (Ene, Feb, Mar...)
- Labels eje Y: 0, 10, 15, 20, 25 (a la izquierda)

### RF6 — Visibilidad

El bloque se muestra si `totalEntrenamientos() > 0` (misma condición que el gráfico actual que reemplaza).

### UI — Estructura HTML

```html
@if (totalEntrenamientos() > 0) {
  <div class="perfil-evolucion card">
    <p class="perfil-evolucion__titulo">Evolución mensual</p>
    <div class="perfil-evolucion__chips">
      @for (a of aniosDisponiblesComparar(); track a) {
        <button
          class="perfil-evolucion__chip"
          [class.perfil-evolucion__chip--activo]="a === anioSeleccionado()"
          [class.perfil-evolucion__chip--comparar]="aniosComparativos().includes(a)"
          (click)="toggleAnioComparativo(a)">
          {{ a }}
        </button>
      }
    </div>
    <svg class="perfil-evolucion__svg" viewBox="0 0 300 120" preserveAspectRatio="none">
      <!-- grid lines -->
      <!-- polyline + circles por cada año activo -->
    </svg>
    <div class="perfil-evolucion__eje-x">
      @for (m of mesesAbrev; track $index) {
        <span>{{ m }}</span>
      }
    </div>
    @if (aniosComparativos().length > 0) {
      <div class="perfil-evolucion__leyenda">
        <!-- leyenda con color por año -->
      </div>
    }
  </div>
}
```

### UI — Estilos

```scss
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

  &__svg {
    @apply w-full;
    height: 120px;
  }

  &__eje-x {
    @apply flex justify-between text-[9px] text-neutral-400 font-medium px-2;
  }

  &__leyenda {
    @apply flex gap-3 justify-center mt-1;
  }

  &__leyenda-item {
    @apply flex items-center gap-1 text-[11px] font-semibold;
  }

  &__leyenda-linea {
    @apply w-3 h-[3px] rounded-sm inline-block;
  }
}
```

### Helpers TypeScript

```ts
readonly mesesAbrev = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
readonly coloresAnio: Record<number, string> = {}; // se construye dinámicamente

aniosComparativos = signal<number[]>([]);

aniosDisponiblesComparar = computed(() => this.anios); // los 3 años del selector

toggleAnioComparativo(anio: number): void {
  if (anio === this.anioSeleccionado()) return; // el principal no se toglea
  const current = this.aniosComparativos();
  if (current.includes(anio)) {
    this.aniosComparativos.set(current.filter(a => a !== anio));
  } else if (current.length < 2) {
    this.aniosComparativos.set([...current, anio]);
  }
}

evolucionMensual = computed(() => {
  const result = new Map<number, (number | null)[]>();
  // Año principal
  result.set(this.anioSeleccionado(), this.calcularMediasMensuales(this.misEntrenamientos()));
  // Años comparativos
  const comp = this.entrenamientosComparativos();
  for (const [year, list] of comp.entries()) {
    result.set(year, this.calcularMediasMensuales(list));
  }
  return result;
});

private calcularMediasMensuales(list: ResultadoEntrenamientoConFecha[]): (number | null)[] {
  const buckets = Array.from({ length: 12 }, () => [] as number[]);
  for (const r of list) {
    const mes = new Date(r.fecha).getMonth(); // 0-11
    buckets[mes].push(r.platosRotos);
  }
  return buckets.map(arr =>
    arr.length === 0 ? null : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
  );
}

svgEvolucion = computed(() => {
  const data = this.evolucionMensual();
  const W = 300, H = 120, PAD_X = 30, PAD_Y = 8;
  const colores = [
    { año: this.anioSeleccionado(), color: '#FFAE00' },
    ...this.aniosComparativos().map((a, i) =>
      ({ año: a, color: i === 0 ? '#60A5FA' : '#A78BFA' })
    )
  ];
  const lineas: { año: number; color: string; points: string; dots: { x: number; y: number; media: number }[] }[] = [];

  for (const { año, color } of colores) {
    const medias = data.get(año);
    if (!medias) continue;
    const dots: { x: number; y: number; media: number }[] = [];
    for (let m = 0; m < 12; m++) {
      if (medias[m] === null) continue;
      const x = PAD_X + (m / 11) * (W - PAD_X * 2);
      const y = H - PAD_Y - ((medias[m]! / 25) * (H - PAD_Y * 2));
      dots.push({ x, y, media: medias[m]! });
    }
    const points = dots.map(d => `${d.x},${d.y}`).join(' ');
    lineas.push({ año, color, points, dots });
  }
  return lineas;
});
```

---

## Feature 2: Heatmap de fallos por plato

### RF7 — Nueva query

Nuevo método en `EntrenamientoService`:

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

**Alternativa si el join profundo de Supabase no funciona:** hacer la query en dos pasos:
1. Obtener `escuadra_id`s del año vía los `misEntrenamientos` ya cargados (tienen `escuadraId`)
2. Filtrar fallos con `.in('escuadra_id', escuadraIds)` — sin join adicional

Esta alternativa es más robusta y no añade una llamada extra (reutiliza datos del año ya cargados).

### RF8 — Cálculo del heatmap

Nuevo computed `heatmapFallos`:
- Fuente: signal derivado de `getFallosByUserAndYear(userId, anioSeleccionado)`
- Genera array fijo de longitud 25 (platos 1-25)
- Para cada plato: `{ plato: number, veces: number }` donde `veces = 0` si no aparece en los datos
- Calcula `maxVeces = Math.max(...veces)` para la escala relativa

### RF9 — Color relativo

| % del máximo | Clase Tailwind |
|---|---|
| Sin datos de fallos (0 sesiones con fallos registrados) | `bg-neutral-100` |
| 0 veces (plato nunca fallado, pero hay fallos en otros) | `bg-green-200` |
| < 25% del máximo | `bg-green-100` |
| 25-50% | `bg-yellow-100` |
| 50-75% | `bg-orange-200` |
| > 75% | `bg-red-200` |

Los rangos son inclusivos en su límite inferior, exclusivos en el superior (excepto > 75% que incluye 100%).

### RF10 — Marcado mejor/peor

- Plato más fallado (mayor `veces`): borde `border-2 border-danger`
- Plato menos fallado con `veces > 0`: borde `border-2 border-success`
- Si hay empate en el máximo, se marca el de número más bajo
- Si solo hay un plato con fallos, solo se marca como "peor" (omitir "mejor" = menos fallado)

### RF11 — Resumen

Debajo del grid, mostrar:
- "Más fallados: X, Y, Z" — top 3 platos por `veces`, en rojo
- "Menos fallados: X, Y, Z" — bottom 3 platos con `veces > 0`, en verde
- Si hay menos de 3 platos con datos, mostrar solo los que haya

### RF12 — Visibilidad

El bloque se muestra si:
- `totalEntrenamientos() > 0` Y
- Hay al menos 1 fallo registrado en el año (el array de fallos no está vacío)

### UI — Estructura HTML

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

### UI — Estilos

```scss
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

---

## Cambios en el service

### Método nuevo: `getFallosByUserAndYear`

Se añade a `EntrenamientoService`. Ver RF7 para la implementación.

### Sin cambios en `getByUser` ni `getRankingAnual`

La evolución mensual reutiliza los datos existentes. Los años comparativos hacen llamadas adicionales a `getByUser` con años distintos.

---

## Casos borde

| Escenario | Comportamiento |
|---|---|
| 0 entrenamientos en el año | Ambos bloques ocultos |
| Entrenamientos pero 0 fallos registrados | Evolución visible, heatmap fallos oculto |
| Solo 1 mes con datos en el año | Evolución muestra un solo punto (sin línea) |
| Año comparativo sin datos | Línea no se renderiza, chip queda activo (sin puntos) |
| Cambio de `anioSeleccionado` | Recomputa todo + vacía `aniosComparativos` |
| Empate en plato más fallado | Se marca el de número más bajo |
| Solo 1 plato con fallos | Se marca como "peor", no se muestra "menos fallados" |
| 25 platos con 0 fallos (fallos vacío) | Bloque oculto (RF12) |

## No se incluye (fase futura)

- Cruce de fallos por esquema (qué platos falla más en cada esquema)
- Evolución de fallos en el tiempo (progresión mensual de fallos)
- Comparativa de fallos con la media del club
- Tooltip/hover sobre puntos del gráfico (requiere interactividad no trivial en SVG mobile)

## Archivos a tocar

- `src/app/features/perfil/perfil.component.ts` — nuevos signals, computeds y helpers
- `src/app/features/perfil/perfil.component.html` — reemplazar `perfil-grafico` + nuevo bloque fallos
- `src/app/features/perfil/perfil.component.scss` — estilos `.perfil-evolucion` y `.perfil-fallos`
- `src/app/features/admin/entrenamientos/entrenamiento.service.ts` — nuevo `getFallosByUserAndYear`

## Tests / verificación manual

1. Login como socio sin entrenamientos → ambos bloques NO visibles.
2. Login como socio con entrenamientos en varios meses → gráfico de evolución con puntos, línea conectando meses.
3. Activar chip de año anterior → segunda línea superpuesta con color distinto.
4. Activar 2 años → 3 líneas, intentar activar un 4º no hace nada.
5. Cambiar `anioSeleccionado` → chips comparativos se desactivan, datos recalculan.
6. Socio con fallos registrados → grid 5x5 coloreado, resumen de más/menos fallados.
7. Socio sin fallos → heatmap fallos oculto, evolución sí visible.
8. Login como admin → no ve ninguno de estos bloques.
