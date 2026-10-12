import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createJourneyMap} from '../terminal-map.js';

test('career map uses keyless OSM with linked attribution and dark styling only on its tiles',async()=>{
  const originalL=globalThis.L,originalWindow=globalThis.window,layers=[];
  const layer={addTo(){return this},setIcon(){return this},setPopupContent(){return this},bindPopup(){return this}};
  const map={on(){},fitBounds(){},invalidateSize(){}};
  const L={map:()=>map,tileLayer:(url,options)=>{layers.push({url,options});return{...layer}},polyline:()=>({...layer}),marker:()=>({...layer}),divIcon:x=>x,latLngBounds:x=>x,control:{layers:()=>({...layer}),zoom:()=>({...layer})}};
  globalThis.L=L;globalThis.window={L};
  try{
    createJourneyMap({container:{},journey:[{lat:45,lon:-75,title:'Ottawa'}]}).resize();
    assert.equal(layers[0].url,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    assert.equal(layers[0].options.maxNativeZoom,19);
    assert.match(layers[0].options.attribution,/href="https:\/\/www.openstreetmap.org\/copyright"/);
    assert.equal(layers[0].options.className,'journey-osm-tiles');
    assert.match(layers[1].url,/World_Imagery/);assert.equal(layers[1].options.className,undefined);
    const css=await readFile(new URL('../terminal-v3.css',import.meta.url),'utf8');
    assert.match(css,/\.journey-osm-tiles\{filter:invert\(1\)/);
    assert.doesNotMatch(css,/\.leaflet-(?:tile|tile-pane)\s*\{[^}]*filter:/);
  }finally{globalThis.L=originalL;globalThis.window=originalWindow}
});
