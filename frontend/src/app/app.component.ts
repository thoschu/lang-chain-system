import { Component, inject, signal, WritableSignal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private static readonly url: URL = new URL('http://localhost:8008/');
  readonly #sanitizer: DomSanitizer = inject<DomSanitizer>(DomSanitizer);
  readonly #sanitizedUrlHref: SafeResourceUrl = this.#sanitizer.bypassSecurityTrustResourceUrl(AppComponent.url.href);
  protected readonly title: string = 'LangChain by Tom S.';
  protected readonly href: WritableSignal<SafeResourceUrl> = signal<SafeResourceUrl>(this.#sanitizedUrlHref);
}
