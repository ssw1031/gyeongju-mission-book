/* 로컬 임시저장 / 이미지 리사이즈 유틸 */
GJ.Store = (function(){
  function userKey(u){ return `${u.grade}-${u.cls}-${u.name}`; }
  function loadDraft(u){
    try{
      const all = JSON.parse(localStorage.getItem(GJ.KEY.DRAFT) || "{}");
      return all[userKey(u)] || {};
    }catch(e){ return {}; }
  }
  function saveDraft(u, data){
    const all = JSON.parse(localStorage.getItem(GJ.KEY.DRAFT) || "{}");
    all[userKey(u)] = data;
    localStorage.setItem(GJ.KEY.DRAFT, JSON.stringify(all));
  }
  function clearDraft(u){
    const all = JSON.parse(localStorage.getItem(GJ.KEY.DRAFT) || "{}");
    delete all[userKey(u)];
    localStorage.setItem(GJ.KEY.DRAFT, JSON.stringify(all));
  }
  /* File → DataURL(JPEG, 긴 변 1024px) */
  function resizeImage(file, maxSide=1024, quality=0.78){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = ()=>{
          let {width:w, height:h} = img;
          const s = Math.min(1, maxSide/Math.max(w,h));
          w = Math.round(w*s); h = Math.round(h*s);
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          cv.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  return { userKey, loadDraft, saveDraft, clearDraft, resizeImage };
})();
