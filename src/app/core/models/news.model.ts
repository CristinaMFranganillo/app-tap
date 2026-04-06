export interface News {
  id: string;
  titulo: string;
  contenido: string;
  autorId: string;
  fecha: Date;
  imagenUrl?: string;
  publicada: boolean;
}
