# Spec: Modelo de datos Torneos (Foso Universal)

**Fecha:** 2026-04-06  
**Estado:** Aprobado

---

## Contexto

AppTap es una app móvil para el Club de Tiro San Isidro. La modalidad principal es el **Foso Universal**: tiradores en escuadras de hasta 6 personas que rotan por 5 puestos, disparando a platos lanzados aleatoriamente. Se registran resultados plato a plato.

El modelo anterior (`competiciones` + `scores`) solo guardaba totales. Este spec define el modelo completo para tiradas sociales.

---

## Roles

- **Admin**: crea competiciones, escuadras, registra resultados
- **Moderador**: registra resultados
- **Socio**: consulta clasificación e historial propio

---

## Modelo de datos

### `competiciones` (modificada)

```sql
id            uuid PK
nombre        text NOT NULL
modalidad     text NOT NULL DEFAULT 'foso-universal'
fecha         timestamptz NOT NULL
lugar         text
platos_por_serie  int NOT NULL DEFAULT 25
num_series    int NOT NULL DEFAULT 1
activa        boolean NOT NULL DEFAULT false
creada_por    uuid FK profiles(id)
```

Cambios respecto al modelo anterior: añadir `lugar`, `platos_por_serie`, `num_series`. Eliminar `total_platos` (se deriva de `platos_por_serie * num_series`).

---

### `escuadras` (nueva)

```sql
id              uuid PK
competicion_id  uuid FK competiciones(id) ON DELETE CASCADE
numero          int NOT NULL  -- número de escuadra (1, 2, 3...)
UNIQUE(competicion_id, numero)
```

---

### `escuadra_tiradores` (nueva)

```sql
id          uuid PK
escuadra_id uuid FK escuadras(id) ON DELETE CASCADE
user_id     uuid FK profiles(id)
puesto      int NOT NULL CHECK (puesto BETWEEN 1 AND 6)  -- posición inicial en la escuadra
UNIQUE(escuadra_id, user_id)
UNIQUE(escuadra_id, puesto)
```

Máximo 6 tiradores por escuadra (5 puestos + 1 reserva).

---

### `resultados` (nueva)

```sql
id              uuid PK
competicion_id  uuid FK competiciones(id) ON DELETE CASCADE
user_id         uuid FK profiles(id)
serie           int NOT NULL  -- número de serie (1, 2, 3...)
plato           int NOT NULL  -- número de plato dentro de la serie (1-25)
resultado       smallint NOT NULL CHECK (resultado IN (0, 1))  -- 0=fallo, 1=roto
registrado_por  uuid FK profiles(id)  -- admin/moderador que anotó
fecha           timestamptz NOT NULL DEFAULT now()
UNIQUE(competicion_id, user_id, serie, plato)
```

Un registro por plato. Los totales se calculan con `SUM(resultado)`.

---

### `scores` (deprecada)

Se mantiene en BD para no romper código existente durante la transición. No se escribirán nuevos datos en ella.

---

## Cálculos derivados (no almacenados)

| Métrica | Cálculo |
|---|---|
| Total platos rotos por tirador | `SUM(resultado) WHERE user_id = X AND competicion_id = Y` |
| Total por serie | `SUM(resultado) WHERE user_id = X AND serie = N` |
| Clasificación general | ORDER BY total DESC |
| Porcentaje acierto | `SUM(resultado) / (num_series * platos_por_serie) * 100` |

---

## RLS

- `competiciones`: SELECT todos los autenticados. INSERT/UPDATE solo admin/moderador.
- `escuadras` y `escuadra_tiradores`: SELECT todos los autenticados. INSERT/UPDATE solo admin/moderador.
- `resultados`: SELECT todos los autenticados. INSERT/UPDATE solo admin/moderador.

---

## Flujo de uso

1. Admin crea competición (nombre, fecha, lugar, series, platos/serie)
2. Admin crea escuadras y asigna tiradores con puesto
3. Durante la tirada, admin/moderador registra cada plato (roto/fallo) por tirador y serie
4. La clasificación se calcula en tiempo real desde `resultados`

---

## Lo que NO cubre este spec

- Rotación automática de puestos (se registra solo el puesto inicial)
- Exportación PDF/Excel
- Control de múltiples canchas simultáneas
- Inscripción online
