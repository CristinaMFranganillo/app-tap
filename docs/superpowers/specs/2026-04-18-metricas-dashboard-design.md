# Spec: Dashboard de Métricas del Tirador

**Fecha**: 2026-04-18
**Ruta**: `/metricas` (reemplaza `/perfil`)
**Componente**: `MetricasComponent`

---

## Contexto

El socio necesita un dashboard completo para analizar sus entrenamientos de foso olímpico y detectar patrones de mejora. La página reemplaza completamente el `PerfilComponent` actual. El bottom-nav ya muestra "Métricas" con `bi-graph-up` apuntando a `/perfil` — solo se cambia el `route`.

---

## Cambios en base de datos

No se requiere ninguna migración. El puesto de tiro (1-5) se deriva directamente del `numero_plato` ya existente en `entrenamiento_fallos`:

```typescript
const puestoTiro = Math.ceil(numeroPlato / 5); // 1-5 → P1, 6-10 → P2, etc.
```

---

## Arquitectura

### Ruta
- `/metricas` → `MetricasComponent` (lazy loaded)
- Eliminar `PerfilComponent` y su ruta `/perfil`
- Actualizar `bottom-nav` route de `/perfil` → `/metricas`
- Actualizar `app.routes.ts` y `admin.routes.ts` si referencian `/perfil`

### Servicio
Nuevo `metricas.service.ts` en `src/app/features/metricas/`. Centraliza todas las consultas. Los métodos existentes en `entrenamiento.service.ts` que solo usa el perfil se migran aquí:
- `getResultadosByUser(userId, year)` — ya existe en `entrenamiento.service.ts`
- `getFallosByUserAndYear(userId, year)` — ya existe, ampliar para incluir `puesto`
- `getRankingAnual(year)` — ya existe, se reutiliza para extraer media del club

### Consultas al iniciar (en paralelo)
```typescript
// Las tres se lanzan simultáneamente con forkJoin o Promise.all
getResultadosByUser(userId, year)      // platos rotos por sesión + esquema + fecha
getFallosByUserAndYear(userId, year)   // platos fallados + esquema (puesto se deriva: ceil(plato/5))
getRankingAnual(year)                  // solo para media del club
```

### Signals principales
```typescript
// Datos crudos
resultados = signal<ResultadoEntrenamientoConFecha[]>([])
fallos = signal<FalloConPuesto[]>([])
rankingAnual = signal<RankingEntrenamientoAnual[]>([])

// Filtros
anioSeleccionado = signal<number>(currentYear)
aniosComparativos = signal<number[]>([])        // máx 1 año adicional
esquemaSeleccionado = signal<number | null>(null)

// Computed
resultadosFiltrados = computed(...)   // filtra por esquemaSeleccionado si hay uno activo
fallosFiltrados = computed(...)       // ídem

// KPIs globales
mediaAnual = computed(...)
totalSesiones = computed(...)
mejorResultado = computed(...)
posicionClub = computed(...)
mediaClub = computed(...)
tendenciaVsAnioAnterior = computed(...)  // ▲▼ vs año anterior si hay datos

// Por bloque
evolucionMensual = computed(...)       // 12 medias [ene–dic] del socio
evolucionClubMensual = computed(...)   // 12 medias del club (referencia)
evolucionComparativa = computed(...)   // año adicional si existe

heatmapEsquemas = computed(...)        // [{ esquema, mediaPlatos, sesiones }] × 10
heatmapPlatos = computed(...)          // [{ plato, veces, totalDisparos }] × 25
analisisPuestos = computed(...)        // [{ puesto, mediaPlatos, fallosPorcentaje }] × 6

rachaActual = computed(...)            // sesiones consecutivas > media personal
consistencia = computed(...)           // desviación típica de resultados
tendenciaReciente = computed(...)      // últimas 5 sesiones [{ fecha, platos }]
```

---

## Secciones visuales (de arriba a abajo)

### 1. Header sticky — Selector de año
- Barra fija bajo el header principal de la app
- Año activo centrado con flechas `‹` `›` para cambiar
- Todos los bloques reaccionan reactivamente al cambiar el año

---

### 2. Resumen global — 4 KPIs en grid 2×2

| KPI | Valor | Detalle |
|-----|-------|---------|
| Media anual | X / 25 | ▲▼ vs año anterior |
| Total sesiones | N | — |
| Mejor resultado | X / 25 | fecha del mejor |
| Posición en club | #N | de M socios activos |

- Fondo `card` con sombra ligera
- Indicador ▲ verde / ▼ rojo para tendencia anual

---

### 3. Evolución temporal — Gráfico de línea SVG

- Eje X: meses (ene–dic), Eje Y: media de platos rotos (0–25)
- **Línea socio**: color `#FFAE00` (primary), trazo sólido
- **Línea media club**: color gris claro `#94A3B8`, trazo punteado
- **Línea año comparativo** (opcional): color `#60A5FA`, trazo sólido
- Botón `+año` para añadir comparativa (máx 1 año adicional)
- Puntos en cada mes con valor al hacer tap (tooltip)
- Si un mes no tiene datos, el punto se omite y la línea salta

