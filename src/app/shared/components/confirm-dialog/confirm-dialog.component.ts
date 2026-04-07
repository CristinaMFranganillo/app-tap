import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  titulo  = input<string>('¿Estás seguro?');
  mensaje = input<string>('Esta acción no se puede deshacer.');
  labelConfirmar = input<string>('Eliminar');

  confirmado = output<void>();
  cancelado  = output<void>();
}
