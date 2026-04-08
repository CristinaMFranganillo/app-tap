# Diseño: Filtros y orden en lista de socios

**Fecha:** 2026-04-08  
**Componente:** `lista-socios`

---

## Contexto

El componente `ListaSociosComponent` muestra una lista de socios con búsqueda por texto. Se añade:

1. Formato de nombre cambiado a `Apellidos, Nombre`
2. Panel de filtros colapsable (Mostrar/Ocultar filtros)
3. Filtro por favoritos
4. Filtro por estado de cuota (todas / pagada / pendiente)
5. Opción de orden alfabético por apellidos

---

## 1. Cambios en el componente `.ts`

### Nuevos signals

```ts
showFilters = signal(false);
filterFavoritos = signal(false);
filterCuota = signal<'todas' | 'pagada' | 'no-pagada'>('todas');
sortAlfa = signal(false);
```

### Lógica `filteredSocios` actualizada

El computed aplica en orden:

1. Filtro por texto (búsqueda — sin cambios)
2. Si `filterFavoritos()` es `true` → solo socios con `favorito === true`
3. Si `filterCuota()` es `'pagada'` → solo socios con `cuotaPagada === true`  
   Si `filterCuota()` es `'no-pagada'` → solo socios con `cuotaPagada === false`  
   (socios con `cuotaPagada === undefined` quedan excluidos en ambos casos)
4. Ordenación:
   - Si `sortAlfa()` → ordenar por `apellidos` alfabéticamente (reemplaza el orden por favoritos)
   - Si no → orden actual: favoritos primero, luego el resto

### Mensaje sin temporada activa

Cuando `filterCuota()` no es `'todas'` y todos los socios de la lista base tienen `cuotaPagada === undefined`, el computed devuelve una lista vacía y se activa una señal/computed `sinTemporada` que muestra el mensaje especial en el template.

---

## 2. Template HTML

### Botón toggle de filtros

Debajo del buscador, antes del header de socios:

```html
<button (click)="showFilters.set(!showFilters())" class="lista-socios__filtros-toggle">
  <i class="bi bi-sliders"></i>
  {{ showFilters() ? 'Ocultar filtros' : 'Mostrar filtros' }}
</button>
```

### Panel de filtros (colapsable con `@if`)

```html
@if (showFilters()) {
  <div class="lista-socios__filtros-panel">
    <!-- Favoritos -->
    <label class="filtro-row">
      <input type="checkbox" [(ngModel)]="..." />
      Solo favoritos
    </label>

    <!-- Cuota -->
    <div class="filtro-row filtro-row--pills">
      <span class="filtro-label">Cuota</span>
      <div class="filtro-pills">
        <button [class.active]="filterCuota() === 'todas'" (click)="filterCuota.set('todas')">Todas</button>
        <button [class.active]="filterCuota() === 'pagada'" (click)="filterCuota.set('pagada')">Pagadas</button>
        <button [class.active]="filterCuota() === 'no-pagada'" (click)="filterCuota.set('no-pagada')">Pendientes</button>
      </div>
    </div>

    <!-- Orden -->
    <label class="filtro-row">
      <input type="checkbox" [(ngModel)]="..." />
      Orden alfabético
    </label>
  </div>
}
```

### Nombre en la tarjeta

Cambiar solo en `.socio-item__nombre` dentro del `@for`:

```html
<!-- antes -->
{{ socio.nombre }} {{ socio.apellidos }}

<!-- después -->
{{ socio.apellidos }}, {{ socio.nombre }}
```

### Mensaje sin temporada activa

Cuando `sinTemporada()` es `true`:

```html
<p class="lista-socios__empty">No hay temporada de pago activa.</p>
```

---

## 3. Estilos `.scss`

- **Panel de filtros**: mismo card base que el buscador (`bg-white rounded-[10px] shadow-sm px-3 py-2 mb-3`)
- **Botón toggle**: `text-[11px] text-gray-400`, alineado a la derecha, con icono `bi-sliders`
- **Pills de cuota**: inactivo gris, activo `bg-amber-50 text-amber-700` (consistente con botón Temporadas)
- **Checkboxes**: nativos con label, sin librerías

---

## Decisiones tomadas

| Decisión | Motivo |
|----------|--------|
| `Apellidos, Nombre` solo en tarjeta de listado | El diálogo de confirmación de cuota conserva el formato original |
| `cuotaPagada === undefined` excluido del filtro cuota | No tiene sentido mostrar socios sin temporada en filtros pagada/pendiente |
| Orden alfabético reemplaza orden por favoritos | El usuario lo confirma explícitamente |
| Panel debajo del buscador, no drawer/modal | Más simple y coherente con la UI actual |
| Signals individuales, no objeto `filters` | Coherente con el patrón del componente, sin sobrediseño |
