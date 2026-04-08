# Favoritos de Socios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir marcar socios como favoritos (global para todos los admins), mostrando una estrella amarilla en la lista de socios y priorizándolos primero en los selectores de escuadra.

**Architecture:** Se añade una columna `favorito boolean DEFAULT false` a `profiles`. El `UserService` expone `toggleFavorito()`. La lista de socios muestra una estrella pulsable y ordena favoritos primero. Los dos componentes de escuadra reordenan su lista de socios para mostrar favoritos antes del resto alfabético.

**Tech Stack:** Angular 17+ signals, Supabase (PostgreSQL + RLS), SCSS con Tailwind utility classes.

---

## Archivos a modificar/crear

| Acción | Archivo |
|--------|---------|
| Crear | `supabase/migrations/011_favorito_socio.sql` |
| Modificar | `src/app/core/models/user.model.ts` |
| Modificar | `src/app/features/admin/socios/user.service.ts` |
| Modificar | `src/app/features/admin/socios/lista-socios/lista-socios.component.html` |
| Modificar | `src/app/features/admin/socios/lista-socios/lista-socios.component.ts` |
| Modificar | `src/app/features/admin/socios/lista-socios/lista-socios.component.scss` |
| Modificar | `src/app/features/admin/scores/form-escuadra/form-escuadra.component.ts` |
| Modificar | `src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.ts` |

---

## Task 1: Migration SQL — columna `favorito` en `profiles`

**Files:**
- Create: `supabase/migrations/011_favorito_socio.sql`

- [ ] **Step 1: Crear el archivo de migration**

