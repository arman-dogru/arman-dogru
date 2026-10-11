import {parentPort} from 'node:worker_threads';
import {evaluate} from './race-evaluation.mjs';
parentPort.on('message',({id,drivers,options})=>{
  try{parentPort.postMessage({id,result:evaluate(drivers,options)})}catch(error){parentPort.postMessage({id,error:error.stack})}
});
