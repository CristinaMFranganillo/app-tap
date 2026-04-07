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
  platosRotos: number;
  fallos: number;
}

@Component({
  selector: 'app-resumen-escuadra-entrenamiento',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './resumen-escuadra-entrenamiento.component.html',
  styleUrl: './resumen-escuadra-entrenamiento.component.scss',
})
export class ResumenEscuadraEntrenamientoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private userService = inject(UserService);

  private escuadraId = this.route.snapshot.paramMap.get('escuadraId')!;
  private entrenamientoId = this.route.snapshot.paramMap.get('entrenamientoId')!;

  filas = signal<FilaResumen[]>([]);
  cargando = signal(true);

  async ngOnInit(): Promise<void> {
    const [resultados, socios] = await Promise.all([
      firstValueFrom(this.entrenamientoService.getResultadosByEscuadra(this.escuadraId)),
      firstValueFrom(this.userService.getAll()),
    ]);

    const filas: FilaResumen[] = resultados.map((r: ResultadoEntrenamiento) => {
      const socio = socios.find(s => s.id === r.userId);
      return {
        puesto: r.puesto,
        nombre: socio ? `${socio.nombre} ${socio.apellidos}` : r.userId,
        platosRotos: r.platosRotos,
        fallos: 25 - r.platosRotos,
      };
    }).sort((a, b) => a.puesto - b.puesto);

    this.filas.set(filas);
    this.cargando.set(false);
  }

  get total(): number {
    return this.filas().reduce((s, f) => s + f.platosRotos, 0);
  }

  get totalPosible(): number {
    return this.filas().length * 25;
  }

  volverEntrenamiento(): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
  }
}
