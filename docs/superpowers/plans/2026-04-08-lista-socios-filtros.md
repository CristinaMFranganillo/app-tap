# Lista Socios — Filtros y Orden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir formato `Apellidos, Nombre` en la tabla de socios, panel de filtros colapsable (favoritos, cuota, orden alfabético) y mensaje especial cuando no hay temporada activa.

**Architecture:** Todo el estado de filtros vive como signals individuales en `ListaSociosComponent`. El computed `filteredSocios` ya existente se amplía para consumir esos signals. El template añade un botón toggle y un panel `@if` con los controles de filtro.

**Tech Stack:** Angular 17+ (signals, `@if`, `@for`), Tailwind CSS via clases utilitarias, Bootstrap Icons.

---

## Archivos afectados

| Archivo | Acción |
|---------|--------|
| `src/app/features/admin/socios/lista-socios/lista-socios.component.ts` | Modificar — nuevos signals + lógica computed |
| `src/app/features/admin/socios/lista-socios/lista-socios.component.html` | Modificar — botón toggle, panel filtros, formato nombre |
| `src/app/features/admin/socios/lista-socios/lista-socios.component.scss` | Modificar — estilos panel, toggle, pills, checkboxes |

---

## Task 1: Cambiar formato de nombre en la tarjeta

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.html:26`

- [ ] **Step 1: Cambiar el interpolado del nombre**

Localizar la línea:
```html
<p class="socio-item__nombre">{{ socio.nombre }} {{ socio.apellidos }}</p>
```

Reemplazar por:
```html
<p class="socio-item__nombre">{{ socio.apellidos }}, {{ socio.nombre }}</p>
```

- [ ] **Step 2: Verificar visualmente en el navegador**

Arrancar el servidor si no está corriendo:
```bash
cd frontend && npm run dev
```
Navegar a `http://localhost:5173/generador-scorm/` → sección Socios.  
Esperado: cada tarjeta muestra `García López, Juan` en lugar de `Juan García López`.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/socios/lista-socios/lista-socios.component.html
git commit -m "feat(socios): mostrar nombre como 'Apellidos, Nombre' en lista"
```

---

## Task 2: Añadir signals de filtro en el componente `.ts`

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`

- [ ] **Step 1: Añadir los nuevos signals**

En la clase `ListaSociosComponent`, debajo de `searchTerm = signal('');`, añadir:

```ts
showFilters = signal(false);
filterFavoritos = signal(false);
filterCuota = signal<'todas' | 'pagada' | 'no-pagada'>('todas');
sortAlfa = signal(false);
```

- [ ] **Step 2: Añadir computed `sinTemporada`**

Debajo de los nuevos signals, antes de `filteredSocios`, añadir:

```ts
sinTemporada = computed(() => {
  if (this.filterCuota() === 'todas') return false;
  const list = this.socios();
  return list.length > 0 && list.every(s => s.cuotaPagada === undefined);
});
```

- [ ] **Step 3: Actualizar el computed `filteredSocios`**

Reemplazar el computed `filteredSocios` existente por completo:

```ts
filteredSocios = computed(() => {
  const term = this.searchTerm().toLowerCase();
  let list = this.socios();

  // Filtro por texto
  if (term) {
    list = list.filter(s =>
      s.nombre.toLowerCase().includes(term) ||
      s.apellidos.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.numeroSocio.includes(term)
    );
  }

  // Filtro favoritos
  if (this.filterFavoritos()) {
    list = list.filter(s => s.favorito);
  }

  // Filtro cuota
  const cuota = this.filterCuota();
  if (cuota === 'pagada') {
    list = list.filter(s => s.cuotaPagada === true);
  } else if (cuota === 'no-pagada') {
    list = list.filter(s => s.cuotaPagada === false);
  }

  // Ordenación
  return [...list].sort((a, b) => {
    if (this.sortAlfa()) {
      return a.apellidos.localeCompare(b.apellidos, 'es');
    }
    if (a.favorito === b.favorito) return 0;
    return a.favorito ? -1 : 1;
  });
});
```

- [ ] **Step 4: Verificar que compila sin errores**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/admin/socios/lista-socios/lista-socios.component.ts
git commit -m "feat(socios): añadir signals de filtro y actualizar computed filteredSocios"
```

---

## Task 3: Añadir botón toggle y panel de filtros en el template

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.html`

- [ ] **Step 1: Añadir botón toggle debajo del buscador**

Después del cierre del `<div class="lista-socios__search">` (línea 12), insertar:

```html
<button
  (click)="showFilters.set(!showFilters())"
  class="lista-socios__filtros-toggle"
>
  <i class="bi bi-sliders"></i>
  {{ showFilters() ? 'Ocultar filtros' : 'Mostrar filtros' }}
</button>
```

- [ ] **Step 2: Añadir panel de filtros colapsable**

Inmediatamente después del botón toggle, insertar:

