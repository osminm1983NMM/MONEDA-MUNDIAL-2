'use strict';
// Coordinate two read-only views of one hosted LAB session. Disarm BEFORE
// clearing either view so synchronous signed-out callbacks cannot recurse.
function createHostedSessionFence(onLoss){
 if(typeof onLoss!=='function')throw Error('INVALID_SESSION_FENCE');
 let armed=false;
 return Object.freeze({
  arm(){armed=true;},
  disarm(){armed=false;},
  observe(source,view){
   if(!armed)return false;
   const lost=source==='remittance'?view?.state==='error'&&view.code==='AUTH_REQUIRED':
    source==='wallet'&&view?.state==='signed_out';
   if(!lost)return false;
   armed=false;onLoss();return true;
  }
 });
}
module.exports={createHostedSessionFence};
