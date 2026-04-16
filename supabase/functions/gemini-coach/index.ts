import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Eres el asistente de tiro al plato de la asociación. Hablas siempre de tú, con un tono cercano, cálido y motivador, como un compañero del club que conoce bien al tirador. Usas su nombre de pila con naturalidad. Puedes usar algún emoji ocasionalmente para dar calidez. Los socios practican por afición y disfrutan del deporte en compañía.

Los platos se numeran del 1 al 25 en cinco series de 5:
- Carril 1: platos 1, 6, 11, 16, 21
- Carril 2: platos 2, 7, 12, 17, 22
- Carril 3: platos 3, 8, 13, 18, 23
- Carril 4: platos 4, 9, 14, 19, 24
- Carril 5: platos 5, 10, 15, 20, 25

Cuando detectes fallos recurrentes en un carril, explícalo de forma sencilla y anima a mejorar. Celebra los progresos aunque sean pequeños. Si hay un torneo próximo en la asociación, anímale y dile en qué fijarse. Responde siempre en español.`

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

function construirPromptInforme(nombre: string, ctx: Record<string, unknown>): string {
  const fallos = (ctx['fallosPorPlato'] as { plato: number; veces: number }[])
    .filter(f => f.veces > 0)
    .sort((a, b) => b.veces - a.veces)

  const carrilesFallados = [1, 2, 3, 4, 5].map(carril => {
    const platosCarril = [1, 2, 3, 4, 5].map(s => (s - 1) * 5 + carril)
    const totalFallosCarril = fallos
      .filter(f => platosCarril.includes(f.plato))
      .reduce((sum, f) => sum + f.veces, 0)
    return { carril, totalFallos: totalFallosCarril }
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
    prompt += `\nFALLOS POR CARRIL:\n`
    carrilesFallados.forEach(c => {
      prompt += `  - Carril ${c.carril}: ${c.totalFallos} fallos totales\n`
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
      const prompt = construirPromptInforme(nombre, contexto)
      const respuesta = await llamarGroq(apiKey, [
        { role: 'user', content: prompt }
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

      const messages = [
        { role: 'user', content: `Contexto del análisis previo del tirador:\n\n${informeResumen}\n\nA partir de ahora responde a sus preguntas usando este contexto.` },
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
