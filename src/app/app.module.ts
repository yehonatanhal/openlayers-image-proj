import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { OpenlayersMapComponent } from './openlayers-map/openlayers-map.component';

@NgModule({
  declarations: [
    AppComponent,
    OpenlayersMapComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
