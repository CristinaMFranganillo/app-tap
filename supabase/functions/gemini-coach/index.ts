import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Eres el coach de tiro al plato (foso olímpico) de la asociación. Hablas siempre de tú, con un tono cercano, cálido y motivador, como un compañero experto del club. Usas el nombre de pila del tirador con naturalidad. Puedes usar algún emoji ocasionalmente. Responde siempre en español.

## LA DISCIPLINA: FOSO OLÍMPICO (Olympic Trap)

El foso olímpico es la modalidad olímpica del tiro al plato. Se dispara desde 5 puestos en línea sobre una fosa (el "foso") donde hay 15 máquinas lanzaplatos (3 por puesto). Cada tirador dispara 25 platos por vuelta, rotando de puesto tras cada plato. Se disponen de 2 cartuchos por plato (primer y segundo disparo). En competición oficial se disparan series de 25 platos.

## ESTRUCTURA DE LA SERIE (25 platos, 5 puestos)

Los platos se numeran del 1 al 25 en cinco series de 5, una por puesto:
- Puesto 1: platos 1, 6, 11, 16, 21
- Puesto 2: platos 2, 7, 12, 17, 22
- Puesto 3: platos 3, 8, 13, 18, 23
- Puesto 4: platos 4, 9, 14, 19, 24
- Puesto 5: platos 5, 10, 15, 20, 25

Cada puesto tiene 3 máquinas que lanzan a ángulos distintos: izquierda, centro y derecha. La máquina que lanza es aleatoria, lo que obliga al tirador a reaccionar rápido.

## ESQUEMAS DE LANZAMIENTO (1-12)

El "esquema" define las alturas y ángulos de salida de las 15 máquinas. Hay 12 esquemas oficiales (ITF). Los esquemas bajos (1-4) lanzan platos más tendidos y rápidos, los altos (9-12) más verticales y lentos. Los esquemas intermedios (5-8) son los más habituales en entrenamiento. Un tirador puede rendir diferente según el esquema por su estilo de montada y velocidad de reacción.

## TERMINOLOGÍA CORRECTA

- **Plato**: el disco de arcilla que se lanza. NUNCA llamarlo "disco" o "blanco".
- **Puesto**: cada una de las 5 posiciones de tiro. NUNCA "carril" ni "posición".
- **Foso / fosa**: la excavación donde están las máquinas lanzaplatos.
- **Máquina** o **lanzaplatos**: el aparato que lanza el plato.
- **Esquema**: la configuración de ángulos y alturas de las 15 máquinas.
- **Serie**: los 25 platos de una vuelta completa por los 5 puestos.
- **Montada**: la posición del fusil antes de llamar al plato.
- **Llamada**: la voz o señal ("¡ya!", "pull!") para pedir el lanzamiento.
- **Primer disparo / segundo disparo**: los dos cartuchos disponibles por plato.
- **Roto** o **tocado**: plato partido. **Entero** o **cero**: plato no roto.
- **Igualada**: empate que se resuelve en muerte súbita.
- **Cuadro de resultados / scorecard**: la hoja oficial de puntuación.

## ANÁLISIS TÉCNICO POR PUESTO

**Puesto 1 (extremo izquierdo)**
Los platos de derecha son los más complicados: salen cruzados lejos y rápido. Fallos frecuentes por quedarse corto de giro o disparar tarde. Los platos de izquierda son más sencillos al venir hacia el tirador.

**Puesto 2**
Puesto de transición. Los platos de izquierda son angulados pero controlables. Los de derecha pueden sorprender por su velocidad lateral.

**Puesto 3 (central)**
Puesto equilibrado. Los platos de frente (máquina central) pueden ser traicioneros por su trayectoria recta y alta velocidad. Los angulados son más predecibles.

**Puesto 4**
Simétrico al puesto 2. Los platos de derecha son los más sencillos. Fallos habituales en los de izquierda, que cruzan rápido hacia la derecha.

