const fs = require('fs');
const path = require('path');
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} = require('C:/tmp/jeju-contest-doc-tool/node_modules/docx');

const OUT = path.resolve(__dirname, '../docs/competition/2026-jeju-public-data-ai');
const OUT_FILE = path.join(OUT, '05_온라인접수_제목_주요내용_입력문안.docx');
fs.mkdirSync(OUT, { recursive: true });

const C = {
  green: '174E45',
  orange: 'E96638',
  ink: '202522',
  gray: '66706B',
  pale: 'EEF5F1',
  paleOrange: 'FFF3EB',
  line: 'BCC9C3',
  white: 'FFFFFF',
  yellow: 'FFF8DE',
};
const A4 = { width: 11906, height: 16838 };
const MARGIN = { top: 850, right: 900, bottom: 850, left: 900 };
const CONTENT = A4.width - MARGIN.left - MARGIN.right;
const border = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const borders = { top: border, bottom: border, left: border, right: border };

function run(text, options = {}) {
  return new TextRun({
    text,
    font: 'Malgun Gothic',
    size: options.size || 20,
    bold: options.bold || false,
    color: options.color || C.ink,
    italics: options.italics || false,
  });
}

function p(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: options.spacing || { after: 105, line: 280 },
    keepNext: options.keepNext,
    keepLines: options.keepLines,
    children: options.children || [run(text, options.run || {})],
  });
}

function h1(text, options = {}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: options.pageBreakBefore || false,
    spacing: { before: 180, after: 110 },
    keepNext: true,
    children: [run(text, { size: 28, bold: true, color: C.green })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 140, after: 75 },
    keepNext: true,
    children: [run(text, { size: 22, bold: true, color: C.ink })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'entry-bullets', level: 0 },
    spacing: { after: 75, line: 260 },
    keepLines: true,
    children: [run(text, { size: 19 })],
  });
}

function box(label, content, options = {}) {
  const labelWidth = 1900;
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [labelWidth, CONTENT - labelWidth],
    rows: [new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: labelWidth, type: WidthType.DXA },
          borders,
          shading: { fill: options.labelFill || C.green, type: ShadingType.CLEAR },
          margins: { top: 130, bottom: 130, left: 130, right: 130 },
          verticalAlign: VerticalAlign.CENTER,
          children: [p(label, { alignment: AlignmentType.CENTER, spacing: { after: 0 }, run: { size: 18, bold: true, color: C.white } })],
        }),
        new TableCell({
          width: { size: CONTENT - labelWidth, type: WidthType.DXA },
          borders,
          shading: { fill: options.fill || C.pale, type: ShadingType.CLEAR },
          margins: { top: 130, bottom: 130, left: 170, right: 170 },
          verticalAlign: VerticalAlign.CENTER,
          children: [p(content, { spacing: { after: 0, line: 260 }, run: { size: options.size || 19, bold: options.bold || false, color: options.color || C.ink } })],
        }),
      ],
    })],
  });
}

function infoTable(rows) {
  const left = 2500;
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [left, CONTENT - left],
    rows: rows.map((row, index) => new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: left, type: WidthType.DXA },
          borders,
          shading: { fill: index % 2 === 0 ? C.pale : 'F8FAF9', type: ShadingType.CLEAR },
          margins: { top: 95, bottom: 95, left: 130, right: 130 },
          children: [p(row[0], { spacing: { after: 0 }, run: { size: 18, bold: true, color: C.green } })],
        }),
        new TableCell({
          width: { size: CONTENT - left, type: WidthType.DXA },
          borders,
          margins: { top: 95, bottom: 95, left: 130, right: 130 },
          children: [p(row[1], { spacing: { after: 0, line: 250 }, run: { size: 18 } })],
        }),
      ],
    })),
  });
}

function sectionTitle(text) {
  return p(text, {
    keepNext: true,
    spacing: { before: 120, after: 45 },
    run: { size: 20, bold: true, color: C.green },
  });
}

function footer() {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      run('제주를 담다 온라인 접수 입력문안  |  ', { size: 16, color: C.gray }),
      new TextRun({ children: [PageNumber.CURRENT], font: 'Malgun Gothic', size: 16, color: C.gray }),
    ],
  })] });
}

const titleValue = '공공데이터와 AI로 신뢰할 수 있는 제주 여행을 만드는 ‘제주를 담다’';

