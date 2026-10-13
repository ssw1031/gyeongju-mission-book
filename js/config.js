/* 전역 설정 — localStorage에 저장되어 재방문 시 유지 */
window.GJ = window.GJ || {};
GJ.KEY = {
  CFG     : "gj_cfg_v1",      // Firebase/Sheets URL
  USER    : "gj_user_v1",     // 로그인 사용자 (grade/class/name)
  DRAFT   : "gj_draft_v1",    // 입력 중인 응답(사용자별)
  THEME   : "gj_theme_v1",    // light/dark
  TEACHER : "gj_teacher_v1",  // 교사 세션 플래그
};
GJ.TEACHER_PW = "0989"; // 교사 비밀번호(요청: UI에 보이지 않게)
GJ.getCfg = function(){
  const DEFAULT = {
    firebaseUrl: "https://gyeongju-mission-default-rtdb.asia-southeast1.firebasedatabase.app",
    sheetsUrl: ""
  };
  try{ return { ...DEFAULT, ...JSON.parse(localStorage.getItem(GJ.KEY.CFG)||"{}") }; }catch(e){ return DEFAULT; }
};
GJ.setCfg = function(obj){
  const cur = GJ.getCfg();
  localStorage.setItem(GJ.KEY.CFG, JSON.stringify({...cur, ...obj}));
};
