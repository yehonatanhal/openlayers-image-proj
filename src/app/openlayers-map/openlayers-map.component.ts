import { Component, OnInit, ViewChild } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import {Image as ImageLayer, Tile as TileLayer} from 'ol/layer';
import OSM from 'ol/source/OSM';
import {getCenter} from 'ol/extent';
import {register} from 'ol/proj/proj4';
import {transform} from 'ol/proj';
import proj from 'proj4';
import ImageSource from 'ol/source/Image';
import { CustomStatic } from '../ol-override/custom-static';

@Component({
  selector: 'app-openlayers-map',
  templateUrl: './openlayers-map.component.html',
  styleUrls: ['./openlayers-map.component.less']
})
export class OpenlayersMapComponent implements OnInit {
  imageExtent: Array<number> = [];
  imageLayer: ImageLayer<ImageSource>;
  
  @ViewChild('olMapContainer') olMapContainr: any;

  constructor() {}

  ngOnInit(): void {}

  ngAfterViewInit(){
     proj.defs(
      'EPSG:27700',
      '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 ' +
        '+x_0=400000 +y_0=-100000 +ellps=airy ' +
        '+towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 ' +
        '+units=m +no_defs'
    );
    register(proj);

    this.imageExtent = [0, 0, 700000, 1300000];
    this.imageLayer = new ImageLayer();

    const map = new Map({
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        this.imageLayer,
      ],
      target: this.olMapContainr.nativeElement,
      view: new View({
        center: transform(getCenter(this.imageExtent), 'EPSG:27700', 'EPSG:3857'),
        zoom: 4,
      }),
    });

    this.setSource()
  }

  private setSource() {
    const source = new CustomStatic({
      url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/' +
        'British_National_Grid.svg/2000px-British_National_Grid.svg.png',
      crossOrigin: '',
      projection: 'EPSG:27700',
      imageExtent: this.imageExtent,
      interpolate: true,
    });
    this.imageLayer.setSource(source);
  }
}
