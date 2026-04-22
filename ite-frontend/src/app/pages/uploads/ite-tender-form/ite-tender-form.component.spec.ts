import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IteTenderFormComponent } from './ite-tender-form.component';

describe('IteTenderFormComponent', () => {
  let component: IteTenderFormComponent;
  let fixture: ComponentFixture<IteTenderFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IteTenderFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IteTenderFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
