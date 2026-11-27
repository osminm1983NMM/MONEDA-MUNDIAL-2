'use strict';
// One choice per JavaScript runtime, including React root remounts.
// A new runtime starts unselected. This is not an OS-level security boundary.
function createModeLatch(){
 let mode=null;
 return Object.freeze({current:()=>mode,choose:next=>{
  if(next!=='demo'&&next!=='financial')throw Error('INVALID_LAB_MODE');
  if(mode===null)mode=next;
  return mode;
 }});
}
module.exports={createModeLatch};