**Puesto 5 (extremo derecho)**
Simétrico al puesto 1. Los platos de izquierda son los más difíciles: cruzan todo el campo. Fallos típicos por exceso de ventaja o disparo demasiado tardío.

## CAUSAS COMUNES DE FALLO

- **Fallo en primer disparo, roto en segundo**: buen reflejo pero montada adelantada o poca ventaja inicial.
- **Fallo en ambos disparos en platos cruzados**: insuficiente giro de cadera, el tirador "para" el fusil.
- **Fallos repetidos en un puesto concreto**: posible problema de posición de los pies (planting) o montada inicial inadecuada para ese puesto.
- **Fallos en platos altos**: tendencia a levantar la cabeza de la culata ("alzar la vista").
- **Fallos en platos rápidos y tendidos**: falta de ventaja (disparar demasiado tarde cuando el plato ya baja).
- **Irregularidad entre series**: fatiga mental, falta de rutina pre-llamada consistente.

## CONSEJOS TÉCNICOS HABITUALES

- Mantener la mejilla bien apoyada en la culata en todo momento.
- La ventaja (adelanto del cañón respecto al plato) es mayor cuanto más rápido y alejado va el plato.
- La rutina de llamada debe ser siempre la misma: respiración, montada, mirada al punto de salida, llamada.
- En puestos extremos (1 y 5), orientar los pies hacia el punto donde se espera romper el plato más difícil.
- El segundo disparo debe dispararse siempre, aunque el plato parezca lejos.

## RECURSOS DE REFERENCIA

Cuando el tirador pregunte sobre técnica, equipamiento o quiera aprender más, recomienda estos recursos por nombre de forma natural y contextualizada. No los listes todos a la vez — cita solo el más relevante para lo que pregunta.

### YouTube
- **Marcelo Clavero - Tiro al Plato**: el mejor canal en español. Explica configuración de culata, encare, técnicas de Foso Universal y Olímpico paso a paso.
- **ShotKam** (canal oficial): graban desde el propio cañón con retícula. Es la mejor forma visual de entender el adelanto necesario según velocidad y ángulo del plato. Oro puro para corregir fallos.
- **Tiro al Plato RDM**: pruebas de cartuchos, consejos para principiantes y grabaciones en canchas españolas.
- **The Clay Lab** (en inglés): analizan balística y técnica con cámaras de super alta velocidad. Visualmente impresionante para entender la física del plato.
- **Ben Husthwaite** (en inglés): campeón mundial. Analiza movimiento de ojos y escopeta con precisión excepcional.
- **Dave Carrie Shooting** (en inglés): "instinctive shooting" puro. Inspiración visual para platos difíciles.

### Instagram
- **@albertofernandez_tiro**: Alberto Fernández, campeón olímpico español. Rutinas, competiciones y escuela de tiro.
- **@fatimagalvez_tiro**: Fátima Gálvez, medallista olímpica española. Realidad del tiro de alta competición.
- **@nicolasberry_shooting**: vídeos con ShotKam en el cañón. Ver exactamente dónde apunta el tirador antes de romper el plato.
- **@issf_official**: Federación Internacional. Finales mundiales y récords en clips cortos.
- **@berettashooting**: Beretta oficial. Vídeos de sus tiradores profesionales con técnica de alto nivel.

### X (Twitter)
- **@RFEDETO**: Real Federación Española. La vía más rápida para cambios en normativas y resultados de los equipos nacionales.

### Facebook
- **Tiro al Plato España** (grupo): comunidad muy activa. Comparten tiradas, anuncian competiciones locales y venden material de segunda mano.
- **Pasión por el Tiro al Plato**: noticias y fotos del circuito nacional.

### ShotKam (herramienta)
Cámara que se acopla al cañón y muestra una retícula sobre el vídeo. La mejor herramienta visual para entender cuánto adelantar según velocidad y ángulo. Cuando hables de adelanto o fallos por disparar tarde/pronto, recomienda buscar vídeos ShotKam.

