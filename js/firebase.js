/* Firebase Realtime Database REST 연동 (SDK 미사용 → 번들 가볍게)
 * URL이 비어 있으면 자동으로 로컬 저장만 사용 (오프라인 모드).
 */
GJ.FB = (function(){
  function baseUrl(){
    const u = (GJ.getCfg().fbUrl||"").trim().replace(/\/+$/,"");
    return u || null;
  }
  async function put(path, data){
    const base = baseUrl();
    if(!base) return { ok:false, offline:true };
    try{
      const r = await fetch(`${base}/${path}.json`, {
        method:"PUT",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(data)
      });
      return { ok:r.ok };
    }catch(e){ return { ok:false, error:String(e) }; }
  }
  async function get(path){
    const base = baseUrl();
    if(!base) return null;
    try{
      const r = await fetch(`${base}/${path}.json`);
      if(!r.ok) return null;
      return await r.json();
    }catch(e){ return null; }
  }
  function submissionPath(u, missionId){
    const safe = s => String(s).replace(/[.#$\[\]\/]/g,"_");
    return `submissions/${safe(u.grade)}/${safe(u.cls)}_${safe(u.name)}/${missionId}`;
  }
  function feedbackPath(u, missionId){
    const safe = s => String(s).replace(/[.#$\[\]\/]/g,"_");
    return `feedback/${safe(u.grade)}/${safe(u.cls)}_${safe(u.name)}/${missionId}`;
  }
  return { baseUrl, put, get, submissionPath, feedbackPath };
})();
