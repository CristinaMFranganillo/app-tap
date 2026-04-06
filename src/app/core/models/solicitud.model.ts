export type EstadoSolicitud = 'pendiente' | 'aceptada' | 'rechazada';

export interface SolicitudRegistro {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  mensaje?: string;
  estado: EstadoSolicitud;
  fecha: Date;
  revisadaPor?: string;
  fechaRevision?: Date;
  motivoRechazo?: string;
}
