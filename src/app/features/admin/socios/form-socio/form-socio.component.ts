import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../user.service';
import { UserRole, TipoCuota } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-socio',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-socio.component.html',
  styleUrl: './form-socio.component.scss',
})
export class FormSocioComponent implements OnInit {
  private fb          = inject(FormBuilder);
  private userService = inject(UserService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);

  isEdit   = false;
  private editId?: string;
  saving   = signal(false);
  error    = signal('');

  form = this.fb.group({
    nombre:      ['', Validators.required],
    apellidos:   ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    rol:         ['socio' as UserRole, Validators.required],
    numeroSocio: [null as number | null, [Validators.required, Validators.min(1)]],
    dni:         ['', Validators.required],
    telefono:    ['', Validators.required],
    direccion:   [''],
    localidad:   ['', Validators.required],
    tipoCuota:   ['socio' as TipoCuota, Validators.required],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const user = this.userService.getById(id);
      if (user) {
        this.isEdit  = true;
        this.editId  = id;
        this.form.patchValue({
          nombre:      user.nombre,
          apellidos:   user.apellidos,
          email:       user.email,
          rol:         user.rol,
          numeroSocio: user.numeroSocio,
          dni:         user.dni ?? '',
          telefono:    user.telefono ?? '',
          direccion:   user.direccion ?? '',
          localidad:   user.localidad,
          tipoCuota:   user.tipoCuota ?? 'socio',
        });
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
          nombre:      val.nombre!,
          apellidos:   val.apellidos!,
          email:       val.email!,
          rol:         val.rol as UserRole,
          numeroSocio: val.numeroSocio!,
          dni:         val.dni     || undefined,
          telefono:    val.telefono || undefined,
          direccion:   val.direccion || undefined,
          localidad:   val.localidad || undefined,
          tipoCuota:   (val.tipoCuota as TipoCuota) ?? 'socio',
        });
      } else {
        await this.userService.crearEnAuth({
          nombre:      val.nombre!,
          apellidos:   val.apellidos!,
          email:       val.email!,
          rol:         val.rol!,
          numeroSocio: val.numeroSocio!,
          dni:         val.dni     || undefined,
          telefono:    val.telefono || undefined,
          direccion:   val.direccion || undefined,
          localidad:   val.localidad || undefined,
          tipoCuota:   (val.tipoCuota as TipoCuota) ?? 'socio',
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
