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
    // Verificar que el llamante es un admin
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

    // Verificar que el token pertenece a un admin o moderador
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

    const { nombre, apellidos, email, rol } = await req.json()

    if (!nombre || !apellidos || !email || !rol) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos: nombre, apellidos, email, rol' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Contraseña provisional = prefijo del email
    const password = email.split('@')[0]

    // 1. Crear usuario en Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !authData.user) {
      return new Response(
        JSON.stringify({ error: `Error creando usuario: ${createError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Calcular número de socio automático
    const { data: perfiles } = await supabaseAdmin.from('profiles').select('numero_socio')
    const nums = (perfiles ?? [])
      .map((r: { numero_socio: string }) => parseInt(r.numero_socio, 10))
      .filter((n: number) => !isNaN(n))
    const max = nums.length > 0 ? Math.max(...nums) : 0
    const numeroSocio = String(max + 1).padStart(4, '0')

    // 3. Actualizar el profile creado por el trigger
    const { error: profileError } = await supabaseAdmin.from('profiles').update({
      nombre,
      apellidos,
      numero_socio: numeroSocio,
      rol,
      activo: true,
      first_login: true,
    }).eq('id', authData.user.id)

    if (profileError) {
      return new Response(
        JSON.stringify({ error: `Error actualizando perfil: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ id: authData.user.id, numeroSocio }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Error interno: ${err}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
