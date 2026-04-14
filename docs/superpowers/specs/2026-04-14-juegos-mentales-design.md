# Echa un rato — Spec de Diseño

## Objetivo

Crear una sección "Echa un rato" accesible desde la home del socio con 3 minijuegos: el existente "Rompe Platos" y 2 nuevos (Test de Reflejos y ¿Izquierda o Derecha?). Los juegos entrenan agilidad visual, tiempo de reacción y decisión lateral rápida. Las partidas se persisten en Supabase con ranking del club.

## Arquitectura

- Nueva ruta `/juegos` como hub con 3 tarjetas de juego + ranking
- Subrutas `/juegos/reflejos` y `/juegos/lateralidad` para los juegos nuevos
- "Rompe Platos" en el hub enlaza a `/juego` (ruta existente, sin cambios)
- Tarjeta de la home del socio se reemplaza: "Rompe Platos" → "Echa un rato" → `/juegos`
- Tabla `juegos_scores` en Supabase para persistencia y ranking

## Componentes nuevos

### JuegosHubComponent (`/juegos`)

- Grid vertical de 3 tarjetas: icono, nombre, descripción, mejor marca personal
- Cada tarjeta navega a la ruta del juego correspondiente
- Debajo de las tarjetas: ranking top 5 del club (por defecto muestra Test de Reflejos)
- Chips para cambiar el ranking entre los 3 juegos
- Ranking muestra: posición, nombre del socio, valor (ms o platos)
- Si el usuario está en el ranking, su fila se resalta

### ReflejosComponent (`/juegos/reflejos`)

**Mecánica:** Test go clásico — 5 rondas, mide tiempo de reacción puro.

**Estados de pantalla:**

