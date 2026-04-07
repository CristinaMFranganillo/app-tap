import { Component, inject, output, signal } from '@angular/core';
import { AvatarUploadService } from '../../../core/services/avatar-upload.service';

@Component({
  selector: 'app-avatar-editor',
  standalone: true,
  templateUrl: './avatar-editor.component.html',
  styleUrl: './avatar-editor.component.scss',
})
export class AvatarEditorComponent {
  private uploadService = inject(AvatarUploadService);

  completado = output<void>();
  omitido    = output<void>();

  preview   = signal<string | null>(null);
  saving    = signal(false);
  error     = signal('');
  private selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Solo se permiten imágenes.');
      return;
    }
    this.selectedFile = file;
    this.error.set('');
    const reader = new FileReader();
    reader.onload = e => this.preview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async guardar(): Promise<void> {
    if (!this.selectedFile) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.uploadService.upload(this.selectedFile);
      this.completado.emit();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al subir la imagen.');
    } finally {
      this.saving.set(false);
    }
  }

  omitir(): void {
    this.omitido.emit();
  }
}
