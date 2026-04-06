import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { solicitudId, numeroSocio, rol } = await req.json()

    if (!solicitudId || !numeroSocio || !rol) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos obligatorios: solicitudId, numeroSocio, rol' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener el ID del admin que hace la petición (desde el JWT de la request)
    const authHeader = req.headers.get('Authorization')
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )
    const { data: { user: adminUser } } = await supabaseAnon.auth.getUser()
    const adminUserId = adminUser?.id ?? null

    // Cliente con service_role para operaciones privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Leer la solicitud
    const { data: solicitud, error: readError } = await supabaseAdmin
      .from('solicitudes_registro')
      .select('*')
      .eq('id', solicitudId)
      .single()

    if (readError || !solicitud) {
      return new Response(
        JSON.stringify({ error: 'Solicitud no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Crear usuario en Auth con contraseña aleatoria (el magic link permite establecerla)
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: solicitud.email,
      email_confirm: true,
      user_metadata: {
        nombre: solicitud.nombre,
        apellidos: solicitud.apellidos,
        numero_socio: numeroSocio,
      },
    })

    if (createError || !authData.user) {
      return new Response(
        JSON.stringify({ error: `Error creando usuario: ${createError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newUserId = authData.user.id

    // 3. Actualizar el profile creado por el trigger
    await supabaseAdmin.from('profiles').update({
      nombre: solicitud.nombre,
      apellidos: solicitud.apellidos,
      numero_socio: numeroSocio,
      rol: rol,
      activo: true,
    }).eq('id', newUserId)

    // 4. Marcar solicitud como aceptada
    await supabaseAdmin.from('solicitudes_registro').update({
      estado: 'aceptada',
      revisada_por: adminUserId,
      fecha_revision: new Date().toISOString(),
    }).eq('id', solicitudId)

    // 5. Generar magic link para que el usuario establezca su contraseña
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: solicitud.email,
    })
    const magicLinkUrl = linkData?.properties?.action_link ?? ''

    // 6. Enviar email de bienvenida con Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@campotirosanisidro.es',
          to: solicitud.email,
          subject: '¡Bienvenido/a a Campo de Tiro San Isidro!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1A1A1A;">¡Bienvenido/a, ${solicitud.nombre}!</h2>
              <p>Tu solicitud de acceso a <strong>Campo de Tiro San Isidro</strong> ha sido <strong>aprobada</strong>.</p>
              <p>Tu número de socio es: <strong>#${numeroSocio}</strong></p>
              <p>Para acceder a la aplicación, haz clic en el siguiente enlace y establece tu contraseña:</p>
              ${magicLinkUrl ? `<p><a href="${magicLinkUrl}" style="background: #D4E600; color: #1A1A1A; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">Acceder a la aplicación</a></p>` : ''}
              <p>Si el enlace no funciona, cópialo en tu navegador: ${magicLinkUrl}</p>
              <p style="color: #666; font-size: 12px;">Campo de Tiro San Isidro</p>
            </div>
          `,
        }),
      })
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Error interno: ${err}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