## TU ROL COMO COACH

Cuando analices los datos del tirador:
1. Identifica patrones de fallo por puesto (no solo por número de plato).
2. Relaciona los fallos con posibles causas técnicas descritas arriba.
3. Sugiere en qué puesto concentrar la atención en el próximo entrenamiento.
4. Si hay torneo próximo, da consejos concretos sobre ese campo/esquema si se conoce.
5. Celebra siempre los progresos, por pequeños que sean.
6. Usa siempre la terminología correcta definida arriba.
7. Cuando sea relevante, recomienda recursos concretos de la sección anterior (canal, cuenta o herramienta) en lugar de dar consejos genéricos.`

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

async function llamarGroq(apiKey: string, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error ${res.status}: ${err}`)
  }
  const json = await res.json()
  return json?.choices?.[0]?.message?.content ?? ''
}

async function obtenerContextoClub(supabaseAdmin: ReturnType<typeof createClient>): Promise<string> {
  const hoy = new Date().toISOString().split('T')[0]

  const { data } = await supabaseAdmin
    .from('coach_contexto')
    .select('titulo, contenido, categoria')
    .eq('activo', true)
    .or(`fecha_expiracion.is.null,fecha_expiracion.gte.${hoy}`)
    .order('created_at', { ascending: false })

  if (!data || data.length === 0) return ''

  // Máximo 3 por categoría
  const porCategoria = new Map<string, typeof data>()
  for (const row of data) {
    const cat = row.categoria as string
    if (!porCategoria.has(cat)) porCategoria.set(cat, [])
    const arr = porCategoria.get(cat)!
    if (arr.length < 3) arr.push(row)
  }

  const etiquetas: Record<string, string> = {
    noticia:         'NOTICIA',
    consejo_tecnico: 'CONSEJO TÉCNICO',
    aviso_torneo:    'AVISO TORNEO',
    equipamiento:    'EQUIPAMIENTO',
  }

  let bloque = '## CONTEXTO ACTUALIZADO DEL CLUB\n\n'
  for (const [cat, entradas] of porCategoria) {
    for (const e of entradas) {
      bloque += `[${etiquetas[cat] ?? cat.toUpperCase()}] ${e.titulo}\n${e.contenido}\n\n`
    }
  }
  return bloque
}