```html
@if (showFilters()) {
  <div class="lista-socios__filtros-panel">

    <label class="filtro-row">
      <input
        type="checkbox"
        [checked]="filterFavoritos()"
        (change)="filterFavoritos.set(!filterFavoritos())"
      />
      <span>Solo favoritos</span>
    </label>

    <div class="filtro-row filtro-row--pills">
      <span class="filtro-label">Cuota</span>
      <div class="filtro-pills">
        <button
          class="filtro-pill"
          [class.filtro-pill--active]="filterCuota() === 'todas'"
          (click)="filterCuota.set('todas')"
        >Todas</button>
        <button
          class="filtro-pill"
          [class.filtro-pill--active]="filterCuota() === 'pagada'"
          (click)="filterCuota.set('pagada')"
        >Pagadas</button>
        <button
          class="filtro-pill"
          [class.filtro-pill--active]="filterCuota() === 'no-pagada'"
          (click)="filterCuota.set('no-pagada')"
        >Pendientes</button>
      </div>
    </div>

    <label class="filtro-row">
      <input
        type="checkbox"
        [checked]="sortAlfa()"
        (change)="sortAlfa.set(!sortAlfa())"
      />
      <span>Orden alfabético</span>
    </label>

  </div>
}
```

- [ ] **Step 3: Actualizar el mensaje de lista vacía**

Localizar:
```html
@if (filteredSocios().length === 0) {
  <p class="lista-socios__empty">No se encontraron socios.</p>
}
```

Reemplazar por:
```html
@if (sinTemporada()) {
  <p class="lista-socios__empty">No hay temporada de pago activa.</p>
} @else if (filteredSocios().length === 0) {
  <p class="lista-socios__empty">No se encontraron socios.</p>
}
```

- [ ] **Step 4: Verificar en el navegador**

- Abrir la lista de socios.
- Pulsar "Mostrar filtros" → aparece el panel.
- Pulsar "Ocultar filtros" → se oculta.
- Marcar "Solo favoritos" → la lista se filtra.
- Seleccionar "Pagadas" → solo socios con cuota pagada.
- Marcar "Orden alfabético" → lista ordenada por apellidos.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/admin/socios/lista-socios/lista-socios.component.html
git commit -m "feat(socios): añadir panel de filtros colapsable en lista"
```

---

## Task 4: Añadir estilos del panel de filtros

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.scss`

- [ ] **Step 1: Añadir estilos al final del archivo**

Añadir al final de `lista-socios.component.scss`:

```scss
.lista-socios__filtros-toggle {
  @apply flex items-center gap-1 text-[11px] font-semibold text-gray-400 ml-auto mb-2;

  i {
    @apply text-[13px];
  }
}

.lista-socios__filtros-panel {
  @apply bg-white rounded-[10px] shadow-sm px-3 py-2 mb-3 flex flex-col gap-3;
}

.filtro-row {
  @apply flex items-center gap-2 text-[13px] font-medium text-brand-dark cursor-pointer;

  input[type='checkbox'] {
    @apply w-4 h-4 accent-amber-500 cursor-pointer flex-shrink-0;
  }

  &--pills {
    @apply flex items-center justify-between cursor-default;
  }
}

.filtro-label {
  @apply text-[12px] font-semibold text-gray-400 uppercase tracking-wide;
}

.filtro-pills {
  @apply flex gap-1;
}

.filtro-pill {
  @apply text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 transition-colors duration-100;

  &--active {
    @apply bg-amber-50 text-amber-700;
  }
}
```

- [ ] **Step 2: Verificar visualmente**

- El botón "Mostrar filtros" aparece alineado a la derecha, pequeño y discreto.
- El panel abierto tiene fondo blanco, bordes redondeados y sombra sutil.
- Las pills de cuota cambian de gris a ámbar al seleccionarlas.
- Los checkboxes tienen color ámbar al marcarse.

- [ ] **Step 3: Commit final**

```bash
git add src/app/features/admin/socios/lista-socios/lista-socios.component.scss
git commit -m "feat(socios): estilos panel filtros, pills y toggle"
```

---

## Self-Review

**Cobertura del spec:**
- [x] `Apellidos, Nombre` en tarjeta → Task 1
- [x] `showFilters` toggle → Task 2 (signal) + Task 3 (template)
- [x] Filtro favoritos → Task 2 + Task 3
- [x] Filtro cuota pagada/no-pagada → Task 2 + Task 3
- [x] Orden alfabético por apellidos → Task 2 + Task 3
- [x] Mensaje sin temporada activa → Task 2 (`sinTemporada`) + Task 3
- [x] Estilos → Task 4

**Tipos consistentes:**
- `filterCuota` tipado como `'todas' | 'pagada' | 'no-pagada'` — consistente entre Task 2 y Task 3.
- `sinTemporada` computed definido en Task 2, usado en Task 3.
- `sortAlfa`, `filterFavoritos`, `showFilters` — signals booleanos, usados con `.set(!x())` en template.

**Sin placeholders:** verificado.