const children = [
  p('「2026년 제주 공공데이터·AI 활용 창업경진대회」', { alignment: AlignmentType.CENTER, spacing: { before: 220, after: 100 }, run: { size: 22, bold: true, color: C.green } }),
  p('온라인 접수 입력문안', { alignment: AlignmentType.CENTER, spacing: { after: 80 }, run: { size: 38, bold: true } }),
  p('제목·주요내용·대표이미지·첨부파일 안내', { alignment: AlignmentType.CENTER, spacing: { after: 300 }, run: { size: 21, bold: true, color: C.orange } }),

  h1('1. 제목 입력값'),
  box('제목', titleValue, { bold: true, size: 21, fill: C.paleOrange }),
  p('※ 위 문장을 제목 입력란에 그대로 붙여넣습니다.', { spacing: { before: 55, after: 155 }, run: { size: 17, color: C.gray } }),

  h1('2. 주요내용 입력값'),
  p('아래 “복사 시작”부터 “복사 끝” 직전까지 주요내용 편집기에 붙여넣습니다. 붙여넣은 뒤 각 소제목만 굵게 표시하면 됩니다.', { run: { size: 18, color: C.gray } }),
  box('복사 시작', '아래 본문 전체', { labelFill: C.orange, fill: C.yellow, bold: true }),

  sectionTitle('제안 개요'),
  p('‘제주를 담다(Pack Your Jeju)’는 제주 여행자가 무엇을 선택할지 결정하도록 돕는 공공데이터·웹 근거·AI 기반 여행 의사결정 서비스입니다. 지역, 일정, 동행자와 취향을 반영해 여행 후보를 비교하고, 각 정보의 출처·확인 시점·주의점을 함께 보여줍니다.'),

  sectionTitle('문제 인식'),
  p('제주 여행자는 공식 관광정보, 지도, 블로그와 리뷰를 오가며 계획하지만 운영시간·주소·휴무·접근성 정보는 빠르게 변합니다. 비짓제주 공개 콘텐츠 수정요청 1,686건은 공식 관광정보도 지속적인 확인과 갱신이 필요하다는 점을 보여줍니다. 일반 AI가 출처 없이 장소나 최신 운영정보를 생성하면 여행자의 헛걸음과 일정 실패로 이어질 수 있습니다.'),

  sectionTitle('해결 방법'),
  p('하루방 AI 에이전트가 질문과 대화 문맥에서 지역·일정·동행자·취향·제외 조건을 파악하고 웹 원문을 조사합니다. 공식 출처는 운영 사실, 지도·예약 플랫폼은 위치와 영업 상태, 후기·영상·SNS는 분위기와 경험 판단에 활용합니다. 제주 공공데이터는 추천 후보를 제한하지 않고 답변 마지막에 장소·주소·접근성의 일치 여부를 교차확인합니다.'),

  sectionTitle('공공데이터 및 AI 활용'),
  p('비짓제주 관광정보 4,422건을 장소·주소·좌표·카테고리 기준으로 정제하고, 공영주차장 1,557건과 버스정류장 4,271건을 좌표 기반 접근성 신호로 결합했습니다. 콘텐츠 수정요청은 정보 변경 가능성과 재확인 우선순위로 사용하며, 기상청 예보는 강풍·우천·폭염 시 야외 일정 주의와 대체 후보 제안에 활용합니다. AI는 근거를 찾고 비교·요약하되 확인되지 않은 사실을 추가하지 않습니다.'),

  sectionTitle('핵심 기능'),
  bullet('제주 12권역과 오름·바다·맛집·카페·숙박·행사 등 12개 여행 순간을 조합한 신뢰 여행팩'),
  bullet('웹 리서치, 출처 역할 평가, 최신성·충돌 표시와 후속 질문 문맥을 유지하는 하루방 상담'),
  bullet('공공데이터 후보, 하루방 웹검색 후보, 사용자 직접입력 장소를 출처와 함께 하나의 플랜에 저장'),
  bullet('방문 여부·정보 불일치·메모를 공공데이터 원본과 분리해 축적하고 운영자 검토로 연결하는 신뢰 순환'),

  sectionTitle('차별성'),
  p('지도 앱처럼 장소를 나열하거나 일반 AI처럼 그럴듯한 일정을 만드는 데서 끝나지 않습니다. 핵심 주장 가까이에 출처와 확인 시점을 연결하고, 검색 실패·출처 충돌·공공데이터 미확인을 숨기지 않습니다. 실제 방문 피드백도 원본 데이터를 바로 덮어쓰지 않고 반복 제보, 웹 재검증, 운영자 승인을 거쳐 다음 사용자의 근거로 반영합니다.'),

  sectionTitle('개발 및 검증 현황'),
  p('현재 배포형 웹·API 시제품에서 여행 조건 입력, 여행팩·지도, 추가 후보 탐색, 하루방 상담, 웹 후보 담기, 플랜·PDF, 방문 피드백과 운영자 검토 기본 흐름을 구현했습니다. 신뢰 엔진 골든셋 12/12를 통과했으며 백엔드 자동 테스트 229건이 통과했습니다. 서비스는 https://pack-your-jeju.vercel.app 에서 확인할 수 있습니다.'),

  sectionTitle('사업화 계획'),
  p('초기에는 여행팩·하루방·기본 PDF를 무료로 제공해 실제 선택과 방문 전환을 검증합니다. 이후 공유 플랜, 여행 저널 아카이브와 고급 비교 기능을 여행자 프리미엄으로 확장하고, 로컬 사업자에는 정보 변경 신호 리포트, 지자체·관광기관에는 지역별 데이터 공백과 갱신 우선순위 대시보드를 제공하는 B2B·B2G 모델을 검증합니다.'),

  sectionTitle('기대효과'),
  p('여행자는 낡거나 충돌하는 정보로 인한 헛걸음과 일정 실패를 줄이고 선택 근거를 동행자와 공유할 수 있습니다. 제주 지역은 유명 장소 쏠림을 넘어 권역·취향·접근 조건에 맞는 다양한 후보 발견을 지원받습니다. 로컬 사업자와 공공기관은 반복되는 현장 신호를 정보 정정과 공공데이터 갱신 우선순위로 활용할 수 있습니다.'),

  box('복사 끝', '여기까지 주요내용 편집기에 입력', { labelFill: C.orange, fill: C.yellow, bold: true }),

  h1('3. 온라인 편집기 권장 서식'),
  infoTable([
    ['글꼴·크기', 'Noto Sans KR 또는 기본 글꼴, 11pt'],
    ['소제목', '제안 개요부터 기대효과까지 각 제목을 굵게 표시'],
    ['본문', '왼쪽 정렬, 문단 사이 한 줄 유지'],
    ['링크', '서비스 URL에 하이퍼링크 적용'],
  ]),

  h1('4. 대표이미지 권장안', { pageBreakBefore: true }),
  infoTable([
    ['규격', '가로 494px × 세로 375px 이상, 가로형 이미지'],
    ['권장 장면', '서비스 랜딩 화면과 하루방 상담 또는 신뢰 여행팩 카드가 함께 보이는 화면'],
    ['이미지 문구', '“근거로 계획하는 제주 AI 여행” 또는 “확인된 것과 확인되지 않은 것을 구분합니다”'],
    ['주의', '개인정보, API 키, 관리자 주소, 브라우저 북마크가 보이지 않게 캡처'],
  ]),

  h1('5. 첨부파일 선택 안내'),
  infoTable([
    ['필수 우선', '04_제주를담다_최종_사업계획서.pdf'],
    ['편집본 보관', '04_제주를담다_최종_사업계획서.docx'],
    ['권장 자료', '시연영상 MP4 — 접수 화면에 별도 영상 칸이 있으면 해당 칸에 업로드'],
    ['여러 파일', '포털 안내에 따라 필요 시 압축하되, 사업계획서는 PDF 단독 제출을 우선'],
    ['공개 여부', '개인정보·팀 정보가 포함된 파일은 “첨부파일 공개”를 선택하지 않음'],
  ]),

  h1('6. 저장 전 체크리스트'),
  bullet('제목과 주요내용의 아이템명이 ‘제주를 담다(Pack Your Jeju)’로 일치하는지 확인'),
  bullet('주요내용에 서비스 URL이 클릭 가능한 링크로 표시되는지 확인'),
  bullet('대표이미지가 494×375px 이상이며 깨지거나 찌그러지지 않는지 확인'),
  bullet('사업계획서가 최신 04번 PDF인지, 팀 역량 입력란을 실제 정보로 교체했는지 확인'),
  bullet('첨부파일 공개 체크가 개인정보 보호 원칙에 맞는지 확인'),
  bullet('저장 후 등록 상세 화면에서 제목·문단·링크·첨부파일을 다시 열어 확인'),
];

const doc = new Document({
  creator: 'Pack Your Jeju',
  title: '2026 제주 공공데이터·AI 활용 창업경진대회 온라인 접수 입력문안',
  styles: {
    default: { document: { run: { font: 'Malgun Gothic', size: 20, color: C.ink }, paragraph: { spacing: { line: 280 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Malgun Gothic', size: 28, bold: true, color: C.green },
        paragraph: { spacing: { before: 180, after: 110 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Malgun Gothic', size: 22, bold: true, color: C.ink },
        paragraph: { spacing: { before: 140, after: 75 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{
    reference: 'entry-bullets',
    levels: [{
      level: 0,
      format: LevelFormat.BULLET,
      text: '•',
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 430, hanging: 220 } } },
    }],
  }] },
  sections: [{
    properties: { page: { size: A4, margin: MARGIN } },
    footers: { default: footer() },
    children,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT_FILE, buffer);
  console.log(OUT_FILE);
});
