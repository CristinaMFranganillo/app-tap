import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center py-10 text-center">
      <i class="bi text-[36px] text-gray-200 mb-2" [class]="icon"></i>
      <p class="text-[9px] font-bold text-gray-300 uppercase tracking-wider">{{ mensaje }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon = 'bi-inbox';
  @Input() mensaje = 'Sin resultados';
}
