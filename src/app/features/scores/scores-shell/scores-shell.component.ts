import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-scores-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './scores-shell.component.html',
  styleUrl: './scores-shell.component.scss',
})
export class ScoresShellComponent {}
