import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DisclosableComponent, DisclosableState } from './disclosable.component';

describe('DisclosableComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({imports: [DisclosableComponent]}).compileComponents();
    const fixture = TestBed.createComponent(DisclosableComponent);
    fixture.componentRef.setInput('title', 'Error details');
    fixture.componentRef.setInput('details', 'Could not fetch profiles.\nHTTP 500');
    fixture.detectChanges();
    return fixture;
  }

  it('starts collapsed and exposes a labelled, linked disclosure button', async () => {
    const fixture = await setup();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const details = fixture.nativeElement.querySelector('.disclosable-details') as HTMLElement;
    expect(button.type).toBe('button');
    expect(button.textContent).toContain('Error details');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe(details.id);
    expect(details.getAttribute('aria-labelledby')).toBe(button.id);
    expect(details.hidden).toBe(true);
    button.click(); fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(details.hidden).toBe(false);
    expect(details.textContent).toContain('Could not fetch profiles.\nHTTP 500');
    button.click(); fixture.detectChanges();
    expect(details.hidden).toBe(true);
  });

  it('supports each severity without resetting the expanded state or interpreting details as HTML', async () => {
    const fixture = await setup();
    fixture.componentInstance.expanded.set(true);
    fixture.componentRef.setInput('details', '<script>untrusted</script>');
    for (const state of ['plain', 'error', 'warning', 'success'] as DisclosableState[]) {
      fixture.componentRef.setInput('state', state); fixture.detectChanges();
      expect(fixture.nativeElement.getAttribute('data-state')).toBe(state);
      expect(fixture.nativeElement.querySelector('.disclosable-details').hidden).toBe(false);
    }
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<script>untrusted</script>');
  });

  it('gives separate instances unique disclosure targets', async () => {
    const fixture = await setup();
    const other = TestBed.createComponent(DisclosableComponent);
    other.componentRef.setInput('title', 'Other details'); other.detectChanges();
    expect(other.componentInstance.detailsId).not.toBe(fixture.componentInstance.detailsId);
  });
});
