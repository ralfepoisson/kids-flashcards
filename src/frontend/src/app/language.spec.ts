import { TestBed } from '@angular/core/testing';
import { InterfaceLanguage } from './language';

describe('Interface language', () => {
  beforeEach(() => {
    window.localStorage.removeItem('kids-flashcards-language');
    TestBed.configureTestingModule({});
  });
  afterEach(() => window.localStorage.removeItem('kids-flashcards-language'));

  it('defaults to French without a saved preference', () => {
    const language = TestBed.inject(InterfaceLanguage);
    expect(language.language()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('restores an explicitly saved English preference', () => {
    window.localStorage.setItem('kids-flashcards-language', 'en');
    const language = TestBed.inject(InterfaceLanguage);
    expect(language.language()).toBe('en');
    language.toggle();
    expect(window.localStorage.getItem('kids-flashcards-language')).toBe('fr');
  });

  it('uses French for an invalid saved language', () => {
    window.localStorage.setItem('kids-flashcards-language', 'de');
    const language = TestBed.inject(InterfaceLanguage);
    expect(language.language()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('works even when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    try {
      const language = TestBed.inject(InterfaceLanguage);
      expect(language.language()).toBe('fr');
      language.toggle();
      language.toggle();
      expect(language.t('mySets')).toBe('Mes séries de cartes');
      expect(document.documentElement.lang).toBe('fr');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('translates server failures and interpolates user text without changing it', () => {
    const language = TestBed.inject(InterfaceLanguage);
    expect(language.error('The upload is not a valid picture')).toBe(
      'Le fichier envoyé n’est pas une image valide',
    );
    expect(language.error('Unknown server failure')).toBe('La demande a échoué. Réessaie.');
    const name = '{count} English & <French>';
    expect(language.t('deleteSetMessage', { name })).toContain(name);
    language.toggle();
    expect(language.error('Unknown server failure')).toBe('Unknown server failure');
  });
});
