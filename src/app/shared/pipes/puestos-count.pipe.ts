import { Pipe, PipeTransform } from '@angular/core';

interface PuestoVM {
  tipo: 'vacio' | 'socio' | 'no_socio';
}

@Pipe({ name: 'puestosCount', standalone: true, pure: false })
export class PuestosCountPipe implements PipeTransform {
  transform(puestos: PuestoVM[], tipo: 'socio' | 'no_socio'): number {
    return puestos.filter(p => p.tipo === tipo).length;
  }
}
