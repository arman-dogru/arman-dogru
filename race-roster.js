// Keep the trained archive intact. Every runtime opponent uses its best policy;
// names and ratings are cosmetic and cannot change its controls or capabilities.
export function championDriver(drivers,qualifiedName){
  if(!Array.isArray(drivers)||!drivers.length||drivers.some(d=>!Number.isFinite(d.fitness)))throw new Error('Race archive requires finite distance fitness for every policy');
  if(qualifiedName!==undefined){
    const champion=drivers.find(driver=>driver.name===qualifiedName);
    if(!champion)throw new Error('Qualified race champion is missing from the archive');
    return champion;
  }
  return drivers.reduce((best,driver)=>driver.fitness>best.fitness?driver:best);
}

export function championRoster(drivers,qualifiedName){
  const champion=championDriver(drivers,qualifiedName);
  return drivers.map(({name,rating})=>({...champion,name,rating}));
}
