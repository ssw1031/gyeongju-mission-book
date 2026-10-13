/* Google Apps Script 웹앱 전송
 * CORS 회피: text/plain + no-cors (fire-and-forget).
 * 교사 조회는 GET으로 받아옵니다.
 */
GJ.Sheets = (function(){
  function url(){ return (GJ.getCfg().gasUrl||"").trim(); }
  async function send(payload){
    const u = url();
    if(!u) return { ok:false, offline:true };
    try{
      await fetch(u, {
        method:"POST",
        mode:"no-cors",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      return { ok:true };
    }catch(e){ return { ok:false, error:String(e) }; }
  }
  async function fetchAll(){
    const u = url();
    if(!u) return [];
    try{
      const r = await fetch(`${u}?action=list`);
      if(!r.ok) return [];
      const j = await r.json();
      return j.rows || [];
    }catch(e){ return []; }
  }
  return { send, fetchAll, url };
})();
