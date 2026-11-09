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
var mode=(!rm&&gl&&!forceStatic)?'cine':'static';window.__lunaEnv=mode;
if(mode==='cine'){d.classList.add('cine');if(/^\\/(de|en|ar)?\\/?$/.test(location.pathname)){d.classList.add('intro-pending');}}else{d.classList.add('static');}

}catch(e){}})();`;

export function isCine() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("cine")
  );
}

/**
 * Re-applies the decision of ENV_SCRIPT to <html>. The root layout lives in
 * app/[lang], so a client-side language switch (e.g. /angebot -> /en/quote)
 * remounts it, and React then resets the attributes of <html>, dropping the
 * "cine" / "static" class the head script set once per document. Without it
 * the homepage globe and the scenes never start after such a switch.
 */
export function restoreEnvClass() {
  if (typeof window === "undefined") return;
  const mode = (window as Window & { __lunaEnv?: string }).__lunaEnv;
  if (mode !== "cine" && mode !== "static") return;
  const html = document.documentElement;
  if (!html.classList.contains(mode)) html.classList.add(mode);
}
