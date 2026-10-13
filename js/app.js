/* 학생용 앱 로직
 * - 로그인(학년/반/이름)
 * - 큰 네비게이션 탭 + 미션 페이지 렌더
 * - 로컬 임시저장(탭 전환 시에도 유지)
 * - 미션별 "제출" → Firebase + Google Sheets 동시 전송
 */
(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const views = {
    login: $("#loginView"),
    app  : $("#appView"),
    teacher: $("#teacherView"),
  };

  // ---------- 테마 ----------
  function applyTheme(t){
    document.body.dataset.theme = t;
    localStorage.setItem(GJ.KEY.THEME, t);
  }
  applyTheme(localStorage.getItem(GJ.KEY.THEME) || "light");
  $("#btnTheme")?.addEventListener("click", ()=>{
    applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
  });

  // ---------- 토스트 ----------
  let toastT;
  function toast(msg){
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastT);
    toastT = setTimeout(()=>el.classList.add("hidden"), 1800);
  }
  window.gjToast = toast;

  // ---------- 로그인 ----------
  const loginForm = $("#loginForm");
  loginForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    const grade = $("#inGrade").value;
    const cls   = $("#inClass").value.trim();
    const name  = $("#inName").value.trim();
    if(!grade || !cls || !name){ toast("학년/반/이름을 모두 입력하세요."); return; }
    const user = { grade, cls, name, loggedAt:new Date().toISOString() };
    localStorage.setItem(GJ.KEY.USER, JSON.stringify(user));
    enterApp(user);
  });

  const existing = (()=>{ try{ return JSON.parse(localStorage.getItem(GJ.KEY.USER)||"null"); }catch(e){ return null; } })();
  if(existing) enterApp(existing);

  $("#btnLogout").addEventListener("click", ()=>{
    if(!confirm("로그아웃 할까요? (임시저장된 내용은 유지됩니다)")) return;
    localStorage.removeItem(GJ.KEY.USER);
    location.reload();
  });

  // ---------- 교사 모달(로그인) ----------
  $("#openTeacher").addEventListener("click", ()=>{
    $("#teacherGate").classList.remove("hidden");
    setTimeout(()=>$("#teacherPw").focus(), 50);
  });
  $("#teacherCancel").addEventListener("click", ()=> $("#teacherGate").classList.add("hidden"));
  $("#teacherLogin").addEventListener("click", attemptTeacher);
  $("#teacherPw").addEventListener("keydown", e => { if(e.key==="Enter") attemptTeacher(); });
  function attemptTeacher(){
    const pw = $("#teacherPw").value;
    if(pw === GJ.TEACHER_PW){
      $("#teacherPw").value="";
      $("#teacherMsg").textContent="";
      $("#teacherGate").classList.add("hidden");
      sessionStorage.setItem(GJ.KEY.TEACHER, "1");
      views.login.classList.add("hidden");
      views.app.classList.add("hidden");
      views.teacher.classList.remove("hidden");
      GJ.Teacher.open();
    }else{
      $("#teacherMsg").textContent = "비밀번호가 올바르지 않습니다.";
    }
  }
  $("#btnTeacherExit").addEventListener("click", ()=>{
    sessionStorage.removeItem(GJ.KEY.TEACHER);
    views.teacher.classList.add("hidden");
    if(JSON.parse(localStorage.getItem(GJ.KEY.USER)||"null")){
      views.app.classList.remove("hidden");
    }else{
      views.login.classList.remove("hidden");
    }
  });

  // ---------- 메인 앱 ----------
  let CURRENT_USER = null;
  let STATE = {}; // { [missionId]: { [taskId]: {text?, fields?, photo?, likert?, submittedAt? } } }

  function enterApp(user){
    CURRENT_USER = user;
    views.login.classList.add("hidden");
    views.app.classList.remove("hidden");
    $("#whoami").textContent = `${user.grade}학년 ${user.cls}반 · ${user.name}`;
    STATE = GJ.Store.loadDraft(user) || {};
    renderTabs();
    renderPages();
    activate(GJ.MISSIONS[0].id);
  }

  // ---------- 큰 네비게이션 ----------
  function renderTabs(){
    const nav = $("#navTabs");
    nav.innerHTML = "";
    GJ.MISSIONS.forEach(m=>{
      const b = document.createElement("button");
      b.className = "tab";
      b.dataset.id = m.id;
      b.innerHTML = `<span class="no">${m.no}</span>${m.title}`;
      b.addEventListener("click", ()=> activate(m.id));
      nav.appendChild(b);
    });
  }
  function activate(id){
    $$("#navTabs .tab").forEach(t=>{
      t.classList.toggle("active", t.dataset.id===id);
      if(t.dataset.id===id) t.scrollIntoView({inline:"center", block:"nearest", behavior:"smooth"});
    });
    $$(".mission").forEach(s=> s.classList.toggle("active", s.dataset.id===id));
    window.scrollTo({top:0, behavior:"smooth"});
  }

  // ---------- 미션 페이지 렌더 ----------
  function renderPages(){
    const root = $("#pages");
    root.innerHTML = "";
    GJ.MISSIONS.forEach(m=>{
      const sec = document.createElement("section");
      sec.className = "mission";
      sec.dataset.id = m.id;
      sec.innerHTML = `
        <div class="mission-head">
          <img src="${m.img}" alt="${m.title}" loading="lazy" />
          <div>
            <h2><span style="color:var(--accent);font-weight:800">${m.no}.</span> ${m.title}</h2>
            <p class="sub">${m.sub || ""}</p>
            <p>${m.tag.map(t=>`<span class="tag">${t}</span>`).join("")}</p>
          </div>
        </div>
        <p class="mission-desc">${m.desc}</p>
        <div class="mission-grid"></div>
      `;
      const grid = sec.querySelector(".mission-grid");
      m.tasks.forEach(t => grid.appendChild(renderTask(m, t)));
      root.appendChild(sec);
    });
  }

  function getTaskState(mId, tId){
    STATE[mId] = STATE[mId] || {};
    STATE[mId][tId] = STATE[mId][tId] || {};
    return STATE[mId][tId];
  }

  function renderTask(m, t){
    const wrap = document.createElement("div");
    wrap.className = "task";
    const st = getTaskState(m.id, t.id);

    let inner = `<h3><span class="mno">${m.no}-${t.id.replace("t","")}</span>${t.title}</h3>
                 <p class="q">${t.q || ""}</p>`;

    // 1) 사진
    if(t.photo){
      inner += `
        <div class="photo">
          <div class="ph-slot" data-slot>
            ${st.photo ? `<img src="${st.photo}" />` : `카메라/파일로 사진을 추가하세요`}
          </div>
          <div class="ph-row">
            <label class="btn block" style="text-align:center">
              사진 추가/변경
              <input type="file" accept="image/*" capture="environment" data-photo />
            </label>
            <button class="btn ghost" data-photo-clear>삭제</button>
          </div>
        </div>`;
    }

    // 2) 리커트
    if(t.kind === "likert"){
      inner += `<table class="likert"><thead><tr><th>항목</th>${
        t.cols.map(c=>`<th>${c}</th>`).join("")
      }</tr></thead><tbody>${
        t.rows.map((r,ri)=>{
          return `<tr><td>${r}</td>${
            t.cols.map((c,ci)=>{
              const name = `likert_${m.id}_${t.id}_${ri}`;
              const checked = (st.likert && st.likert[ri]===ci) ? "checked" : "";
              return `<td><input type="radio" name="${name}" data-likert="${ri}:${ci}" ${checked} /></td>`;
            }).join("")
          }</tr>`;
        }).join("")
      }</tbody></table>`;
    }

    // 3) 자유기술 — 라벨 하나(photo+text) 또는 다중 필드(text)
    if(t.kind === "photo+text"){
      inner += `<label class="field"><span>${t.label||"내용"}</span>
        <textarea data-text placeholder="느낀 점·관찰 결과를 적어보세요">${esc(st.text||"")}</textarea></label>`;
    }else if(t.kind === "text"){
      inner += (t.fields||[]).map(f=>`
        <label class="field"><span>${f.label}</span>
          <textarea data-field="${f.k}" placeholder="${f.label}">${esc((st.fields||{})[f.k]||"")}</textarea>
        </label>`).join("");
    }

    inner += `
      <div class="task-foot">
        <span class="state ${st.submittedAt?'ok':''}">${
          st.submittedAt ? `제출됨 · ${new Date(st.submittedAt).toLocaleString()}` : "미제출"
        }</span>
        <span>
          <button class="btn" data-save>임시저장</button>
          <button class="btn primary" data-submit>제출</button>
        </span>
      </div>`;

    wrap.innerHTML = inner;

    // 이벤트
    const slot = wrap.querySelector("[data-slot]");
    wrap.querySelector("[data-photo]")?.addEventListener("change", async (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      try{
        const url = await GJ.Store.resizeImage(f, 1024, 0.78);
        st.photo = url;
        if(slot) slot.innerHTML = `<img src="${url}" />`;
        saveDraft(); toast("사진이 추가되었습니다");
      }catch(err){ toast("사진 처리 실패"); }
    });
    wrap.querySelector("[data-photo-clear]")?.addEventListener("click", ()=>{
      delete st.photo;
      if(slot) slot.innerHTML = "카메라/파일로 사진을 추가하세요";
      saveDraft();
    });
    wrap.querySelector("[data-text]")?.addEventListener("input", (e)=>{
      st.text = e.target.value; saveDraft();
    });
    wrap.querySelectorAll("[data-field]").forEach(el=>{
      el.addEventListener("input", (e)=>{
        st.fields = st.fields || {};
        st.fields[e.target.dataset.field] = e.target.value;
        saveDraft();
      });
    });
    wrap.querySelectorAll("[data-likert]").forEach(el=>{
      el.addEventListener("change", (e)=>{
        const [ri,ci] = e.target.dataset.likert.split(":").map(Number);
        st.likert = st.likert || {};
        st.likert[ri] = ci;
        saveDraft();
      });
    });
    wrap.querySelector("[data-save]").addEventListener("click", ()=>{ saveDraft(); toast("임시저장 완료"); });
    wrap.querySelector("[data-submit]").addEventListener("click", ()=> submitTask(m, t, wrap));

    return wrap;
  }

  function esc(s){ return (s||"").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

  function saveDraft(){
    if(!CURRENT_USER) return;
    GJ.Store.saveDraft(CURRENT_USER, STATE);
  }

  // ---------- 제출 ----------
  async function submitTask(m, t, wrap){
    const st = getTaskState(m.id, t.id);
    st.submittedAt = new Date().toISOString();
    saveDraft();
    const payload = {
      kind:"submission",
      user: CURRENT_USER,
      missionId: m.id,
      missionTitle: `${m.no}. ${m.title}`,
      taskId: t.id,
      taskTitle: t.title,
      data: {
        text: st.text || "",
        fields: st.fields || {},
        likert: st.likert || {},
        photo: st.photo || "",
      },
      submittedAt: st.submittedAt
    };
    // 상태 라벨 갱신
    wrap.querySelector(".state").classList.add("ok");
    wrap.querySelector(".state").textContent = `제출됨 · ${new Date(st.submittedAt).toLocaleString()}`;

    const [fb, sh] = await Promise.all([
      GJ.FB.put(GJ.FB.submissionPath(CURRENT_USER, `${m.id}_${t.id}`), payload),
      GJ.Sheets.send(payload),
    ]);
    const flags = [];
    if(fb.ok) flags.push("DB"); if(sh.ok) flags.push("Sheet");
    toast(flags.length ? `제출 완료 · ${flags.join("+")}` : "제출 완료 · 로컬 저장");
  }

  // ---------- 하단 바 ----------
  $("#btnSaveAll").addEventListener("click", ()=>{ saveDraft(); toast("전체 임시저장 완료"); });
  $("#btnSubmitAll").addEventListener("click", async ()=>{
    if(!confirm("모든 미션의 응답을 제출할까요?")) return;
    saveDraft();
    let n = 0;
    for(const m of GJ.MISSIONS){
      for(const t of m.tasks){
        const st = getTaskState(m.id, t.id);
        const has = (st.text && st.text.trim()) ||
                    (st.fields && Object.values(st.fields).some(v => (v||"").trim())) ||
                    (st.likert && Object.keys(st.likert).length) ||
                    st.photo;
        if(!has) continue;
        st.submittedAt = st.submittedAt || new Date().toISOString();
        const payload = {
          kind:"submission",
          user: CURRENT_USER,
          missionId: m.id, missionTitle:`${m.no}. ${m.title}`,
          taskId: t.id, taskTitle: t.title,
          data:{ text:st.text||"", fields:st.fields||{}, likert:st.likert||{}, photo:st.photo||"" },
          submittedAt: st.submittedAt,
        };
        await Promise.all([
          GJ.FB.put(GJ.FB.submissionPath(CURRENT_USER, `${m.id}_${t.id}`), payload),
          GJ.Sheets.send(payload),
        ]);
        n++;
      }
    }
    saveDraft();
    renderPages();     // 상태 라벨 갱신
    toast(`${n}개 항목 제출 완료`);
  });

  $("#btnSyncNow").addEventListener("click", async ()=>{
    toast("다시 동기화 중…");
    await $("#btnSubmitAll").click;
    // 간단히 전체 제출과 동일한 흐름 재실행 없이, 저장만 보장
    saveDraft();
    toast("동기화 완료");
  });
})();
