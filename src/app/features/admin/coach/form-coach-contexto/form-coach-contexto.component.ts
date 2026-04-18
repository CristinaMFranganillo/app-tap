import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CoachContextoService } from '../coach-contexto.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-form-coach-contexto',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-coach-contexto.component.html',
})
export class FormCoachContextoComponent implements OnInit {
  private fb      = inject(FormBuilder);
  private service = inject(CoachContextoService);
  private auth    = inject(AuthService);
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);

  isEdit    = false;
  editId?: string;
  guardando = false;

  form = this.fb.group({
    titulo:          ['', Validators.required],
    contenido:       ['', Validators.required],
    categoria:       ['noticia', Validators.required],
    activo:          [true],
    fechaExpiracion: [null as string | null],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const entrada = await this.service.getById(id);
      if (entrada) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue({
          titulo:          entrada.titulo,
          contenido:       entrada.contenido,
          categoria:       entrada.categoria,
          activo:          entrada.activo,
          fechaExpiracion: entrada.fechaExpiracion,
        });
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.guardando) return;
    this.guardando = true;
    const val = this.form.value;
    try {
      if (this.isEdit && this.editId) {
        await this.service.actualizar(this.editId, {
          titulo:          val.titulo!,
          contenido:       val.contenido!,
          categoria:       val.categoria as any,
          activo:          val.activo ?? true,
          fechaExpiracion: val.fechaExpiracion ?? null,
        });
      } else {
        const userId = this.auth.currentUser?.id ?? '';
        await this.service.crear({
          titulo:          val.titulo!,
          contenido:       val.contenido!,
          categoria:       val.categoria as any,
          activo:          val.activo ?? true,
          fechaExpiracion: val.fechaExpiracion ?? null,
        }, userId);
      }
      this.router.navigate(['/admin/coach']);
    } finally {
      this.guardando = false;
    }
  }

  cancelar(): void {
    this.router.navigate(['/admin/coach']);
  }
}
