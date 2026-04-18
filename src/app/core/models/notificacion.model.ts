// src/app/core/models/notificacion.model.ts
export type TipoNotificacion = 'torneo' | 'cuota' | 'aviso' | 'resultado' | 'otro';

export interface Notificacion {
  id: string;
  titulo: string;
  cuerpo: string;
  tipo: TipoNotificacion;
  destinatarios: string[] | null;
  fechaExpiracion: string | null;
  createdAt: string;
  leida: boolean;
}

export interface NotificacionForm {
  titulo: string;
  cuerpo: string;
  tipo: TipoNotificacion;
  destinatarios: string[] | null;
  fechaExpiracion: string | null;
}
