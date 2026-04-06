export interface Escuadra {
  id: string;
  competicionId: string;
  numero: number;
  tiradores?: EscuadraTirador[];
}

export interface EscuadraTirador {
  id: string;
  escuadraId: string;
  userId: string;
  puesto: number;
}