1. **Intro** — nombre del juego, instrucciones breves ("Toca la pantalla cuando aparezca el plato"), botón "Empezar"
2. **Espera** — fondo gris oscuro (#374151), plato fantasma (opacidad baja), texto "Espera...", indicador de ronda (N/5). Duración aleatoria entre 1000ms y 4000ms
3. **Plato** — fondo verde (#10B981), plato grande centrado, texto "¡TOCA!". Toda la pantalla es zona táctil
4. **Falso positivo** — si el usuario toca durante el estado Espera, se muestra brevemente "¡Demasiado pronto!" en rojo, la ronda se marca como nula (no cuenta para la media), se avanza a la siguiente ronda
5. **Resultado** — fondo claro, muestra:
   - Tiempo medio (ms) como valor principal grande
   - 3 stats: mejor ronda, peor ronda, rondas nulas
   - Badge si es nueva mejor marca personal
   - Posición en ranking del club
   - Botones: "Jugar de nuevo" y "Volver"

**Cálculo:** La media se calcula solo sobre rondas válidas (no nulas). Si todas son nulas, se muestra "Sin resultado válido".

**Persistencia:** Al terminar, si el resultado es válido (al menos 1 ronda no nula), se guarda en `juegos_scores`. El `valor` es la media en ms (entero, redondeado).

### LateralidadComponent (`/juegos/lateralidad`)

**Mecánica:** 10 rondas, plato vuela izquierda o derecha, el usuario pulsa el botón correcto.

**Estados de pantalla:**

1. **Intro** — nombre, instrucciones ("Un plato volará hacia un lado. Pulsa el botón correcto lo más rápido posible"), botón "Empezar"
2. **Espera entre rondas** — pausa breve (500–1000ms) con pantalla cielo (#87CEEB), indicador ronda N/10. Sin plato visible
3. **Plato volando** — plato aparece desde el centro y se desplaza hacia izquierda o derecha (animación CSS, dirección aleatoria 50/50). Dos botones grandes en la parte inferior: "← IZQ" y "DCHA →". El usuario debe pulsar el lado correcto antes de que el plato salga de pantalla (~1500ms)
4. **Feedback ronda** — flash verde breve (200ms) si acierto, flash rojo si fallo. Se registra el tiempo de reacción en ms si es acierto
5. **Timeout** — si no pulsa a tiempo, cuenta como fallo automático
6. **Resultado** — fondo claro, muestra:
   - Tiempo medio de aciertos (ms) como valor principal
   - 3 stats: aciertos, fallos, mejor ronda (ms)
   - Precisión en porcentaje (aciertos/10)
   - Posición en ranking del club (ordenado por media ms de aciertos, a igualdad gana quien tenga más aciertos)
   - Botones: "Jugar de nuevo" y "Volver"

**Persistencia:** Se guarda siempre al terminar. `valor` = media ms de aciertos (o 9999 si 0 aciertos), `aciertos` = número de aciertos.

### JuegosService

Servicio standalone inyectable. Métodos:

- `guardarPartida(tipo_juego: string, valor: number, aciertos: number | null, totalRondas: number): Observable<void>` — inserta en `juegos_scores`
- `getMejorMarca(userId: string, tipoJuego: string): Observable<number | null>` — mejor valor del usuario para ese juego (min ms para reflejos/lateralidad, max platos para rompe_platos)
- `getRanking(tipoJuego: string, limit: number): Observable<RankingJuego[]>` — top N mejores marcas únicas por usuario
- `getMisMejoresMarcas(userId: string): Observable<Map<string, number>>` — mejor marca del usuario para cada tipo de juego (para el hub)

Interface `RankingJuego`:
```typescript
interface RankingJuego {
  userId: string;
  nombre: string;
  apellidos: string;
  valor: number;
  aciertos: number | null;
}
```

## Tabla Supabase: `juegos_scores`

```sql
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
```

### RLS

```sql
ALTER TABLE juegos_scores ENABLE ROW LEVEL SECURITY;

-- Todos los socios autenticados pueden ver el ranking
CREATE POLICY "juegos_scores_select" ON juegos_scores
  FOR SELECT TO authenticated USING (true);

-- Solo puedes insertar tus propias partidas
CREATE POLICY "juegos_scores_insert" ON juegos_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
```

No se permite UPDATE ni DELETE — las partidas son inmutables.

## Cambios en componentes existentes

### HomeComponent (solo sección socio)

Reemplazar la tarjeta actual:

```html
<!-- ANTES -->
<button class="home-juego" (click)="goToJuego()">
  ...Rompe Platos...
</button>

<!-- DESPUÉS -->
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

Nuevo método `goToJuegos()` navega a `/juegos`.

### Rutas

Nuevas rutas lazy-loaded bajo el shell:

```
/juegos           → JuegosHubComponent
/juegos/reflejos  → ReflejosComponent
/juegos/lateralidad → LateralidadComponent
```

Se añaden en `app.routes.ts` o en un `juegos.routes.ts` con lazy loading.

## Diseño visual

### Hub `/juegos`

- Título "Echa un rato" como `page-title`
- Tarjetas: fondo blanco, border-radius 14px, shadow-sm. Cada una con:
  - Icono 48x48 en cuadrado redondeado con fondo de color suave (amarillo para Rompe Platos, verde para Reflejos, azul para Lateralidad)
  - Nombre (14px bold), descripción (11px gris)
  - Mejor marca personal a la derecha (11px bold, color del juego)
- Ranking: sección con chips de selección de juego, lista top 5 con posición/nombre/valor. Fila del usuario resaltada con fondo amarillo suave

### Test de Reflejos

- **Espera**: fondo #374151, plato fantasma centrado (opacity 0.3), texto blanco
- **Plato**: fondo #10B981, plato grande con sombra de pulso, texto "¡TOCA!" blanco grande
- **Falso positivo**: flash rojo breve, texto "¡Demasiado pronto!"
- **Resultado**: fondo #f8f9fa, valor grande centrado, stats en row de cards pequeñas, badges de marca/ranking, botones de acción

### Izquierda o Derecha

- **Juego**: fondo cielo #87CEEB, plato animado con CSS (translateX de 0 a ±100vw), botones grandes en la parte inferior (flex, border-radius 14px, padding generoso)
- **Botón correcto**: resaltado con fondo brand-yellow y sombra
- **Feedback**: flash de color (verde/rojo) 200ms sobre toda la pantalla
- **Resultado**: mismo layout que Test de Reflejos, adaptado con aciertos/fallos

### Paleta de colores por juego

| Juego | Color principal | Fondo icono |
|-------|----------------|-------------|
| Rompe Platos | #FFAE00 | #FFF3D0 |
| Test de Reflejos | #10B981 | #E8F5E9 |
| Izquierda o Derecha | #3B82F6 | #E3F2FD |

## Lo que NO se modifica

- `JuegoPlatosComponent` existente: no se toca. La tarjeta del hub navega a `/juego` directamente
- Bottom-nav: no se añade entrada para juegos
- No se crean módulos Angular — todo standalone
- No se modifica la vista admin

## Requisitos funcionales

| ID | Requisito |
|----|-----------|
| RF1 | Hub `/juegos` muestra 3 tarjetas con mejor marca personal por juego |
| RF2 | Hub muestra ranking top 5 del club, switchable entre juegos |
| RF3 | Test de Reflejos: 5 rondas go clásico, espera 1–4s, mide ms |
| RF4 | Test de Reflejos: toque prematuro = ronda nula |
| RF5 | Test de Reflejos: pantalla resultado con media, mejor, peor, nulas, ranking |
| RF6 | Lateralidad: 10 rondas, plato vuela izq/dcha aleatorio, botones grandes |
| RF7 | Lateralidad: timeout 1500ms por ronda = fallo automático |
| RF8 | Lateralidad: resultado con media ms, aciertos, fallos, precisión %, ranking |
| RF9 | Ambos juegos guardan resultado en `juegos_scores` al terminar |
| RF10 | Ranking ordena por mejor valor: min ms (reflejos/lateralidad), max platos (rompe_platos) |
| RF11 | Home socio: tarjeta "Echa un rato" reemplaza "Rompe Platos", navega a `/juegos` |
| RF12 | Tabla `juegos_scores` con RLS: select público, insert solo propio |
