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
})
export class FormCompeticionComponent {
  private fb = inject(FormBuilder);
  private competicionService = inject(CompeticionService);
  private authService = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    nombre:      ['', Validators.required],
    modalidad:   ['', Validators.required],
    totalPlatos: [25, [Validators.required, Validators.min(1)]],
    fecha:       ['', Validators.required],
    activa:      [false],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    this.competicionService.create({
      nombre: val.nombre!,
      modalidad: val.modalidad!,
      totalPlatos: Number(val.totalPlatos),
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