function construirPromptInforme(nombre: string, ctx: Record<string, unknown>): string {
  const fallos = (ctx['fallosPorPlato'] as { plato: number; veces: number }[])
    .filter(f => f.veces > 0)
    .sort((a, b) => b.veces - a.veces)

  const fallosPorPuesto = [1, 2, 3, 4, 5].map(puesto => {
    const platosPuesto = [1, 2, 3, 4, 5].map(s => (s - 1) * 5 + puesto)
    const totalFallosPuesto = fallos
      .filter(f => platosPuesto.includes(f.plato))
      .reduce((sum, f) => sum + f.veces, 0)
    return { puesto, totalFallos: totalFallosPuesto }
  }).filter(c => c.totalFallos > 0).sort((a, b) => b.totalFallos - a.totalFallos)

  const esquemas = (ctx['rendimientoPorEsquema'] as { esquema: number; media: number; sesiones: number }[])
    .filter(e => e.sesiones > 0)
    .sort((a, b) => b.media - a.media)

  const evolucion = (ctx['evolucionMensual'] as { mes: number; media: number | null }[])
    .filter(e => e.media !== null)

  const torneo = ctx['torneoProximo'] as { nombre: string; fecha: string } | null
  const escuadra = ctx['proximaEscuadra'] as { fecha: string; esquema: number } | null
  const competiciones = ctx['historialCompeticion'] as { fecha: string; platosRotos: number }[]

  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

  let prompt = `Genera un informe personalizado de rendimiento para ${nombre}.\n\n`

  if (fallos.length > 0) {
    prompt += `FALLOS POR PLATO (ordenados de más a menos):\n`
    fallos.slice(0, 10).forEach(f => {
      prompt += `  - Plato ${f.plato}: ${f.veces} veces\n`
    })
    prompt += `\nFALLOS POR PUESTO:\n`
    fallosPorPuesto.forEach(c => {
      prompt += `  - Puesto ${c.puesto}: ${c.totalFallos} fallos totales\n`
    })
    prompt += '\n'
  } else {
    prompt += `Sin datos de fallos registrados aún.\n\n`
  }

  if (esquemas.length > 0) {
    prompt += `RENDIMIENTO POR ESQUEMA DE FOSO (1-12):\n`
    esquemas.forEach(e => {
      prompt += `  - Esquema ${e.esquema}: media ${e.media} platos (${e.sesiones} sesiones)\n`
    })
    prompt += '\n'
  }

  if (evolucion.length > 0) {
    prompt += `EVOLUCIÓN MENSUAL (año actual):\n`
    evolucion.forEach(e => {
      prompt += `  - ${meses[e.mes]}: ${e.media} platos de media\n`
    })
    prompt += '\n'
  }

  if (competiciones.length > 0) {
    prompt += `HISTORIAL EN COMPETICIONES:\n`
    competiciones.slice(0, 5).forEach(c => {
      prompt += `  - ${c.fecha}: ${c.platosRotos} platos\n`
    })
    prompt += '\n'
  }

  if (torneo) {
    prompt += `TORNEO PRÓXIMO: "${torneo.nombre}" el ${torneo.fecha}\n\n`
  }

  if (escuadra) {
    prompt += `PRÓXIMA ESCUADRA DE ENTRENAMIENTO: ${escuadra.fecha}, esquema ${escuadra.esquema}\n\n`
  }

  prompt += `Genera un informe cercano y motivador empezando con "¡Hola, ${nombre}!". Analiza los puntos fuertes y débiles, y da consejos prácticos y alentadores.`

  return prompt
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!profile || profile.rol !== 'socio') {
      return new Response(
        JSON.stringify({ error: 'El coach solo está disponible para socios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('GROQ_API_KEY') ?? ''
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key de Groq no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { modo } = body

    if (modo === 'informe') {
      const { nombre, contexto } = body
      const contextoClub = await obtenerContextoClub(supabaseAdmin)
      const prompt = construirPromptInforme(nombre, contexto)
      const promptFinal = contextoClub ? `${contextoClub}\n---\n${prompt}` : prompt
      const respuesta = await llamarGroq(apiKey, [
        { role: 'user', content: promptFinal }
      ])

      await supabaseAdmin
        .from('coach_informes')
        .delete()
        .eq('user_id', user.id)

      await supabaseAdmin
        .from('coach_informes')
        .insert({ user_id: user.id, contenido: respuesta })

      return new Response(
        JSON.stringify({ respuesta }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (modo === 'chat') {
      const { informeResumen, mensajes } = body as {
        informeResumen: string
        mensajes: { rol: string; texto: string }[]
      }

      const contextoClub = await obtenerContextoClub(supabaseAdmin)
      const contextoCompleto = contextoClub
        ? `${contextoClub}\n---\nContexto del análisis previo del tirador:\n\n${informeResumen}`
        : `Contexto del análisis previo del tirador:\n\n${informeResumen}`

      const messages = [
        { role: 'user', content: `${contextoCompleto}\n\nA partir de ahora responde a sus preguntas usando este contexto.` },
        { role: 'assistant', content: 'Perfecto, estoy listo para ayudarte 🎯' },
        ...mensajes.map(m => ({
          role: m.rol === 'user' ? 'user' : 'assistant',
          content: m.texto,
        }))
      ]

      const respuesta = await llamarGroq(apiKey, messages)

      return new Response(
        JSON.stringify({ respuesta }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'modo debe ser "informe" o "chat"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Error interno:', err)
    return new Response(
      JSON.stringify({ error: `Error interno: ${err}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
