import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpenlayersMapComponent } from './openlayers-map.component';

describe('OpenlayersMapComponent', () => {
  let component: OpenlayersMapComponent;
  let fixture: ComponentFixture<OpenlayersMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OpenlayersMapComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OpenlayersMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
