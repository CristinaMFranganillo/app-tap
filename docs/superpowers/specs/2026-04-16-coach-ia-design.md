# Coach IA de Tiro al Plato — Spec de diseño
**Fecha:** 2026-04-16  
**Feature:** `/coach` — Asistente inteligente con Gemini AI para socios de la asociación

---

## 1. Objetivo

Añadir una sección `/coach` a la PWA AppTap donde cada socio (rol `socio`) puede:
- Recibir un **informe automático** generado por Gemini con análisis de su rendimiento
- Mantener una **conversación de chat** con el asistente para hacer preguntas de seguimiento
- Ver el último informe guardado sin coste de IA si tiene menos de 24 horas

El Coach **no está disponible para admin ni moderador**.

---

## 2. Arquitectura

```
Socio (Angular PWA)
  └── /coach  (nueva ruta lazy bajo shell + authGuard)
        └── CoachComponent
              └── CoachService
                    ├── generarInforme()  → Edge Function gemini-coach (modo: 'informe')
                    ├── chat()            → Edge Function gemini-coach (modo: 'chat')
                    └── getUltimoInforme() → tabla coach_informes (Supabase)

Supabase
  ├── Edge Function: supabase/functions/gemini-coach/index.ts
  │     ├── modo 'informe' → recopila contexto de BD + llama Gemini → guarda en coach_informes
  │     └── modo 'chat'    → usa informeResumen + historial de mensajes → llama Gemini
  └── Tabla nueva: coach_informes
        (id, user_id, contenido, created_at)
```

---

## 3. Base de datos

### Tabla `coach_informes`

```sql
create table public.coach_informes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  contenido   text not null,
  created_at  timestamptz not null default now()
);

create index coach_informes_user_id_idx on public.coach_informes(user_id);

alter table public.coach_informes enable row level security;

create policy "socio ve sus informes"
  on public.coach_informes for select
  using (auth.uid() = user_id);

create policy "socio inserta sus informes"
  on public.coach_informes for insert
  with check (auth.uid() = user_id);

create policy "socio actualiza sus informes"
  on public.coach_informes for update
  using (auth.uid() = user_id);
```

### Secret Supabase

```bash
supabase secrets set GEMINI_API_KEY=<api_key_de_google_ai_studio>
```

---

## 4. Edge Function `gemini-coach`

**Ruta:** `supabase/functions/gemini-coach/index.ts`  
**Modelo Gemini:** `gemini-1.5-flash`  
**Autenticación:** JWT Bearer (igual que las funciones existentes)  
**Rol requerido:** `socio` (se verifica en la función)

### Contrato de entrada

```ts
// Modo informe
{
  modo: 'informe',
  nombre: string,   // nombre de pila del socio
  contexto: {
    fallosPorPlato: { plato: number; veces: number }[],
    rendimientoPorEsquema: { esquema: number; media: number; sesiones: number }[],
    evolucionMensual: { mes: number; media: number | null }[],
    torneoProximo: { nombre: string; fecha: string } | null,
    proximaEscuadra: { fecha: string; esquema: number } | null,
    historialCompeticion: { fecha: string; platosRotos: number }[]
  }
}

// Modo chat
{
  modo: 'chat',
  informeResumen: string,
  mensajes: { rol: 'user' | 'model'; texto: string }[]
}
```

### Contrato de salida

```ts
{ respuesta: string }  // texto en markdown
```

### System prompt

```
Eres el asistente de tiro al plato de la asociación. Hablas siempre de tú, con un tono 
cercano, cálido y motivador, como un compañero del club que conoce bien al tirador. 
Usas su nombre de pila con naturalidad. Puedes usar algún emoji ocasionalmente para 
dar calidez. Los socios practican por afición y disfrutan del deporte en compañía.

Los platos se numeran del 1 al 25 en cinco series de 5:
- Carril 1: platos 1, 6, 11, 16, 21
- Carril 2: platos 2, 7, 12, 17, 22
- Carril 3: platos 3, 8, 13, 18, 23
- Carril 4: platos 4, 9, 14, 19, 24
- Carril 5: platos 5, 10, 15, 20, 25

Cuando detectes fallos recurrentes en un carril, explícalo de forma sencilla y anima 
a mejorar. Celebra los progresos aunque sean pequeños. Si hay un torneo próximo en 
la asociación, anímale y dile en qué fijarse. Responde siempre en español.
```

### Lógica interna (modo informe)

1. Verificar JWT y rol `socio`
2. Construir prompt con el contexto recibido
3. Llamar a Gemini con system prompt + prompt de contexto
4. Guardar resultado en `coach_informes` (upsert por `user_id`)
5. Devolver `{ respuesta }`

### Lógica interna (modo chat)

1. Verificar JWT y rol `socio`
2. Construir array de mensajes: system prompt + informe como contexto + historial
3. Llamar a Gemini
4. Devolver `{ respuesta }`

