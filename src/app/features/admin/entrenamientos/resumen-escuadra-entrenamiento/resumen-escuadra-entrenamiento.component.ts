import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { EntrenamientoService } from '../entrenamiento.service';
import { UserService } from '../../socios/user.service';
import { ResultadoEntrenamiento } from '../../../../core/models/entrenamiento.model';

interface FilaResumen {
  puesto: number;
  nombre: string;
  esNoSocio: boolean;
  platosRotos: number;
  fallos: number;
  numerosFallos: number[];
}

@Component({
  selector: 'app-resumen-escuadra-entrenamiento',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './resumen-escuadra-entrenamiento.component.html',
  styleUrl: './resumen-escuadra-entrenamiento.component.scss',
})
export class ResumenEscuadraEntrenamientoComponent implements OnInit {
  private route                = inject(ActivatedRoute);
  private router               = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private userService          = inject(UserService);

  private escuadraId     = this.route.snapshot.paramMap.get('escuadraId')!;
  private entrenamientoId = this.route.snapshot.paramMap.get('entrenamientoId')!;
  private fechaDia        = this.route.snapshot.queryParamMap.get('fecha');

  filas    = signal<FilaResumen[]>([]);
  cargando = signal(true);

  async ngOnInit(): Promise<void> {
    const [resultados, socios, fallos] = await Promise.all([
      firstValueFrom(this.entrenamientoService.getResultadosByEscuadra(this.escuadraId)),
      firstValueFrom(this.userService.getAll()),
      firstValueFrom(this.entrenamientoService.getFallosByEscuadra(this.escuadraId)),
    ]);

    // Fallos indexados por userId (solo socios)
    const fallosPorUser = new Map<string, number[]>();
    for (const f of fallos) {
      if (!fallosPorUser.has(f.userId)) fallosPorUser.set(f.userId, []);
      fallosPorUser.get(f.userId)!.push(f.numeroPlato);
    }

    const filas: FilaResumen[] = (resultados as ResultadoEntrenamiento[])
      .map(r => {
        const nombre = r.esNoSocio
          ? (r.nombreExterno ?? 'No socio')
          : (socios.find(s => s.id === r.userId)
              ? `${socios.find(s => s.id === r.userId)!.nombre} ${socios.find(s => s.id === r.userId)!.apellidos}`
              : (r.userId ?? '—'));

        const numerosFallos = (!r.esNoSocio && r.userId)
          ? (fallosPorUser.get(r.userId) ?? []).sort((a, b) => a - b)
          : [];

        return {
          puesto:       r.puesto,
          nombre,
          esNoSocio:    r.esNoSocio,
          platosRotos:  r.platosRotos,
          fallos:       25 - r.platosRotos,
          numerosFallos,
        };
      })
      .sort((a, b) => a.puesto - b.puesto);

    this.filas.set(filas);
    this.cargando.set(false);
  }

  get total(): number        { return this.filas().reduce((s, f) => s + f.platosRotos, 0); }
  get totalPosible(): number { return this.filas().length * 25; }

  volverEntrenamiento(): void {
    if (this.fechaDia) {
      this.router.navigate(['/admin/entrenamientos/dia', this.fechaDia], { queryParams: { modo: 'editar' } });
    } else {
      this.router.navigate(['/admin/entrenamientos', this.entrenamientoId], { queryParams: { modo: 'editar' } });
    }
  }
}
