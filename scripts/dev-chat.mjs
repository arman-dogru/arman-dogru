// Local-first chat routing. Never silently test a deployed prompt as a local edit.
export function previewStatus(env,{publicChat=false}={}){
  return{mode:publicChat?'public relay':'local prompt',key_configured:Boolean(env.XAI_API_KEY),ready:publicChat||Boolean(env.XAI_API_KEY)};
}

export async function developmentChat(request,env,{worker,publicChat=false,requestPublic=fetch}={}){
  if(publicChat)return requestPublic('https://arman-dogru-chat.arman-dogru.workers.dev/',{method:'POST',headers:{'content-type':'application/json'},body:await request.arrayBuffer(),signal:AbortSignal.timeout(70000)});
  if(!env.XAI_API_KEY)return Response.json({degraded:true,error:'local_key_missing',reply:'Local preview needs XAI_API_KEY in grok-relay/.dev.vars. The deployed prompt was not used.'},{status:503});
  return worker.fetch(request,env,{});
}
