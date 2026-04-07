import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../user.service';
import { UserRole } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-socio',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-socio.component.html',
  styleUrl: './form-socio.component.scss',
})
export class FormSocioComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  private editId?: string;
  saving = signal(false);
  error = signal('');

  form = this.fb.group({
    nombre:      ['', Validators.required],
    apellidos:   ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    rol:         ['socio' as UserRole, Validators.required],
    numeroSocio: ['', Validators.required],
    dni:         [''],
    telefono:    [''],
    direccion:   [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const user = this.userService.getById(id);
      if (user) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue(user);
        this.form.get('email')?.disable();
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const val = this.form.getRawValue();

    try {
      if (this.isEdit && this.editId) {
        await this.userService.update(this.editId, {
          nombre: val.nombre!,
          apellidos: val.apellidos!,
          rol: val.rol as UserRole,
          numeroSocio: val.numeroSocio!,
          dni: val.dni || undefined,
          telefono: val.telefono || undefined,
          direccion: val.direccion || undefined,
        });
      } else {
        await this.userService.crearEnAuth({
          nombre: val.nombre!,
          apellidos: val.apellidos!,
          email: val.email!,
          rol: val.rol!,
          numeroSocio: val.numeroSocio!,
          dni: val.dni || undefined,
          telefono: val.telefono || undefined,
          direccion: val.direccion || undefined,
        });
      }
      this.router.navigate(['/admin/socios']);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/socios']);
  }
}
