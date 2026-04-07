import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NewsService } from '../../../noticias/news.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-form-noticia',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-noticia.component.html',
  styleUrl: './form-noticia.component.scss',
})
export class FormNoticiaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private newsService = inject(NewsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  private editId?: string;

  form = this.fb.group({
    titulo:    ['', Validators.required],
    contenido: ['', Validators.required],
    publicada: [false],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const noticia = await this.newsService.getById(id);
      if (noticia) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue(noticia);
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const val = this.form.value;
    const autorId = this.authService.currentUser?.id ?? '1';

    if (this.isEdit && this.editId) {
      await this.newsService.update(this.editId, {
        titulo: val.titulo!,
        contenido: val.contenido!,
        publicada: val.publicada ?? false,
      });
    } else {
      await this.newsService.create({
        titulo: val.titulo!,
        contenido: val.contenido!,
        publicada: val.publicada ?? false,
        autorId,
        fecha: new Date(),
      });
    }
    this.router.navigate(['/admin/noticias']);
  }

  cancel(): void {
    this.router.navigate(['/admin/noticias']);
  }
}
