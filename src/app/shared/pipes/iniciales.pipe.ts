import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'iniciales',
  standalone: true,
})
export class InicialesPipe implements PipeTransform {
  transform(nombre: string, apellidos: string): string {
    const n = nombre?.trim();
    const a = apellidos?.trim();
    if (!n && !a) return '?';
    const inicial1 = n ? n[0].toUpperCase() : '';
    const inicial2 = a ? a[0].toUpperCase() : '';
    return inicial1 + inicial2;
  }
}
