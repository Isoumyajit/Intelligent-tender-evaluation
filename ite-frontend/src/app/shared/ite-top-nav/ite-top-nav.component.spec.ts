import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IteTopNavComponent } from './ite-top-nav.component';

describe('IteTopNavComponent', () => {
  let component: IteTopNavComponent;
  let fixture: ComponentFixture<IteTopNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IteTopNavComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IteTopNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
