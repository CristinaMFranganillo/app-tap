import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  route: string;
  icon: string;
  label: string;
}

const SOCIO_NAV: NavItem[] = [
  { route: '/',          icon: 'bi-house',     label: 'Inicio'   },
  { route: '/noticias',  icon: 'bi-newspaper', label: 'Noticias' },
  { route: '/scores',    icon: 'bi-bullseye',  label: 'Entrena'  },
  { route: '/perfil',    icon: 'bi-person',    label: 'Perfil'   },
];

const ADMIN_NAV: NavItem[] = [
  { route: '/',                icon: 'bi-house',     label: 'Inicio'   },
  { route: '/admin/socios',    icon: 'bi-people',    label: 'Socios'   },
  { route: '/admin/noticias',  icon: 'bi-newspaper', label: 'Noticias' },
  { route: '/admin/scores',    icon: 'bi-bullseye',  label: 'Entrena'  },
  { route: '/perfil',          icon: 'bi-gear',      label: 'Config'   },
];

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  private auth = inject(AuthService);

  get navItems(): NavItem[] {
    return this.auth.hasRole(['admin', 'moderador']) ? ADMIN_NAV : SOCIO_NAV;
  }
}
