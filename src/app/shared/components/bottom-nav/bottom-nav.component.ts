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
  { route: '/scores',    icon: 'bi-bullseye',  label: 'Entrena'  },
  { route: '/metricas',  icon: 'bi-graph-up',  label: 'Métricas' },
  { route: '/coach',     icon: 'bi-robot',     label: 'Coach'    },
];

const ADMIN_NAV: NavItem[] = [
  { route: '/',                icon: 'bi-house',     label: 'Inicio'   },
  { route: '/admin/socios',    icon: 'bi-people',    label: 'Socios'   },
  { route: '/admin/noticias',  icon: 'bi-newspaper', label: 'Noticias' },
  { route: '/admin/scores',    icon: 'bi-bullseye',  label: 'Entrena'  },
  { route: '/metricas',        icon: 'bi-gear',      label: 'Admin'    },
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