```sql
-- supabase/migrations/011_favorito_socio.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorito boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Aplicar en Supabase**

Ir al SQL Editor del dashboard de Supabase y ejecutar:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorito boolean NOT NULL DEFAULT false;
```
Verificar que la columna aparece en la tabla `profiles`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/011_favorito_socio.sql
git commit -m "feat(socios): add favorito column to profiles"
```

---

## Task 2: Modelo y UserService

**Files:**
- Modify: `src/app/core/models/user.model.ts`
- Modify: `src/app/features/admin/socios/user.service.ts`

- [ ] **Step 1: Añadir `favorito` al modelo User**

En `src/app/core/models/user.model.ts`, añadir el campo al interface `User`:

```typescript
export interface User {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  numeroSocio: string;
  avatarUrl?: string;
  rol: UserRole;
  fechaAlta: Date;
  activo: boolean;
  firstLogin: boolean;
  dni?: string;
  telefono?: string;
  direccion?: string;
  localidad: string;
  cuotaPagada?: boolean;
  cuotaId?: string;
  favorito: boolean;        // ← nuevo
}
```

- [ ] **Step 2: Leer `favorito` en `toUser()` del UserService**

En `src/app/features/admin/socios/user.service.ts`, en la función `toUser()`, añadir la línea marcada:

```typescript
function toUser(row: Record<string, unknown>): User {
  const cuotaRows = (row['cuotas'] as Record<string, unknown>[] | null) ?? [];
  const cuota = cuotaRows[0] ?? null;

  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    apellidos: row['apellidos'] as string,
    email: (row['email'] as string) ?? '',
    numeroSocio: row['numero_socio'] as string,
    avatarUrl: (row['avatar_url'] as string) ?? undefined,
    rol: row['rol'] as UserRole,
    fechaAlta: new Date(row['fecha_alta'] as string),
    activo: row['activo'] as boolean,
    firstLogin: (row['first_login'] as boolean) ?? true,
    dni: (row['dni'] as string) ?? undefined,
    telefono: (row['telefono'] as string) ?? undefined,
    direccion: (row['direccion'] as string) ?? undefined,
    localidad: (row['localidad'] as string) ?? '',
    cuotaPagada: cuota ? (cuota['pagada'] as boolean) : undefined,
    cuotaId: cuota ? (cuota['id'] as string) : undefined,
    favorito: (row['favorito'] as boolean) ?? false,   // ← nuevo
  };
}
```

- [ ] **Step 3: Añadir `toggleFavorito()` al UserService**

En `src/app/features/admin/socios/user.service.ts`, añadir este método dentro de la clase `UserService`, después de `toggleActivo()`:

```typescript
async toggleFavorito(id: string): Promise<void> {
  const user = this.getById(id);
  if (!user) return;
  const nuevoValor = !user.favorito;
  const { error } = await supabase
    .from('profiles')
    .update({ favorito: nuevoValor })
    .eq('id', id);
  if (error) throw new Error(error.message);
  const current = this.cache.getValue();
  this.cache.next(current.map(u => u.id === id ? { ...u, favorito: nuevoValor } : u));
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/core/models/user.model.ts src/app/features/admin/socios/user.service.ts
git commit -m "feat(socios): add favorito field to User model and UserService.toggleFavorito"
```

---

## Task 3: Estrella en lista de socios

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.html`
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.scss`

- [ ] **Step 1: Añadir botón estrella en el template**

En `lista-socios.component.html`, dentro de `<div class="socio-item__row">`, añadir el botón de estrella justo antes de `<div class="socio-item__actions">`:

```html
<button
  (click)="toggleFavorito(socio, $event)"
  class="socio-item__favorito-btn"
  [title]="socio.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'"
>
  <i class="bi" [class.bi-star-fill]="socio.favorito" [class.bi-star]="!socio.favorito"></i>
</button>
```

- [ ] **Step 2: Añadir método `toggleFavorito` y ordenar favoritos primero en el componente**

En `lista-socios.component.ts`, añadir el método `toggleFavorito()` y modificar `filteredSocios` para que los favoritos aparezcan primero:

```typescript
// Reemplazar el computed filteredSocios existente:
filteredSocios = computed(() => {
  const term = this.searchTerm().toLowerCase();
  let list = this.socios();
  if (term) {
    list = list.filter(s =>
      s.nombre.toLowerCase().includes(term) ||
      s.apellidos.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.numeroSocio.includes(term)
    );
  }
  return [...list].sort((a, b) => {
    if (a.favorito === b.favorito) return 0;
    return a.favorito ? -1 : 1;
  });
});

// Añadir el método:
async toggleFavorito(socio: User, event: Event): Promise<void> {
  event.stopPropagation();
  await this.userService.toggleFavorito(socio.id);
  this.refresh$.next();
}
```

- [ ] **Step 3: Añadir estilos de la estrella**

En `lista-socios.component.scss`, añadir al final:

```scss
.socio-item__favorito-btn {
  @apply flex items-center justify-center p-1 text-gray-300 text-[18px];

  .bi-star-fill {
    color: #FFAE00;
  }
}
```

- [ ] **Step 4: Verificar en el navegador**

- La estrella gris aparece junto a cada socio
- Al pulsarla se vuelve amarilla y el socio sube al principio de la lista
- Al pulsarla de nuevo vuelve a gris y el socio vuelve al orden normal

- [ ] **Step 5: Commit**

```bash
git add src/app/features/admin/socios/lista-socios/
git commit -m "feat(socios): add favorito star toggle in lista-socios, sort favorites first"
```

---

## Task 4: Favoritos primero en selectores de escuadra

**Files:**
- Modify: `src/app/features/admin/scores/form-escuadra/form-escuadra.component.ts`
- Modify: `src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.ts`

- [ ] **Step 1: Actualizar ordenación en `form-escuadra.component.ts`**

Reemplazar el bloque `.sort()` en el `toSignal` de `socios`:

```typescript
socios = toSignal(
  this.userService.getAll().pipe(
    map(users => users
      .filter(u => u.activo && u.rol !== 'admin')
      .sort((a, b) => {
        if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
        return `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es');
      })
    )
  ),
  { initialValue: [] as User[] }
);
```

- [ ] **Step 2: Actualizar ordenación en `form-escuadra-entrenamiento.component.ts`**

El mismo cambio en el `toSignal` de `socios`:

```typescript
socios = toSignal(
  this.userService.getAll().pipe(
    map(users => users
      .filter(u => u.activo && u.rol !== 'admin')
      .sort((a, b) => {
        if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
        return `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es');
      })
    )
  ),
  { initialValue: [] as User[] }
);
```

- [ ] **Step 3: Verificar en el navegador**

- Abrir el formulario de nueva escuadra (scores o entrenamiento)
- Los socios marcados como favoritos aparecen al inicio de cada dropdown

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/scores/form-escuadra/form-escuadra.component.ts
git add src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.ts
git commit -m "feat(escuadras): sort favorite socios first in escuadra selectors"
```
