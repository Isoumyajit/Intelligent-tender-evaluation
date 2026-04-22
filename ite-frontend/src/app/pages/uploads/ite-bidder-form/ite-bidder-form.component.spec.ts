import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IteBidderFormComponent } from './ite-bidder-form.component';

describe('IteBidderFormComponent', () => {
  let component: IteBidderFormComponent;
  let fixture: ComponentFixture<IteBidderFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IteBidderFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IteBidderFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
