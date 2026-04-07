import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {
  @Input() nombre: string = '';
  @Input() apellidos: string = '';
  @Input() avatarUrl?: string;
  @Input() size: number = 40;
}
