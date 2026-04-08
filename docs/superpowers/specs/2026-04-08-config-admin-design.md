# Spec: Pantalla Config para administrador

**Fecha:** 2026-04-08

## Objetivo

El administrador no participa en entrenamientos ni competiciones, por lo que la pantalla `/perfil` ("Config") actual le muestra una sección vacía de entrenamientos. Se reemplaza esa sección por información útil del club: resumen de socios, estado de cuotas, actividad de entrenamientos reciente y accesos rápidos.

## Bifurcación por rol

`perfil.component.ts` ya dispone de `user = toSignal(authService.currentUser$)`. El template usa `@if (esAdmin())` para renderizar contenido diferente. Los socios siguen viendo exactamente lo que ven ahora.

```ts
esAdmin = computed(() => {
  const rol = this.user()?.rol;
  return rol === 'admin' || rol === 'moderador';
});
```

## Estructura de la pantalla para admin

1. **Hero** — avatar, nombre, rol, número de socio. Botón "Cambiar foto". Igual que ahora.
2. **Resumen del club** — 3 stat cards en fila horizontal:
   - **Socios activos**: count de socios con `activo === true`
   - **Cuota pagada**: `X%` de socios activos con `cuotaPagada === true`. Si ningún socio tiene `cuotaPagada` definida (sin temporada activa), muestra "—" con texto secundario "Sin temporada"
   - **Este mes**: número de entrenamientos registrados en el mes y año actuales
3. **Últimos entrenamientos** — lista de los 5 entrenamientos más recientes, cada uno con fecha y número de tiradores. Si no hay ninguno, muestra empty state "Sin entrenamientos registrados".
4. **Accesos rápidos** — dos botones que navegan a `/admin/socios` y `/admin/temporadas`
5. **Cerrar sesión** — igual que ahora

## Datos y signals

No se necesitan métodos nuevos en los servicios.

```ts
// Cargar datos solo si es admin
private socios = toSignal(userService.getAll(), { initialValue: [] });
private entrenamientos = toSignal(entrenamientoService.getAll(), { initialValue: [] });

sociosActivos = computed(() => this.socios().filter(s => s.activo));
totalActivos = computed(() => this.sociosActivos().length);

cuotaPct = computed(() => {
  const activos = this.sociosActivos();
  if (activos.length === 0) return null;
  if (activos.every(s => s.cuotaPagada === undefined)) return null; // sin temporada
  const pagados = activos.filter(s => s.cuotaPagada === true).length;
  return Math.round((pagados / activos.length) * 100);
});

entrenamientosMes = computed(() => {
  const hoy = new Date();
  return this.entrenamientos().filter(e => {
    const d = new Date(e.fecha);
    return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
  }).length;
});

ultimos5 = computed(() =>
  this.entrenamientos().slice(0, 5) // getAll() ya devuelve orden desc
);
```

## Estilo

- Stat cards: misma clase `perfil-stat` existente, reutilizando el bloque `perfil-stats`
- Lista de entrenamientos: clase `card` existente, filas simples con fecha + badge de tiradores
- Accesos rápidos: dos botones `btn-primary` / `btn-secondary` en fila

## Lo que NO se incluye

- Gráficos o estadísticas de rendimiento (no aplica al admin)
- Edición de datos del club desde esta pantalla
- Métricas de competiciones (ya accesibles desde Entrena)
