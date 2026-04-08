import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { Tarifa } from '../../../../core/models/escuadra.model';

interface TarifaEdit {
  id: string;
  tipo: 'socio' | 'no_socio';
  importe: number;
  importeEdit: number;   // valor temporal mientras edita
  editando: boolean;
  guardando: boolean;
  error: string;
}

@Component({
  selector: 'app-config-tarifas',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './config-tarifas.component.html',
  styleUrl: './config-tarifas.component.scss',
})
export class ConfigTarifasComponent {
  private escuadraService = inject(EscuadraService);
  private router          = inject(Router);

  private tarifasRaw = toSignal(this.escuadraService.getTarifas(), { initialValue: [] as Tarifa[] });

  tarifas = signal<TarifaEdit[]>([]);

  constructor() {
    // Inicializar cuando lleguen las tarifas
    const init = () => {
      const raw = this.tarifasRaw();
      if (raw.length > 0 && this.tarifas().length === 0) {
        this.tarifas.set(
          raw
            .slice()
            .sort((a, b) => a.tipo === 'socio' ? -1 : 1)
            .map(t => ({
              id:          t.id,
              tipo:        t.tipo,
              importe:     t.importe,
              importeEdit: t.importe,
              editando:    false,
              guardando:   false,
              error:       '',
            }))
        );
      }
    };

    // Effect-like: usar computed no es suficiente, usamos un getter reactivo
    // Recargamos tarifas al entrar al componente
    this.escuadraService.getTarifas().subscribe(raw => {
      this.tarifas.set(
        raw
          .slice()
          .sort((a, b) => a.tipo === 'socio' ? -1 : 1)
          .map(t => ({
            id:          t.id,
            tipo:        t.tipo,
            importe:     t.importe,
            importeEdit: t.importe,
            editando:    false,
            guardando:   false,
            error:       '',
          }))
      );
    });
  }

  label(tipo: 'socio' | 'no_socio'): string {
    return tipo === 'socio' ? 'Socio' : 'No socio';
  }

  icon(tipo: 'socio' | 'no_socio'): string {
    return tipo === 'socio' ? 'bi-person-check-fill' : 'bi-person-plus-fill';
  }

  abrirEdicion(index: number): void {
    const lista = [...this.tarifas()];
    lista[index] = { ...lista[index], editando: true, importeEdit: lista[index].importe, error: '' };
    this.tarifas.set(lista);
  }

  cancelarEdicion(index: number): void {
    const lista = [...this.tarifas()];
    lista[index] = { ...lista[index], editando: false, error: '' };
    this.tarifas.set(lista);
  }

  async guardar(index: number): Promise<void> {
    const lista  = [...this.tarifas()];
    const tarifa = lista[index];

    if (!tarifa.importeEdit || tarifa.importeEdit <= 0) {
      lista[index] = { ...tarifa, error: 'El importe debe ser mayor que 0' };
      this.tarifas.set(lista);
      return;
    }

    lista[index] = { ...tarifa, guardando: true, error: '' };
    this.tarifas.set(lista);

    try {
      await this.escuadraService.updateTarifa(tarifa.id, Number(tarifa.importeEdit));
      const updated = [...this.tarifas()];
      updated[index] = {
        ...updated[index],
        importe:   Number(tarifa.importeEdit),
        editando:  false,
        guardando: false,
      };
      this.tarifas.set(updated);
    } catch (err) {
      const updated = [...this.tarifas()];
      updated[index] = {
        ...updated[index],
        guardando: false,
        error: err instanceof Error ? err.message : 'Error al guardar',
      };
      this.tarifas.set(updated);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/caja']);
  }
}
