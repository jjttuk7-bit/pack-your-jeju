import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';


const editorSource = fs.readFileSync(
  new URL('../src/components/PlanPdfEditor.tsx', import.meta.url),
  'utf8',
);
const dashboardSource = fs.readFileSync(
  new URL('../src/components/PackingDashboard.tsx', import.meta.url),
  'utf8',
);


test('travel passport editor exposes accessible itinerary editing controls', () => {
  assert.match(editorSource, /role="dialog"/);
  assert.match(editorSource, /aria-modal="true"/);
  assert.match(editorSource, /여행 제목/);
  assert.match(editorSource, /<select/);
  assert.match(editorSource, />위로</);
  assert.match(editorSource, />아래로</);
  assert.match(editorSource, /여행 메모/);
  assert.match(editorSource, /PDF 만들기/);
  assert.match(editorSource, /선택한 장소가 없습니다/);
  assert.match(editorSource, /downloadTravelPlanPdf/);
});


test('dashboard opens the PDF editor and no longer creates a text download', () => {
  assert.match(dashboardSource, /<PlanPdfEditor/);
  assert.match(dashboardSource, /여행 플랜 PDF/);
  assert.match(dashboardSource, /selectedPlanItems\.length === 0/);
  assert.doesNotMatch(dashboardSource, /text\/plain/);
  assert.doesNotMatch(dashboardSource, /\.txt/);
});
