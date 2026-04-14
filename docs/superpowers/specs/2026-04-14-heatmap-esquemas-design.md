# Heatmap de precisión por esquema — Diseño

**Fecha:** 2026-04-14
**Estado:** Aprobado por usuario

## Objetivo

Mostrar al socio en su perfil un heatmap visual con su precisión media en cada uno de los 7 esquemas del foso olímpico, durante el año seleccionado, para identificar fortalezas, debilidades y huecos de entrenamiento.

## Alcance

- **Quién lo ve:** únicamente el socio en su propio perfil (pestaña "Mis Entrenamientos").
- **No se aplica a:** admin/moderador (su perfil ya muestra contabilidad, no esta vista).
- **Año:** usa el `anioSeleccionado` que ya existe en el perfil. Cambiar de año recalcula automáticamente.
- **Sin nuevas tablas ni queries:** reutiliza el observable `entrenamientoService.getByUser(userId, year)` que ya alimenta `misEntrenamientos`.

## Requisitos funcionales

### RF1 — Reutilización de datos
El componente NO añade ninguna llamada a Supabase. Deriva el heatmap del signal `misEntrenamientos()` ya existente en `perfil.component.ts:105`, mediante un nuevo `computed` llamado `heatmapEsquemas`.

### RF2 — Cálculo
Para cada esquema 1..7:
- `sesiones` = nº de resultados con ese esquema en el año actual del socio
- `mediaPlatos` = `Math.round((sum/sesiones) * 10) / 10` (1 decimal). `null` si `sesiones === 0`
- `porcentaje` = `(mediaPlatos / 25) * 100` para colorear

Devuelve un array fijo de longitud 7 (siempre los 7 esquemas, incluyendo huecos).

### RF3 — Mejor / peor
Calcula:
- `mejorEsquema`: el de mayor `mediaPlatos` entre los que tienen `sesiones >= 1`
- `peorEsquema`: el de menor `mediaPlatos` entre los que tienen `sesiones >= 1`
- Si solo hay un esquema con datos, mejor === peor → mostrar solo "Mejor", omitir "Peor".
- Si no hay datos en ningún esquema, ambos son `null` y el bloque resumen no se muestra.

### RF4 — Color absoluto fijo
| Media platos | Clase Tailwind  |
|--------------|-----------------|
| `null` (sin datos) | `bg-neutral-100` |
| `< 10`       | `bg-red-200`    |
| `10-15`      | `bg-orange-200` |
| `16-19`      | `bg-yellow-200` |
| `20-22`      | `bg-green-200`  |
| `23-25`      | `bg-green-400`  |

Los rangos son inclusivos en su límite inferior y exclusivos en el superior excepto el último (`23-25` incluye 25).

### RF5 — Marcado mejor/peor (variante híbrida)
- Celda del mejor esquema: borde `border-2 border-success`
- Celda del peor esquema: borde `border-2 border-danger`
- Celdas neutras: `border border-neutral-200` (para mantener tamaño uniforme y evitar layout shift)

### RF6 — Visibilidad del bloque
Si `totalEntrenamientos() === 0` el bloque entero NO se renderiza (el `empty-state` global arriba ya cubre ese caso).

## UI

### Posición
Dentro de la rama `@else { (no es admin) }` de `perfil.component.html`, **después del bloque `perfil-grafico`** que renderiza el SVG de evolución, justo antes del cierre de `.perfil-entrena`.

### Estructura HTML (esquema)
```html
@if (totalEntrenamientos() > 0) {
  <div class="perfil-heatmap card">
    <p class="perfil-heatmap__titulo">Precisión por esquema</p>
    <div class="perfil-heatmap__grid">
      @for (celda of heatmapEsquemas(); track celda.esquema) {
        <div class="perfil-heatmap__celda" [class]="claseCelda(celda)">
          <span class="perfil-heatmap__num">{{ celda.esquema }}</span>
          @if (celda.mediaPlatos !== null) {
            <span class="perfil-heatmap__media">{{ celda.mediaPlatos }}</span>
            <span class="perfil-heatmap__sesiones">{{ celda.sesiones }}s</span>
          } @else {
            <span class="perfil-heatmap__media">—</span>
          }
        </div>
      }
    </div>
    @if (mejorEsquema(); as m) {
      <div class="perfil-heatmap__resumen">
        <p class="perfil-heatmap__linea perfil-heatmap__linea--mejor">
          <i class="bi bi-caret-up-fill"></i>
          Mejor: esquema {{ m.esquema }} ({{ m.mediaPlatos }}/25)
        </p>
        @if (peorEsquema(); as p) {
          @if (p.esquema !== m.esquema) {
            <p class="perfil-heatmap__linea perfil-heatmap__linea--peor">
              <i class="bi bi-caret-down-fill"></i>
              Peor: esquema {{ p.esquema }} ({{ p.mediaPlatos }}/25)
            </p>
          }
        }
      </div>
    }
  </div>
}
```

