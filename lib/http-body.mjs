// Drain small rejected bodies so the local HTTP proxy can reuse the connection.
// Large bodies are cancelled without buffering or parsing untrusted JSON.
export async function discardRequestBody(request){
  if(!request.body||request.bodyUsed)return;
  const reader=request.body.getReader();let bytes=0;
  try{while(bytes<=65536){const chunk=await reader.read();if(chunk.done)return;bytes+=chunk.value.byteLength;}await reader.cancel();}catch{}finally{reader.releaseLock();}
}
