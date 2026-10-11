// One objective, with no finish bonus or safety/style penalties. Signed circuit
// progress prevents reversing, weaving or spinning from farming odometer miles.
export const TRAINING_OBJECTIVE=Object.freeze({
  version:'net-track-distance-v1',
  fitness:'mean net forward circuit distance over equal fixed-duration episodes',
  episode_seconds:150,
  stop_on_finish:false,
});
export function distanceFitness(row){
  if(!Number.isFinite(row.distance))throw new Error('Missing finite episode distance');
  return row.distance;
}