---

## 5. CoachService (Angular)

**Ruta:** `src/app/features/coach/coach.service.ts`

```ts
interface CoachInforme {
  id: string;
  userId: string;
  contenido: string;
  createdAt: string;
}

interface MensajeChat {
  rol: 'user' | 'model';
  texto: string;
}
```

**Métodos:**

| Método | Descripción |
|--------|-------------|
| `getUltimoInforme(userId)` | Lee `coach_informes` de Supabase, devuelve el más reciente |
| `generarInforme(nombre, contexto)` | Llama Edge Function modo `informe`, devuelve string |
| `chat(mensajes, informeResumen)` | Llama Edge Function modo `chat`, devuelve string |

**Recopilación de contexto:** El servicio consulta en paralelo (`forkJoin`) los servicios ya existentes:
- `EntrenamientoService.getFallosByUserAndYear()` → fallos por plato
- `EntrenamientoService.getByUser()` → rendimiento por esquema y evolución mensual
- `ScoreService.getByUser()` → historial de competición
- `InscripcionTorneoService.getByUser()` → torneos próximos
- `EntrenamientoService.getProximaEscuadra()` → próxima escuadra (método nuevo si no existe)

---

## 6. CoachComponent (Angular)

**Ruta:** `src/app/features/coach/coach.component.ts`  
**Selector:** `app-coach`  
**Standalone:** sí, lazy loading

### Estados del componente

```ts
cargandoInforme = signal(false)
informe = signal<string | null>(null)        // markdown del informe
mensajes = signal<MensajeChat[]>([])         // historial chat en memoria
enviando = signal(false)                     // spinner mientras espera respuesta chat
inputUsuario = ''                            // ngModel del textarea
```

### Flujo al iniciar

1. `ngOnInit` → `getUltimoInforme(userId)`
2. Si existe y `created_at` < 24h → mostrar directamente
3. Si no → llamar `generarInforme()` automáticamente
4. El botón "Actualizar análisis" fuerza una nueva llamada a `generarInforme()`

### UI

```
┌─────────────────────────────────┐
│  HEADER  "Tu Coach 🎯"          │
├─────────────────────────────────┤
│  📋 INFORME AUTOMÁTICO          │
│  [contenido markdown renderizado]│
│  [Actualizar análisis]  [fecha] │
├─────────────────────────────────┤
│  💬 PREGÚNTAME LO QUE QUIERAS   │
│  [burbuja model]                │
│  [burbuja user]                 │
│  [burbuja model]                │
│                                 │
│  [textarea placeholder]   [➤]  │
├─────────────────────────────────┤
│  Inicio | Entrena | Métricas | Coach │
└─────────────────────────────────┘
```

---

## 7. Actualización del Bottom-Nav

**Archivo:** `src/app/shared/components/bottom-nav/bottom-nav.component.ts`

```ts
const SOCIO_NAV: NavItem[] = [
  { route: '/',        icon: 'bi-house',    label: 'Inicio'   },
  { route: '/scores',  icon: 'bi-bullseye', label: 'Entrena'  },
  { route: '/perfil',  icon: 'bi-graph-up', label: 'Métricas' },
  { route: '/coach',   icon: 'bi-robot',    label: 'Coach'    },
];
```

---

## 8. Routing

En `src/app/app.routes.ts`, dentro del shell con `authGuard`:

```ts
{
  path: 'coach',
  loadComponent: () => import('./features/coach/coach.component')
    .then(m => m.CoachComponent),
  canActivate: [authGuard]
}
```

El roleGuard no es necesario porque la Edge Function rechaza roles no-socio, y el ítem del nav solo aparece en `SOCIO_NAV`.

---

## 9. Modelo `CoachInforme`

**Ruta:** `src/app/core/models/coach.model.ts`

```ts
export interface CoachInforme {
  id: string;
  userId: string;
  contenido: string;
  createdAt: string;
}

export interface MensajeChat {
  rol: 'user' | 'model';
  texto: string;
}
```

---

## 10. Archivos a crear / modificar

| Acción | Archivo |
|--------|---------|
| CREAR | `supabase/functions/gemini-coach/index.ts` |
| CREAR | `src/app/core/models/coach.model.ts` |
| CREAR | `src/app/features/coach/coach.service.ts` |
| CREAR | `src/app/features/coach/coach.component.ts` |
| CREAR | `src/app/features/coach/coach.component.html` |
| CREAR | `src/app/features/coach/coach.component.scss` |
| MODIFICAR | `src/app/shared/components/bottom-nav/bottom-nav.component.ts` |
| MODIFICAR | `src/app/app.routes.ts` |
| EJECUTAR en Supabase | SQL de tabla `coach_informes` + RLS |
| EJECUTAR CLI | `supabase secrets set GEMINI_API_KEY=...` |
