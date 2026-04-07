import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CompeticionService } from '../../../scores/competicion.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-form-competicion',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-competicion.component.html',
  styleUrl: './form-competicion.component.scss',
})
export class FormCompeticionComponent {
  private fb = inject(FormBuilder);
  private competicionService = inject(CompeticionService);
  private authService = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    nombre:        ['', Validators.required],
    modalidad:     ['', Validators.required],
    platosPorSerie:[25, [Validators.required, Validators.min(1)]],
    numSeries:     [1,  [Validators.required, Validators.min(1)]],
    lugar:         [''],
    fecha:         ['', Validators.required],
    activa:        [false],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const val = this.form.value;
    await this.competicionService.create({
      nombre: val.nombre!,
      modalidad: val.modalidad!,
      platosPorSerie: Number(val.platosPorSerie),
      numSeries: Number(val.numSeries),
      lugar: val.lugar || undefined,
      fecha: new Date(val.fecha!),
      activa: val.activa ?? false,
      creadaPor: this.authService.currentUser?.id ?? '1',
    });
    this.router.navigate(['/scores']);
  }

  cancel(): void {
    this.router.navigate(['/scores']);
  }
}
