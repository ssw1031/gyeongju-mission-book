/** 경주 미션북 — Google Apps Script 웹앱
 *  Spreadsheet 안에 "Submissions"와 "Feedback" 시트가 자동 생성됩니다.
 *
 *  배포 방법
 *  1) 새 Google Sheet 생성
 *  2) 확장 프로그램 → Apps Script
 *  3) 이 파일 전체 내용을 Code.gs 에 붙여넣기
 *  4) 상단 "배포" → "새 배포" → 유형: 웹 앱
 *     - 다음 사용자로 실행: 본인
 *     - 액세스 권한: 모든 사용자
 *  5) 발급된 "웹 앱 URL"을 교사 대시보드 → 연동 설정에 저장
 */
const SHEET_SUB = 'Submissions';
const SHEET_FB  = 'Feedback';

function doPost(e){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const body = JSON.parse(e.postData.contents);
  if(body.kind === 'submission') writeSubmission(ss, body);
  else if(body.kind === 'feedback') writeFeedback(ss, body);
  return ContentService.createTextOutput(JSON.stringify({ok:true}))
    .setMimeType(ContentService.MimeType.JSON);
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
    (b.data.photo||'').slice(0, 48000)
  ]);
}
function writeFeedback(ss, b){
  const header = ['시각','학년','반','이름','미션ID','미션','과제ID','과제','피드백'];
  const sh = ensureSheet(ss, SHEET_FB, header);
  sh.appendRow([b.at, b.user.grade, b.user.cls, b.user.name,
    b.missionId, b.missionTitle, b.taskId, b.taskTitle, b.feedback||'']);
}
