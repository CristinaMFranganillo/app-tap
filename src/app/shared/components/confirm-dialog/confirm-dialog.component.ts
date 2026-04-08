import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [NgClass],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  titulo  = input<string>('¿Estás seguro?');
  mensaje = input<string>('Esta acción no se puede deshacer.');
  labelConfirmar = input<string>('Eliminar');
  icono = input<string>('bi-trash3-fill');
  colorIconoFondo = input<string>('#FEE2E2');
  colorIcono = input<string>('#DC2626');
  colorConfirmar = input<string>('#EF4444');

  confirmado = output<void>();
  cancelado  = output<void>();
}
