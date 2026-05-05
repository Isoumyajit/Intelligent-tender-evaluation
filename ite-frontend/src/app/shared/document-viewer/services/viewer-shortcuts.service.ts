import { Injectable, OnDestroy } from '@angular/core';
import { ViewerStateService } from './viewer-state.service';

type KeyBinding = {
  combo: string;
  handler: () => void;
  description: string;
};

/**
 * Keyboard shortcuts for the viewer. Bindings live in one table so they stay
 * discoverable and easy to extend — today it is zoom / rotate / paginate /
 * fullscreen; tomorrow it is find-in-document / annotations / bookmarks.
 *
 * Shortcuts are active only while `enable()` has been called and `disable()`
 * hasn't. The owning component wires enable() on mount, disable() on destroy.
 */
@Injectable()
export class ViewerShortcutService implements OnDestroy {
  private listener: ((e: KeyboardEvent) => void) | null = null;
  private bindings: KeyBinding[] = [];

  constructor(private state: ViewerStateService) {
    this.bindings = this.defaultBindings();
  }

  enable(): void {
    if (this.listener) return;
    this.listener = (e) => this.handle(e);
    window.addEventListener('keydown', this.listener);
  }

  disable(): void {
    if (!this.listener) return;
    window.removeEventListener('keydown', this.listener);
    this.listener = null;
  }

  ngOnDestroy(): void {
    this.disable();
  }

  private defaultBindings(): KeyBinding[] {
    return [
      { combo: '+', description: 'Zoom in', handler: () => this.state.zoomIn() },
      { combo: '=', description: 'Zoom in', handler: () => this.state.zoomIn() },
      { combo: '-', description: 'Zoom out', handler: () => this.state.zoomOut() },
      { combo: '0', description: 'Reset zoom', handler: () => this.state.resetZoom() },
      { combo: 'ArrowRight', description: 'Next page', handler: () => this.state.nextPage() },
      { combo: 'ArrowDown', description: 'Next page', handler: () => this.state.nextPage() },
      { combo: 'ArrowLeft', description: 'Previous page', handler: () => this.state.prevPage() },
      { combo: 'ArrowUp', description: 'Previous page', handler: () => this.state.prevPage() },
      { combo: 'r', description: 'Rotate 90° clockwise', handler: () => this.state.rotateBy(90) },
      { combo: 'R', description: 'Rotate 90° counter-clockwise', handler: () => this.state.rotateBy(-90) },
      { combo: 'f', description: 'Toggle fullscreen', handler: () => this.state.toggleFullscreen() },
      { combo: 'w', description: 'Fit to width', handler: () => this.state.setFit('width') },
      { combo: 'p', description: 'Fit to page', handler: () => this.state.setFit('page') },
    ];
  }

  private handle(event: KeyboardEvent): void {
    // Ignore when the user is typing in an input.
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const match = this.bindings.find((b) => b.combo === event.key);
    if (!match) return;
    event.preventDefault();
    match.handler();
  }
}