### Estilos
Bajo `// ── Heatmap esquemas ────` al final de `perfil.component.scss`:

```scss
.perfil-heatmap {
  @apply p-3 flex flex-col gap-2;

  &__titulo {
    @apply text-xs font-semibold text-neutral-400 uppercase tracking-[1.5px];
  }

  &__grid {
    @apply grid grid-cols-7 gap-1;
  }

  &__celda {
    @apply aspect-square flex flex-col items-center justify-center
           rounded-[8px] border border-neutral-200;

    &--mejor { @apply border-2 border-success; }
    &--peor  { @apply border-2 border-danger; }
  }

  &__num      { @apply text-[10px] font-semibold text-neutral-400 leading-none; }
  &__media    { @apply text-base font-bold text-secondary leading-none mt-0.5; }
  &__sesiones { @apply text-[9px] text-neutral-400 font-medium leading-none; }

  &__resumen { @apply flex flex-col gap-0.5 mt-1; }
  &__linea {
    @apply text-[12px] font-medium flex items-center gap-1;
    &--mejor { @apply text-success; }
    &--peor  { @apply text-danger; }
  }
}
```

### Helpers en TypeScript
```ts
heatmapEsquemas = computed(() => {
  const list = this.misEntrenamientos();
  const buckets = new Map<number, number[]>();
  for (let e = 1; e <= 7; e++) buckets.set(e, []);
  for (const r of list) {
    if (r.esquema && r.esquema >= 1 && r.esquema <= 7) {
      buckets.get(r.esquema)!.push(r.platosRotos);
    }
  }
  return Array.from(buckets.entries()).map(([esquema, arr]) => {
    if (arr.length === 0) return { esquema, sesiones: 0, mediaPlatos: null };
    const sum = arr.reduce((a, b) => a + b, 0);
    return {
      esquema,
      sesiones: arr.length,
      mediaPlatos: Math.round((sum / arr.length) * 10) / 10,
    };
  });
});

mejorEsquema = computed(() => {
  const con = this.heatmapEsquemas().filter(c => c.mediaPlatos !== null);
  if (con.length === 0) return null;
  return con.reduce((max, c) => c.mediaPlatos! > max.mediaPlatos! ? c : max);
});

peorEsquema = computed(() => {
  const con = this.heatmapEsquemas().filter(c => c.mediaPlatos !== null);
  if (con.length === 0) return null;
  return con.reduce((min, c) => c.mediaPlatos! < min.mediaPlatos! ? c : min);
});

claseCelda(celda: { esquema: number; sesiones: number; mediaPlatos: number | null }): string {
  const classes: string[] = ['perfil-heatmap__celda'];
  const m = celda.mediaPlatos;
  if (m === null) classes.push('bg-neutral-100');
  else if (m < 10) classes.push('bg-red-200');
  else if (m < 16) classes.push('bg-orange-200');
  else if (m < 20) classes.push('bg-yellow-200');
  else if (m < 23) classes.push('bg-green-200');
  else classes.push('bg-green-400');

  const mejor = this.mejorEsquema();
  const peor  = this.peorEsquema();
  if (mejor && celda.esquema === mejor.esquema) classes.push('perfil-heatmap__celda--mejor');
  else if (peor && peor.esquema !== mejor?.esquema && celda.esquema === peor.esquema) {
    classes.push('perfil-heatmap__celda--peor');
  }
  return classes.join(' ');
}
```

## Casos borde

| Escenario | Comportamiento |
|---|---|
| 0 entrenamientos en el año | Bloque oculto |
| 1 entrenamiento (1 esquema) | Heatmap mostrado, "Mejor" mostrado, "Peor" omitido |
| Resultado con `esquema` undefined | Ignorado (no cuenta para ningún bucket) |
| Resultado con `esquema` fuera de 1-7 | Ignorado |
| Cambio de año (signal) | `heatmapEsquemas` recomputa automáticamente |

## No se incluye (fase 2 si se pide)

- Comparativa con la media del club por esquema
- Hover/click sobre celda para abrir detalle
- Heatmap por mes×año o calendario tipo GitHub
- Versión para admin/moderador (su perfil tiene contabilidad)

## Archivos a tocar

- `src/app/features/perfil/perfil.component.ts` — añadir 3 computed + 1 helper
- `src/app/features/perfil/perfil.component.html` — añadir bloque heatmap dentro de la rama socio
- `src/app/features/perfil/perfil.component.scss` — añadir estilos `.perfil-heatmap`

## Tests / verificación manual

1. Login como socio sin entrenamientos → bloque NO visible.
2. Login como socio con entrenamientos en 2-3 esquemas distintos → ver celdas coloreadas + mejor/peor marcados.
3. Cambiar año → recomputo y refresco visible.
4. Login como admin → no ve este bloque (sigue viendo la pestaña admin).
