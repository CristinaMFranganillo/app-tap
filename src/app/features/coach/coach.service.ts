import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { supabase } from '../../core/supabase/supabase.client';
import { AuthService } from '../../core/auth/auth.service';
import { EntrenamientoService } from '../admin/entrenamientos/entrenamiento.service';
import { ScoreService } from '../scores/score.service';
import { CoachInforme, ContextoCoach, MensajeChat } from '../../core/models/coach.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CoachService {
  private auth = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);
  private scoreService = inject(ScoreService);

  async getUltimoInforme(userId: string): Promise<CoachInforme | null> {
    const { data, error } = await supabase
      .from('coach_informes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: (data as any)['id'] as string,
      userId: (data as any)['user_id'] as string,
      contenido: (data as any)['contenido'] as string,
      createdAt: (data as any)['created_at'] as string,
    };
  }

  async recopilarContexto(userId: string): Promise<ContextoCoach> {
    const anio = new Date().getFullYear();
    const hoy = new Date().toISOString().split('T')[0];

    const [fallosAnuales, entrenamientos, competiciones, torneoProximo, proximaEscuadra] =
      await Promise.all([
        firstValueFrom(this.entrenamientoService.getFallosByUserAndYear(userId, anio)),
        firstValueFrom(this.entrenamientoService.getByUser(userId, anio)),
        firstValueFrom(this.scoreService.getByUser(userId)),
        this.getTorneoProximo(userId, hoy),
        this.getProximaEscuadra(userId, hoy),
      ]);

    // Fallos por plato (1-25)
    const conteoFallos = new Map<number, number>();
    for (const f of fallosAnuales) {
      conteoFallos.set(f.numeroPlato, (conteoFallos.get(f.numeroPlato) ?? 0) + 1);
    }
    const fallosPorPlato = Array.from({ length: 25 }, (_, i) => ({
      plato: i + 1,
      veces: conteoFallos.get(i + 1) ?? 0,
    }));

    // Rendimiento por esquema
    const bucketEsquemas = new Map<number, number[]>();
    for (const r of entrenamientos) {
      if (r.esquema && r.esquema >= 1 && r.esquema <= 10) {
        if (!bucketEsquemas.has(r.esquema)) bucketEsquemas.set(r.esquema, []);
        bucketEsquemas.get(r.esquema)!.push(r.platosRotos);
      }
    }
    const rendimientoPorEsquema = Array.from(bucketEsquemas.entries()).map(([esquema, arr]) => ({
      esquema,
      media: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
      sesiones: arr.length,
    }));

    // Evolución mensual
    const bucketMeses = new Map<number, number[]>();
    for (const r of entrenamientos) {
      const mes = new Date(r.fecha).getMonth();
      if (!bucketMeses.has(mes)) bucketMeses.set(mes, []);
      bucketMeses.get(mes)!.push(r.platosRotos);
    }
    const evolucionMensual = Array.from({ length: 12 }, (_, mes) => {
      const arr = bucketMeses.get(mes);
      return {
        mes,
        media: arr && arr.length > 0
          ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
          : null,
      };
    });

    // Historial competiciones
    const historialCompeticion = competiciones
      .slice(0, 10)
      .map(s => ({ fecha: s.fecha.toISOString().split('T')[0], platosRotos: s.platosRotos }));

    return {
      fallosPorPlato,
      rendimientoPorEsquema,
      evolucionMensual,
      torneoProximo,
      proximaEscuadra,
      historialCompeticion,
    };
  }

  private async getTorneoProximo(
    userId: string,
    hoy: string
  ): Promise<{ nombre: string; fecha: string } | null> {
    const { data } = await supabase
      .from('inscripciones_torneo')
      .select('torneos(nombre, fecha)')
      .eq('user_id', userId);

    if (!data) return null;
    const futuros = (data as any[])
      .map(row => row['torneos'])
      .filter(t => t && t['fecha'] >= hoy)
      .sort((a, b) => a['fecha'].localeCompare(b['fecha']));

    if (futuros.length === 0) return null;
    return { nombre: futuros[0]['nombre'] as string, fecha: futuros[0]['fecha'] as string };
  }

  private async getProximaEscuadra(
    userId: string,
    hoy: string
  ): Promise<{ fecha: string; esquema: number } | null> {
    const { data } = await supabase
      .from('escuadra_tiradores')
      .select('escuadras(esquema, entrenamiento_id, entrenamientos(fecha))')
      .eq('user_id', userId);

    if (!data) return null;
    const futuras = (data as any[])
      .map(row => row['escuadras'])
      .filter(e => e && e['entrenamientos'] && e['entrenamientos']['fecha'] >= hoy)
      .sort((a, b) => a['entrenamientos']['fecha'].localeCompare(b['entrenamientos']['fecha']));

    if (futuras.length === 0) return null;
    return {
      fecha: futuras[0]['entrenamientos']['fecha'] as string,
      esquema: futuras[0]['esquema'] as number,
    };
  }

  private async getToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('No hay sesión activa');
    return token;
  }

  async generarInforme(nombre: string, contexto: ContextoCoach): Promise<string> {
    const token = await this.getToken();
    const res = await fetch(
      `${environment.supabaseUrl}/functions/v1/gemini-coach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': environment.supabaseAnonKey,
        },
        body: JSON.stringify({ modo: 'informe', nombre, contexto }),
      }
    );
    if (!res.ok) throw new Error(`Error generando informe: ${res.status}`);
    const json = await res.json();
    return json.respuesta as string;
  }

  async chat(mensajes: MensajeChat[], informeResumen: string): Promise<string> {
    const token = await this.getToken();
    const res = await fetch(
      `${environment.supabaseUrl}/functions/v1/gemini-coach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': environment.supabaseAnonKey,
        },
        body: JSON.stringify({ modo: 'chat', informeResumen, mensajes }),
      }
    );
    if (!res.ok) throw new Error(`Error en chat: ${res.status}`);
    const json = await res.json();
    return json.respuesta as string;
  }
}
