export function createJourneyMap({ container, journey, log, sleep }) {
  let map=null, markers=[], route=null, current=journey.length-1;
  const markerHtml=(i,active=false)=>`<div class="journey-dot ${active?'active':''}"><span>${i+1}</span></div>`;
  const popupHtml=(e,i)=>`<div class="journey-popup"><div class="eyebrow">TRACE ${String(i+1).padStart(2,'0')} // ${e.kind}</div><h3>${e.year} · ${e.title}</h3><div class="where">${e.place}</div><section><b>ACHIEVEMENT</b><p>${e.achievement}</p></section><section><b>TAKEAWAY</b><p>${e.lesson}</p></section></div>`;
  function ensure(){
    if(map)return;
    if(!window.L){container.innerHTML='<div class="map-fail">Map runtime unavailable.</div>';return;}
    map=L.map(container,{zoomControl:false,scrollWheelZoom:true,worldCopyJump:true,attributionControl:true,preferCanvas:true});
    const osm=L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20,subdomains:'abcd',attribution:'&copy; OpenStreetMap contributors &copy; CARTO'});
    const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
    osm.addTo(map);L.control.layers({'OSM // DARK':osm,'SATELLITE':sat},null,{position:'topright'}).addTo(map);L.control.zoom({position:'bottomright'}).addTo(map);
    route=L.polyline(journey.map(e=>[e.lat,e.lon]),{color:'#89dceb',weight:2,opacity:.58,dashArray:'7 9'}).addTo(map);
    markers=journey.map((e,i)=>L.marker([e.lat,e.lon],{icon:L.divIcon({className:'journey-icon',html:markerHtml(i,i===current),iconSize:[30,30],iconAnchor:[15,15]})}).bindPopup(popupHtml(e,i),{maxWidth:390,className:'journey-leaflet-popup'}).addTo(map));
    fit();setActive(current,false);
  }
  function fit(){if(!map)return;map.fitBounds(L.latLngBounds(journey.map(e=>[e.lat,e.lon])),{padding:[42,42],maxZoom:4});setTimeout(()=>map.invalidateSize(),50)}
  function setActive(i,open=true){if(!map)return;current=i;markers.forEach((m,j)=>m.setIcon(L.divIcon({className:'journey-icon',html:markerHtml(j,j===i),iconSize:[30,30],iconAnchor:[15,15]})));if(open)markers[i].openPopup()}
  async function animate(){ensure();if(!map)return;for(let i=0;i<journey.length;i++){const e=journey[i];setActive(i,false);map.flyTo([e.lat,e.lon],Math.max(5,Math.min(10,i===0?7:8)),{duration:1.15,easeLinearity:.18});await sleep(900);markers[i].openPopup();log?.(`trace ${e.year} // ${e.title}`,'dim');await sleep(1500)}await sleep(300);fit()}
  function trace(q){ensure();if(!map)return;if(!q){log?.('usage: trace <year|place|company>','yellow');return}const needle=q.toLowerCase();const i=journey.findIndex(e=>`${e.year} ${e.place} ${e.title} ${e.kind}`.toLowerCase().includes(needle));if(i<0){log?.(`no public timeline event matched: ${q}`,'error');return}setActive(i,false);map.flyTo([journey[i].lat,journey[i].lon],10,{duration:1.2});setTimeout(()=>markers[i].openPopup(),950);log?.(`trace locked // ${journey[i].year} // ${journey[i].title}`,'green')}
  function resize(){ensure();setTimeout(()=>map?.invalidateSize(),40)}
  return{resize,animate,trace,fit};
}