---

### 4. Mapa de calor por esquema (1–10)

Grid de 10 celdas en 2 filas × 5 columnas.

Cada celda muestra:
- Número de esquema (grande, centrado)
- Media de platos rotos (ej. `18.4`)
- Número de sesiones (ej. `3s`)
- **Color de fondo** degradado por rendimiento:
  - Sin datos: gris neutro
  - Bajo (< 15): rojo `#EF4444` con opacidad
  - Medio (15–20): amarillo `#FFAE00` con opacidad
  - Alto (> 20): verde `#10B981` con opacidad

**Interacción**: tap en celda activa filtro global "Esquema X activo". Chip visible bajo el grid con × para quitar el filtro. El filtro afecta a los bloques 5 y 6.

---

### 5. Mapa de calor de platos (1–25)

Grid de 25 celdas en 5 columnas × 5 filas. Las columnas representan los 5 puestos de tiro.

- Platos 1–5 → columna puesto 1
- Platos 6–10 → columna puesto 2
- Platos 11–15 → columna puesto 3
- Platos 16–20 → columna puesto 4
- Platos 21–25 → columna puesto 5

Cada celda muestra:
- Número de plato
- Número de fallos (o `—` si 0)
- **Color**: blanco (0 fallos) → naranja → rojo oscuro (máximo fallos)

Cabecera de columna: `P1`, `P2`, `P3`, `P4`, `P5`.

Si hay esquema activo (filtro bloque 4): muestra solo fallos en ese esquema.

**Texto resumen debajo del grid** (generado automáticamente):
- "Tu punto más débil: puesto 3 (X fallos)"
- "Platos con más fallos: 12, 13, 17"
- Si 0 fallos: "¡Sin fallos registrados este año!"

**Tooltip al mantener pulsado**: "X fallos de Y disparos (Z%)"

---

### 6. Análisis por puesto (1–6)

Lista de 6 filas, una por puesto.

Cada fila:
- Etiqueta `Puesto N`
- Barra horizontal: media de platos rotos en ese puesto (color `#FFAE00`)
- Barra de referencia: media del club en ese puesto (gris punteado) — solo si disponible
- Indicador `★` en el puesto con mejor rendimiento personal
- Indicador `↓` en el puesto con peor rendimiento personal

Si el socio no tiene datos en un puesto: barra vacía con "Sin datos".

---

### 7. Racha y consistencia

Tres métricas en una card:

| Métrica | Descripción |
|---------|-------------|
| **Mejor racha** | X sesiones consecutivas por encima de tu media personal |
| **Consistencia** | Desviación típica de resultados. Texto: "Muy consistente / Regular / Variable" |
| **Tendencia reciente** | Mini sparkline SVG de las últimas 5 sesiones con sus valores |

---

## Estados vacíos

| Situación | Comportamiento |
|-----------|----------------|
| Sin sesiones en el año | Ilustración + "Aún no tienes entrenamientos registrados en YYYY" |
| Sin fallos registrados | Mensaje en bloque 5: "No hay fallos registrados — ¡gran trabajo!" |
| Año sin datos, año anterior sí | Chip sugerencia: "Ver YYYY-1 →" |
| Cargando | Skeleton loaders en cada bloque |

---

## Estados de carga

- Las tres consultas se lanzan en paralelo al iniciar
- Cada bloque tiene su propio skeleton mientras carga
- Si alguna consulta falla: mensaje de error inline en el bloque afectado, el resto sigue visible

---

## Diseño visual

- Sigue el sistema de diseño del proyecto: Tailwind + SCSS por componente
- Fuente: Inter (admin/perfil UI)
- Primary `#FFAE00` para elementos destacados y barras del socio
- Secondary `#002F86` con moderación
- Success `#10B981`, Error `#EF4444`
- Cada bloque es una `card` con padding y sombra ligera
- Mobile-first: grid 2×2 en KPIs, 5 col en heatmap platos, 2×5 en heatmap esquemas

---

## Archivos afectados

| Acción | Archivo |
|--------|---------|
| Crear | `src/app/features/metricas/metricas.component.ts` |
| Crear | `src/app/features/metricas/metricas.component.html` |
| Crear | `src/app/features/metricas/metricas.component.scss` |
| Crear | `src/app/features/metricas/metricas.service.ts` |
| Modificar | `src/app/shared/components/bottom-nav/bottom-nav.component.ts` (route `/perfil` → `/metricas`) |
| Modificar | `src/app/app.routes.ts` (añadir ruta `/metricas`, eliminar `/perfil`) |
| Eliminar | `src/app/features/perfil/` (componente completo) |

---

## Fuera de alcance

- Factores externos (viento, luz, temperatura)
- Comparativa con tiradores individuales (solo media anónima del club)
- Análisis por máquina (no se registra)
- Series granulares (solo total de platos rotos por sesión, no plato a plato en orden)
