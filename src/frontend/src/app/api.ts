import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthUser, CardInput, Flashcard, FlashcardSet, SetDetail } from './models';
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private basePath = new URL(inject(DOCUMENT).baseURI).pathname.replace(/\/?$/, '/');
  private appUrl(path: string) {
    return this.basePath + path.replace(/^\//, '');
  }
  pictureUrl(content: string) {
    // Persist canonical picture references; apply the deployment prefix only when displaying them.
    return content.startsWith('/uploads/') ? this.appUrl(content) : content;
  }
  me() {
    return firstValueFrom(
      this.http.get<{ authenticated: boolean; user: AuthUser | null }>(this.appUrl('/api/auth/me')),
    );
  }
  authConfig() {
    return firstValueFrom(
      this.http.get<{ signInUrl: string; exchangeUrl: string }>(this.appUrl('/api/auth/config')),
    );
  }
  exchangeCode(url: string, code: string) {
    return firstValueFrom(
      this.http.post<{ token: string }>(url.startsWith('/api/') ? this.appUrl(url) : url, { code }),
    );
  }
  session(token: string) {
    return firstValueFrom(this.http.post(this.appUrl('/api/auth/session'), { token }));
  }
  logout() {
    return firstValueFrom(this.http.delete(this.appUrl('/api/auth/session')));
  }
  sets() {
    return firstValueFrom(this.http.get<FlashcardSet[]>(this.appUrl('/api/sets')));
  }
  detail(id: string) {
    return firstValueFrom(this.http.get<SetDetail>(this.appUrl(`/api/sets/${id}`)));
  }
  saveSet(id: string | null, value: { name: string; description: string; is_public: boolean }) {
    return firstValueFrom(
      id
        ? this.http.put<FlashcardSet>(this.appUrl(`/api/sets/${id}`), value)
        : this.http.post<FlashcardSet>(this.appUrl('/api/sets'), value),
    );
  }
  deleteSet(id: string) {
    return firstValueFrom(this.http.delete(this.appUrl(`/api/sets/${id}`)));
  }
  saveCard(setId: string, id: string | null, value: CardInput) {
    const url = this.appUrl(`/api/sets/${setId}/cards`);
    return firstValueFrom(
      id ? this.http.put<Flashcard>(`${url}/${id}`, value) : this.http.post<Flashcard>(url, value),
    );
  }
  deleteCard(setId: string, id: string) {
    return firstValueFrom(this.http.delete(this.appUrl(`/api/sets/${setId}/cards/${id}`)));
  }
  reorder(setId: string, card_ids: string[]) {
    return firstValueFrom(
      this.http.put(this.appUrl(`/api/sets/${setId}/cards/reorder`), { card_ids }),
    );
  }
  upload(file: File) {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(this.http.post<{ url: string }>(this.appUrl('/api/uploads'), body));
  }
}
