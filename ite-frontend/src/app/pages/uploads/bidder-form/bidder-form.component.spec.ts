import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BidderFormComponent } from './bidder-form.component';

describe('BidderFormComponent', () => {
  let component: BidderFormComponent;
  let fixture: ComponentFixture<BidderFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BidderFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BidderFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
