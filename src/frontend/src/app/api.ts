import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthUser, CardInput, Flashcard, FlashcardSet, SetDetail } from './models';
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  me() {
    return firstValueFrom(
      this.http.get<{ authenticated: boolean; user: AuthUser | null }>('/api/auth/me'),
    );
  }
  authConfig() {
    return firstValueFrom(
      this.http.get<{ signInUrl: string; exchangeUrl: string }>('/api/auth/config'),
    );
  }
  exchangeCode(url: string, code: string) {
    return firstValueFrom(this.http.post<{ token: string }>(url, { code }));
  }
  session(token: string) {
    return firstValueFrom(this.http.post('/api/auth/session', { token }));
  }
  logout() {
    return firstValueFrom(this.http.delete('/api/auth/session'));
  }
  sets() {
    return firstValueFrom(this.http.get<FlashcardSet[]>('/api/sets'));
  }
  detail(id: string) {
    return firstValueFrom(this.http.get<SetDetail>(`/api/sets/${id}`));
  }
  saveSet(id: string | null, value: { name: string; description: string; is_public: boolean }) {
    return firstValueFrom(
      id
        ? this.http.put<FlashcardSet>(`/api/sets/${id}`, value)
        : this.http.post<FlashcardSet>('/api/sets', value),
    );
  }
  deleteSet(id: string) {
    return firstValueFrom(this.http.delete(`/api/sets/${id}`));
  }
  saveCard(setId: string, id: string | null, value: CardInput) {
    const url = `/api/sets/${setId}/cards`;
    return firstValueFrom(
      id ? this.http.put<Flashcard>(`${url}/${id}`, value) : this.http.post<Flashcard>(url, value),
    );
  }
  deleteCard(setId: string, id: string) {
    return firstValueFrom(this.http.delete(`/api/sets/${setId}/cards/${id}`));
  }
  reorder(setId: string, card_ids: string[]) {
    return firstValueFrom(this.http.put(`/api/sets/${setId}/cards/reorder`, { card_ids }));
  }
  upload(file: File) {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(this.http.post<{ url: string }>('/api/uploads', body));
  }
}
