/* 교사용 대시보드
 * - 학년/미션/이름 필터, 매트릭스 뷰, 카드 리스트
 * - 상세 모달에서 사진·텍스트 전체 보기 + 피드백 저장
 * - Firebase에서 submissions를 전부 읽어와 머지, Google Sheets에도 피드백 전송
 */
GJ.Teacher = (function(){
  const $ = s => document.querySelector(s);
  let ROWS = []; // 정규화된 레코드

  function fillMissionFilter(){
    const sel = $("#fMission");
    sel.innerHTML = `<option value="">전체 미션</option>` +
      GJ.MISSIONS.map(m => `<option value="${m.id}">${m.no}. ${m.title}</option>`).join("");
  }

  async function loadAll(){
    ROWS = [];
    // 1) Firebase에서 submissions 전체 가져오기
    const data = await GJ.FB.get("submissions");
    const fbData = await GJ.FB.get("feedback") || {};
    if(data){
      Object.entries(data).forEach(([grade, byClassName])=>{
        Object.entries(byClassName||{}).forEach(([cn, byMission])=>{
          const [cls, ...nm] = cn.split("_");
          const name = nm.join("_");
          Object.entries(byMission||{}).forEach(([taskKey, payload])=>{
            if(!payload || !payload.data) return;
            const fb = (((fbData[grade]||{})[cn])||{})[taskKey] || "";
            ROWS.push(normalize(payload, { grade, cls, name, taskKey, feedback: fb }));
          });
        });
      });
    }
    // 2) 로컬 자기 드래프트가 있으면 보조로 추가(오프라인용)
    try{
      const drafts = JSON.parse(localStorage.getItem(GJ.KEY.DRAFT)||"{}");
      Object.entries(drafts).forEach(([ukey, missions])=>{
        const [grade, cls, ...nm] = ukey.split("-"); const name = nm.join("-");
        Object.entries(missions||{}).forEach(([mId, tasks])=>{
          Object.entries(tasks||{}).forEach(([tId, st])=>{
            if(!st.submittedAt) return;
            const taskKey = `${mId}_${tId}`;
            // 이미 FB에 있는지 체크
            if(ROWS.find(r=> r.grade===grade && r.cls===cls && r.name===name && r.taskKey===taskKey)) return;
            ROWS.push(normalize({
              user:{grade,cls,name},
              missionId:mId, taskId:tId,
              missionTitle: GJ.MISSION_LABEL(mId),
              taskTitle: (GJ.MISSIONS.find(m=>m.id===mId)?.tasks.find(t=>t.id===tId)?.title)||tId,
              data:{ text:st.text||"", fields:st.fields||{}, likert:st.likert||{}, photo:st.photo||"" },
              submittedAt: st.submittedAt
            }, { grade, cls, name, taskKey, feedback:"", local:true }));
          });
        });
      });
    }catch(e){}
    render();
  }

  function normalize(payload, ext){
    return {
      grade: ext.grade,
      cls  : ext.cls,
      name : ext.name,
      missionId: payload.missionId,
      missionTitle: payload.missionTitle || GJ.MISSION_LABEL(payload.missionId),
      taskId: payload.taskId,
      taskTitle: payload.taskTitle,
      taskKey: ext.taskKey,
      data: payload.data || {},
      submittedAt: payload.submittedAt,
      feedback: ext.feedback || "",
      local: !!ext.local,
    };
  }

  function filtered(){
    const g = $("#fGrade").value;
    const m = $("#fMission").value;
    const n = ($("#fName").value||"").trim();
    return ROWS.filter(r =>
      (!g || r.grade===g) &&
      (!m || r.missionId===m) &&
      (!n || r.name.includes(n))
    ).sort((a,b)=> (b.submittedAt||"").localeCompare(a.submittedAt||""));
  }

  function render(){
    renderMatrix();
    renderCards();
  }

  function renderMatrix(){
    const grades = ["1","2","3"];
    const head = `<tr><th>학년</th>${GJ.MISSIONS.map(m=>`<th>${m.no}</th>`).join("")}<th>합계</th></tr>`;
    const body = grades.map(g=>{
      let total = 0;
      const cells = GJ.MISSIONS.map(m=>{
        const n = ROWS.filter(r => r.grade===g && r.missionId===m.id).length;
        total += n;
        return `<td class="${n?'ok':''}">${n||""}</td>`;
      }).join("");
      return `<tr><th>${g}학년</th>${cells}<td><b>${total}</b></td></tr>`;
    }).join("");
    $("#matrix").innerHTML =
      `<table><thead>${head}</thead><tbody>${body}</tbody></table>
       <p class="hint" style="margin-top:8px">숫자: 제출 건수 (학년 × 미션)</p>`;
  }

  function renderCards(){
    const list = filtered();
    const box = $("#cards");
    if(!list.length){
      box.innerHTML = `<div class="card" style="grid-column:1/-1">조건에 맞는 제출이 없습니다. 연동 설정에서 Firebase URL을 확인해 주세요.</div>`;
      return;
    }
    box.innerHTML = list.map((r,i)=>{
      const snippet = r.data.text || Object.values(r.data.fields||{}).join(" / ") || (r.data.likert ? "자기평가 응답" : "");
      return `
        <div class="scard" data-idx="${i}">
          <div class="meta">
            <span>${r.grade}학년 ${r.cls}반 · ${r.name}${r.local?' · (로컬)':''}</span>
            <span>${new Date(r.submittedAt).toLocaleString()}</span>
          </div>
          <h4>${r.missionTitle} · ${r.taskTitle||""}</h4>
          ${r.data.photo ? `<div class="thumb"><img src="${r.data.photo}" /></div>` : ``}
          <div class="snippet">${escapeHtml(snippet)}</div>
          ${r.feedback ? `<div class="fb">피드백: ${escapeHtml(r.feedback)}</div>`: ``}
        </div>`;
    }).join("");
    // 카드 클릭 → 상세
    box.querySelectorAll(".scard").forEach(el=>{
      el.addEventListener("click", ()=> openDetail(list[Number(el.dataset.idx)]));
    });
  }

  function escapeHtml(s){ return (s||"").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

  function openDetail(r){
    $("#dmTitle").textContent = `${r.grade}학년 ${r.cls}반 · ${r.name} — ${r.missionTitle}`;
    const parts = [];
    if(r.data.text) parts.push(`<div class="dm-item"><h5>${r.taskTitle||"내용"}</h5><p>${escapeHtml(r.data.text)}</p></div>`);
    Object.entries(r.data.fields||{}).forEach(([k,v])=>{
      if(!v) return;
      parts.push(`<div class="dm-item"><h5>${escapeHtml(k)}</h5><p>${escapeHtml(v)}</p></div>`);
    });
    if(r.data.likert && Object.keys(r.data.likert).length){
      const mission = GJ.MISSIONS.find(m=>m.id===r.missionId);
      const task = mission?.tasks.find(t=>t.id===r.taskId);
      const rows = task?.rows || [];
      const cols = task?.cols || [];
      parts.push(`<div class="dm-item"><h5>자기평가</h5><p>${
        rows.map((row,ri)=> `· ${row} → ${cols[r.data.likert[ri]] ?? "미응답"}`).join("\n")
      }</p></div>`);
    }
    if(r.data.photo) parts.push(`<div class="dm-item"><h5>제출 사진</h5><img src="${r.data.photo}" /></div>`);
    $("#dmBody").innerHTML = parts.join("") || `<div class="dm-item"><p>내용이 없습니다.</p></div>`;
    $("#dmFeedback").value = r.feedback || "";
    $("#detailModal").classList.remove("hidden");
    $("#dmSave").onclick = async ()=>{
      const fb = $("#dmFeedback").value.trim();
      // Firebase 저장
      await GJ.FB.put(GJ.FB.feedbackPath({grade:r.grade,cls:r.cls,name:r.name}, r.taskKey), {
        feedback: fb, by:"teacher", at:new Date().toISOString()
      });
      // Sheets에도 전송(별도 kind)
      await GJ.Sheets.send({
        kind:"feedback",
        user:{grade:r.grade,cls:r.cls,name:r.name},
        missionId:r.missionId, missionTitle:r.missionTitle,
        taskId:r.taskId, taskTitle:r.taskTitle,
        feedback: fb, at:new Date().toISOString()
      });
      r.feedback = fb;
      $("#detailModal").classList.add("hidden");
      render();
      gjToast("피드백이 저장되었습니다.");
    };
  }
  $("#dmClose").addEventListener("click", ()=> $("#detailModal").classList.add("hidden"));

  // ---------- 연동 설정 ----------
  $("#btnSettings").addEventListener("click", openSettings);
  $("#stClose").addEventListener("click", ()=> $("#settingsModal").classList.add("hidden"));
  $("#stSave").addEventListener("click", ()=>{
    GJ.setCfg({
      fbUrl: $("#fbUrl").value.trim(),
      gasUrl: $("#gasUrl").value.trim(),
    });
    $("#settingsModal").classList.add("hidden");
    gjToast("설정이 저장되었습니다. 새로고침 후 적용됩니다.");
    loadAll();
  });
  function openSettings(){
    const cfg = GJ.getCfg();
    $("#fbUrl").value  = cfg.fbUrl || "";
    $("#gasUrl").value = cfg.gasUrl || "";
    $("#gasCode").textContent = GAS_CODE;
    $("#settingsModal").classList.remove("hidden");
  }
  $("#copyGas").addEventListener("click", async ()=>{
    try{ await navigator.clipboard.writeText(GAS_CODE); gjToast("Code.gs 코드가 복사되었습니다."); }
    catch(e){ gjToast("복사 실패 — 수동 복사해 주세요."); }
  });

  $("#btnRefresh").addEventListener("click", loadAll);
  ["fGrade","fMission","fName"].forEach(id => $("#"+id).addEventListener("input", render));

  function open(){
    fillMissionFilter();
    loadAll();
  }

  // ---------- Code.gs 코드(복사용) ----------
  const GAS_CODE = `/** 경주 미션북 — Google Apps Script 웹앱
 *  Sheet 1시트: Submissions / Sheet 2시트: Feedback 자동 생성
 */
const SHEET_SUB = 'Submissions';
const SHEET_FB  = 'Feedback';

function doPost(e){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const body = JSON.parse(e.postData.contents);
  if(body.kind === 'submission') writeSubmission(ss, body);
  else if(body.kind === 'feedback') writeFeedback(ss, body);
  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e){
  if(e.parameter.action === 'list'){
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_SUB);
    const rows = sh ? sh.getDataRange().getValues() : [];
    const [head, ...data] = rows;
    const list = data.map(r => Object.fromEntries(head.map((h,i)=>[h, r[i]])));
    return ContentService.createTextOutput(JSON.stringify({rows:list}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('OK');
}
function ensureSheet(ss, name, header){
  let sh = ss.getSheetByName(name);
  if(!sh){ sh = ss.insertSheet(name); sh.appendRow(header); }
  return sh;
}
function writeSubmission(ss, b){
  const header = ['제출시각','학년','반','이름','미션ID','미션','과제ID','과제','본문','필드(JSON)','자기평가(JSON)','사진(DataURL)'];
  const sh = ensureSheet(ss, SHEET_SUB, header);
  sh.appendRow([
    b.submittedAt, b.user.grade, b.user.cls, b.user.name,
    b.missionId, b.missionTitle, b.taskId, b.taskTitle,
    b.data.text||'', JSON.stringify(b.data.fields||{}), JSON.stringify(b.data.likert||{}),
    (b.data.photo||'').slice(0, 48000) // 셀 길이 한도 보호
  ]);
}
function writeFeedback(ss, b){
  const header = ['시각','학년','반','이름','미션ID','미션','과제ID','과제','피드백'];
  const sh = ensureSheet(ss, SHEET_FB, header);
  sh.appendRow([b.at, b.user.grade, b.user.cls, b.user.name,
    b.missionId, b.missionTitle, b.taskId, b.taskTitle, b.feedback||'']);
}`;

  return { open };
})();
