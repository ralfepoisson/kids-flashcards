import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideToastr, ToastrService } from 'ngx-toastr';
import { App } from './app';
const owner = {
  subject: 'parent',
  accountId: 'family',
  displayName: 'Parent',
  email: 'parent@example.test',
};
const shared = {
  id: 'public',
  name: 'Shared lesson',
  description: '',
  card_count: 1,
  created_at: '',
  is_public: true,
  can_edit: false,
};
const card = {
  id: 'card',
  set_id: 'public',
  position: 0,
  front_type: 'text',
  front_content: 'One',
  front_instruction: '',
  back_type: 'text',
  back_content: 'Un',
  back_explanation: '',
};
describe('Authentication and permissions UI unit checks', () => {
  beforeEach(async () => {
    localStorage.setItem('kids-flashcards-language', 'en');
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        provideLocationMocks(),
      ],
    }).compileComponents();
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.inject(ToastrService).clear();
    localStorage.clear();
    sessionStorage.clear();
  });
  async function start(authenticated = false, sets = [shared]) {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/auth/me').flush({ authenticated, user: authenticated ? owner : null });
    await Promise.resolve();
    http.expectOne('/api/sets').flush(sets);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('lets guests browse and practise without mutation controls', async () => {
    const fixture = await start();
    const app = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('.auth-button').textContent).toContain('Log in');
    expect(fixture.nativeElement.querySelector('.sidebar-add')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Create a set');
    fixture.nativeElement.querySelector('.set-tile').click();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/sets/public')
      .flush({ ...shared, cards: [card] });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.practice-card')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Edit Mode');
    expect(fixture.nativeElement.querySelector('.heading-actions')).toBeNull();
    fixture.nativeElement.querySelector('.practice-card').click();
    expect(app.flipped()).toBe(true);
    app.openSet();
    app.openCard();
    app.switchMode('edit');
    expect(app.editor()).toBeNull();
    expect(app.mode()).toBe('practice');
  });
  it('downgrades another creator public edit deep link to practice', async () => {
    const location = TestBed.inject(Location);
    location.replaceState('/set/public/edit');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/auth/me').flush({ authenticated: true, user: owner });
    await Promise.resolve();
    http.expectOne('/api/sets').flush([shared]);
    await fixture.whenStable();
    http.expectOne('/api/sets/public').flush({ ...shared, cards: [card] });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(location.path()).toBe('/set/public/practice');
    expect(fixture.componentInstance.mode()).toBe('practice');
    expect(fixture.nativeElement.textContent).not.toContain('Edit Mode');
    expect(fixture.nativeElement.querySelector('.sidebar-add')).not.toBeNull();
  });
  it('defaults new series to private and saves the public flag from the real form', async () => {
    const fixture = await start(true, []);
    const app = fixture.componentInstance;
    app.openSet();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const checkbox = fixture.nativeElement.querySelector('#set-public') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    checkbox.click();
    const input = fixture.nativeElement.querySelector('#set-name') as HTMLInputElement;
    input.value = 'My lesson';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('/api/sets');
    expect(request.request.body).toEqual({ name: 'My lesson', description: '', is_public: true });
    const saved = { ...shared, name: 'My lesson', can_edit: true };
    request.flush(saved);
    await Promise.resolve();
    http.expectOne('/api/sets').flush([saved]);
    await Promise.resolve();
    http.expectOne('/api/sets/public').flush({ ...saved, cards: [] });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Edit Mode');
    expect(fixture.nativeElement.textContent).toContain('Public');
  });
  it('scrubs callback before requests, exchanges once and stores no browser credentials', async () => {
    const location = TestBed.inject(Location);
    location.replaceState('/auth/callback?handoff_code=secret-code');
    sessionStorage.setItem('kids-flashcards-login-pending', '1');
    sessionStorage.setItem('kids-flashcards-login-return', '/set/public/practice');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(location.path() || '/').toBe('/');
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/auth/config')
      .flush({
        signInUrl: 'https://auth.example/sign-in',
        exchangeUrl: 'https://auth.example/exchange',
      });
    await Promise.resolve();
    const exchange = http.expectOne('https://auth.example/exchange');
    expect(exchange.request.body).toEqual({ code: 'secret-code' });
    exchange.flush({ token: 'secret-token' });
    await Promise.resolve();
    const session = http.expectOne('/api/auth/session');
    expect(session.request.body).toEqual({ token: 'secret-token' });
    session.flush({});
    await Promise.resolve();
    http.expectOne('/api/auth/me').flush({ authenticated: true, user: owner });
    await Promise.resolve();
    http.expectOne('/api/sets').flush([shared]);
    await fixture.whenStable();
    http.expectOne('/api/sets/public').flush({ ...shared, cards: [card] });
    await fixture.whenStable();
    expect(fixture.componentInstance.user()?.displayName).toBe('Parent');
    expect(location.path()).toBe('/set/public/practice');
    expect(Object.values(localStorage).join('')).not.toContain('secret');
    expect(sessionStorage.length).toBe(0);
  });
  it('continues public access when callback exchange fails', async () => {
    const location = TestBed.inject(Location);
    location.replaceState('/auth/callback?handoff_code=bad-code');
    sessionStorage.setItem('kids-flashcards-login-pending', '1');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/auth/config')
      .flush({
        exchangeUrl: 'https://auth.example/exchange',
        signInUrl: 'https://auth.example/sign-in',
      });
    await Promise.resolve();
    http
      .expectOne('https://auth.example/exchange')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/auth/me').flush({ authenticated: false, user: null });
    await Promise.resolve();
    http.expectOne('/api/sets').flush([shared]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.user()).toBeNull();
    expect(location.path() || '/').toBe('/');
    expect(fixture.nativeElement.querySelector('.set-tile')).not.toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
  it('drops private details and drafts immediately on logout then refreshes public visibility', async () => {
    const privateSet = { ...shared, is_public: false, can_edit: true };
    const fixture = await start(true, [privateSet]);
    const app = fixture.componentInstance;
    app.selected.set({ ...privateSet, cards: [] });
    app.openSet(privateSet);
    app.setDraft.name = 'Private draft';
    const pending = app.logout();
    expect(app.selected()).toBeNull();
    expect(app.editor()).toBeNull();
    expect(app.setDraft.name).toBe('');
    expect(app.user()).toBeNull();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/auth/session').flush({});
    await Promise.resolve();
    http.expectOne('/api/sets').flush([shared]);
    await pending;
    fixture.detectChanges();
    expect(app.sets()).toEqual([shared]);
    expect(fixture.nativeElement.querySelector('.sidebar-add')).toBeNull();
  });
  it('drops private state and refreshes public list after session expiry', async () => {
    const privateSet = { ...shared, is_public: false, can_edit: true };
    const fixture = await start(true, [privateSet]);
    const app = fixture.componentInstance;
    app.selected.set({ ...privateSet, cards: [] });
    app.openSet(privateSet);
    const pending = app.saveSet();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/sets/public').flush({}, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    await Promise.resolve();
    expect(app.user()).toBeNull();
    expect(app.selected()).toBeNull();
    expect(app.editor()).toBeNull();
    http.expectOne('/api/sets').flush([shared]);
    await pending;
    expect(app.sets()).toEqual([shared]);
  });
  it('restores owner access to private series after reloading an edit deep link', async () => {
    const privateSet = { ...shared, is_public: false, can_edit: true };
    const location = TestBed.inject(Location);
    location.replaceState('/set/public/edit');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/auth/me').flush({ authenticated: true, user: owner });
    await Promise.resolve();
    http.expectOne('/api/sets').flush([privateSet]);
    await fixture.whenStable();
    http.expectOne('/api/sets/public').flush({ ...privateSet, cards: [] });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.mode()).toBe('edit');
    expect(fixture.nativeElement.textContent).toContain('Private');
    expect(fixture.nativeElement.querySelector('.heading-actions')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.auth-button').textContent).toContain('Log out');
  });
  it('rejects callbacks without prior login intent while preserving guest access', async () => {
    const location = TestBed.inject(Location);
    location.replaceState('/auth/callback?handoff_code=unexpected-code');
    const fixture = await start();
    const http = TestBed.inject(HttpTestingController);
    http.expectNone('/api/auth/config');
    expect(location.path() || '/').toBe('/');
    expect(fixture.componentInstance.user()).toBeNull();
    expect(fixture.nativeElement.querySelector('.set-tile')).not.toBeNull();
  });
  it('offers useful retry feedback when Life2 login configuration is unavailable', async () => {
    const fixture = await start();
    const toast = TestBed.inject(ToastrService);
    const failure = vi.spyOn(toast, 'error');
    fixture.nativeElement.querySelector('.auth-button').click();
    TestBed.inject(HttpTestingController).expectOne('/api/auth/config').flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(failure).toHaveBeenCalledWith('Life2 login is unavailable. Please try again shortly.', 'Something went wrong');
    expect(fixture.nativeElement.querySelector('.auth-button').disabled).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });
});
