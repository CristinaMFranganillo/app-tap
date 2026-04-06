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
    const { solicitudId, motivo } = await req.json()

    if (!solicitudId) {
      return new Response(
        JSON.stringify({ error: 'Falta el campo obligatorio: solicitudId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener ID del admin desde el JWT
    const authHeader = req.headers.get('Authorization')
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )
    const { data: { user: adminUser } } = await supabaseAnon.auth.getUser()
    const adminUserId = adminUser?.id ?? null

    // Cliente privilegiado
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

    // 2. Marcar solicitud como rechazada
    await supabaseAdmin.from('solicitudes_registro').update({
      estado: 'rechazada',
      motivo_rechazo: motivo ?? null,
      revisada_por: adminUserId,
      fecha_revision: new Date().toISOString(),
    }).eq('id', solicitudId)

    // 3. Enviar email de rechazo con Resend
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
          subject: 'Solicitud de acceso — Campo de Tiro San Isidro',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1A1A1A;">Hola, ${solicitud.nombre}</h2>
              <p>Tras revisar tu solicitud de acceso a <strong>Campo de Tiro San Isidro</strong>, lamentablemente no podemos aprobarla en este momento.</p>
              ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
              <p>Si tienes alguna pregunta, puedes ponerte en contacto con la asociación.</p>
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
