import {
  afterNextRender,
  Directive,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  output,
} from '@angular/core';

@Directive({ selector: '[appDialog]' })
export class Dialog implements OnDestroy {
  dismiss = output<void>();
  private element: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;
  private previous = document.activeElement as HTMLElement | null;
  constructor() {
    afterNextRender(() => {
      const first =
        this.element.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        ) ?? this.focusable()[0];
      first?.focus();
    });
  }
  private focusable() {
    return [
      ...this.element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
      ),
    ];
  }
  @HostListener('keydown', ['$event'])
  keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss.emit();
    }
    if (event.key !== 'Tab') return;
    const elements = this.focusable();
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  ngOnDestroy() {
    if (this.previous?.isConnected) this.previous.focus();
  }
}
