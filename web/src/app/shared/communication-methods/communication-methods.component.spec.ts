import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CommunicationMethodsComponent } from './communication-methods.component';

describe('CommunicationMethodsComponent', () => {
  it('renders ordered methods and supports drag destinations and keyboard reordering', async () => {
    await TestBed.configureTestingModule({imports: [CommunicationMethodsComponent]}).overrideComponent(CommunicationMethodsComponent, {set: {imports: [], schemas: [NO_ERRORS_SCHEMA]}}).compileComponents();
    const fixture = TestBed.createComponent(CommunicationMethodsComponent);
    fixture.componentRef.setInput('rows', [{id: 'https-rest', label: 'HTTPS REST', port: 443, enabled: true, acceptSelfSignedCertificates: false}, {id: 'ssh', label: 'SSH', port: 22, enabled: true, acceptSelfSignedCertificates: false}]); fixture.detectChanges();
    const move = vi.spyOn(fixture.componentInstance.move, 'emit');
    fixture.nativeElement.querySelectorAll('.drag-handle')[1].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp', bubbles: true}));
    expect(move).toHaveBeenCalledWith({id: 'ssh', offset: -1});
    fixture.componentInstance.drop(0, 1);
    expect(move).toHaveBeenLastCalledWith({id: 'https-rest', offset: 1});
    fixture.componentRef.setInput('disabled', true); fixture.detectChanges(); move.mockClear();
    fixture.componentInstance.drop(0, 1); expect(move).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('li').length).toBe(2);
  });
});
