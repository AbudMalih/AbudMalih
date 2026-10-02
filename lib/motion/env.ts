/**
 * Runs in <head> BEFORE first paint (stringified into an inline script).
 * Decides between the cinematic and the static presentation so the layout
 * never flashes. `?static` forces the accessible static mode for review.
 */
export const ENV_SCRIPT = `(function(){try{
var d=document.documentElement,q=location.search;
var rm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var gl=false;try{var c=document.createElement('canvas');var x=c.getContext('webgl2')||c.getContext('webgl');gl=!!x;var l=x&&x.getExtension('WEBGL_lose_context');l&&l.loseContext();}catch(e){}
var forceStatic=/[?&]static\\b/.test(q);
if(!rm&&gl&&!forceStatic){d.classList.add('cine');if(location.pathname==='/'){d.classList.add('intro-pending');}}else{d.classList.add('static');}
if(!rm&&window.matchMedia('(hover: hover) and (pointer: fine)').matches){d.classList.add('has-cursor');}
try{if(sessionStorage.getItem('luna:intro'))d.classList.add('intro-seen');}catch(e){}
}catch(e){}})();`;

export function isCine() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("cine");
}
