import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { supabase } from '../supabase/supabase.client';

const MAX_SIZE = 300; // px

@Injectable({ providedIn: 'root' })
export class AvatarUploadService {
  private auth = inject(AuthService);

  async upload(file: File): Promise<void> {
    const userId = this.auth.currentUser?.id;
    if (!userId) throw new Error('No hay sesión activa');

    const resized = await this.resizeImage(file, MAX_SIZE);
    const path = `${userId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, resized, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (updateError) throw new Error(updateError.message);

    await this.auth.reloadProfile();
  }

  private resizeImage(file: File, maxSize: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Error al procesar la imagen'));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = url;
    });
  }
}
