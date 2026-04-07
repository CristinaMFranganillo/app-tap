import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InicialesPipe } from '../../pipes/iniciales.pipe';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule, InicialesPipe],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {
  @Input() nombre: string = '';
  @Input() apellidos: string = '';
  @Input() avatarUrl?: string;
  @Input() size: number = 40;
}
