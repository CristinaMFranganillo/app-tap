import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
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

    const { data: profile } = await supabaseAdmin.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !['admin', 'moderador'].includes(profile.rol)) {
      return new Response(
        JSON.stringify({ error: 'Sin permisos' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { nombre, apellidos, email, rol, numeroSocio, dni, telefono, direccion, localidad, tipoCuota } = await req.json()

    if (!nombre || !apellidos || !email || !rol || !numeroSocio) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos: nombre, apellidos, email, rol, numeroSocio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // numeroSocio debe ser entero positivo
    const numeroSocioInt = parseInt(numeroSocio, 10)
    if (isNaN(numeroSocioInt) || numeroSocioInt < 1) {
      return new Response(
        JSON.stringify({ error: 'El número de socio debe ser un entero mayor que 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar que el número de socio no esté repetido
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('numero_socio', numeroSocioInt)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: `El número de socio ${numeroSocioInt} ya está en uso` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Contraseña provisional = prefijo del email
    const password = email.split('@')[0]

    // 1. Crear usuario en Auth
    console.log('Creando usuario:', { email, nombre, apellidos, rol, numeroSocioInt })

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !authData.user) {
      console.error('Error creando en auth:', createError?.message)
      return new Response(
        JSON.stringify({ error: `Error creando usuario: ${createError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Insertar el perfil directamente (trigger desactivado)
    console.log('Insertando profile para:', authData.user.id)
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id:           authData.user.id,
      nombre,
      apellidos,
      numero_socio: numeroSocioInt,
      rol,
      email,
      dni:          dni       ?? null,
      telefono:     telefono  ?? null,
      direccion:    direccion ?? null,
      localidad:    localidad ?? null,
      tipo_cuota:   tipoCuota ?? 'socio',
      activo:       true,
      first_login:  true,
      favorito:     false,
    })

    if (profileError) {
      console.error('Error insertando profile:', profileError.message, profileError.details, profileError.hint)
      return new Response(
        JSON.stringify({ error: `Error creando perfil: ${profileError.message} | ${profileError.hint ?? ''} | ${profileError.details ?? ''}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Insertar cuota para la temporada activa (si existe)
    const { data: temporadaActiva } = await supabaseAdmin
      .from('temporadas')
      .select('id')
      .eq('activa', true)
      .maybeSingle()

    if (temporadaActiva?.id) {
      const { error: cuotaError } = await supabaseAdmin.from('cuotas').insert({
        user_id: authData.user.id,
        temporada_id: temporadaActiva.id,
        pagada: false,
      })
      if (cuotaError) {
        return new Response(
          JSON.stringify({ error: `Error creando cuota: ${cuotaError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ id: authData.user.id, numeroSocio: numeroSocioInt }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Error interno catch:', err)
    return new Response(
      JSON.stringify({ error: `Error interno: ${err}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
