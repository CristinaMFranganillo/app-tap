# Spec: Entrenamientos para socios en /scores

**Fecha:** 2026-04-08

## Objetivo

Los socios pueden ver desde la sección "Entrena" (ruta `/scores`) los entrenamientos en los que han participado, con su resultado y los platos que fallaron. Es una vista de solo lectura, personal (solo sus datos).

## Arquitectura

Se introduce un componente contenedor `scores-shell` que envuelve las tres secciones de la pantalla de scores mediante pestañas y un `<router-outlet>`. Las rutas existentes `/scores` y `/scores/historial` pasan a ser hijas de este shell. Se añade una tercera ruta hija `/scores/entrenamientos`.

```
/scores                         → scores-shell (contenedor con tabs)
  /scores                       → scores-ranking (tab Ranking, por defecto)
  /scores/historial             → scores-historial (tab Historial)
  /scores/entrenamientos        → entrenamiento-socio-lista (tab Entrenamientos, nuevo)
  /scores/entrenamientos/:escuadraId → entrenamiento-socio-detalle (nuevo, sin tab)
```

## Componentes

### `scores-shell` (nuevo)
- Contenedor con header "Entrena" y 3 tabs: Ranking / Historial / Entrenamientos
- Usa `routerLinkActive` para marcar el tab activo
- Contiene `<router-outlet>` para renderizar el hijo activo

### `entrenamiento-socio-lista` (nuevo, `/scores/entrenamientos`)
- Carga `EntrenamientoService.getByUser(userId, añoActual)` con el usuario logueado
- Muestra lista de tarjetas ordenadas por fecha descendente
- Cada tarjeta: fecha del entrenamiento + resultado `platosRotos/25`
- Al pulsar una tarjeta navega a `/scores/entrenamientos/:escuadraId` pasando `fecha` y `platosRotos` como query params
- Empty state si no hay entrenamientos: "Sin entrenamientos registrados"

### `entrenamiento-socio-detalle` (nuevo, `/scores/entrenamientos/:escuadraId`)
- Lee `escuadraId` de params, `fecha` y `platosRotos` de query params
- Carga `EntrenamientoService.getFallosByEscuadra(escuadraId)` y filtra en cliente por `userId` del socio
- Muestra: fecha, resultado `platosRotos/25`, y pills rojas con los números de plato fallados (mismo estilo que vista admin)
- Si no hay fallos registrados: mensaje "Sin fallos registrados"
- Botón atrás a `/scores/entrenamientos`

## Datos

No se necesitan métodos nuevos en `EntrenamientoService`. Los métodos existentes cubren todo:
- `getByUser(userId, year)` → lista con `escuadraId`, `fecha`, `platosRotos`
- `getFallosByEscuadra(escuadraId)` → filtrado por `userId` en cliente

El año es siempre el actual. Sin selector de año.

## Estilo

- Pills de fallos: mismo estilo `.fallo-pill` ya definido en `detalle-entrenamiento`
- Tabs: `routerLinkActive` con clase activa, estilo coherente con el resto de la app
- Tarjetas de lista: clase `card` existente

## Lo que NO se incluye

- Ver resultados de compañeros de escuadra
- Selector de año
- Edición de ningún dato
