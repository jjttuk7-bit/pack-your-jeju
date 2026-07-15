const fs = require('fs');
const path = require('path');
const {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
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
const OUT_FILE = path.join(OUT, '05_온라인접수_제목_주요내용_라이프사이클_개정본.docx');
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
    size: options.size || 19,
    bold: options.bold || false,
    color: options.color || C.ink,
    italics: options.italics || false,
  });
}

function p(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: options.spacing || { after: 90, line: 255 },
    keepNext: options.keepNext,
    keepLines: options.keepLines,
    children: options.children || [run(text, options.run || {})],
  });
}

function linkP(prefix, label, url, suffix = '') {
  return new Paragraph({
    spacing: { after: 90, line: 255 },
    keepLines: true,
    children: [
      run(prefix),
      new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text: label, font: 'Malgun Gothic', size: 20, color: '0563C1', underline: {} })],
      }),
      run(suffix),
    ],
  });
}

function h1(text, options = {}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: options.pageBreakBefore || false,
    spacing: { before: 140, after: 85 },
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
    spacing: { after: 65, line: 240 },
    keepLines: true,
    children: [run(text, { size: 18 })],
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
          margins: { top: 70, bottom: 70, left: 130, right: 130 },
          children: [p(row[0], { spacing: { after: 0 }, run: { size: 18, bold: true, color: C.green } })],
        }),
        new TableCell({
          width: { size: CONTENT - left, type: WidthType.DXA },
          borders,
          margins: { top: 70, bottom: 70, left: 130, right: 130 },
          children: [p(row[1], { spacing: { after: 0, line: 235 }, run: { size: 18 } })],
        }),
      ],
    })),
  });
}

function sectionTitle(text, options = {}) {
  return new Paragraph({
    pageBreakBefore: options.pageBreakBefore || false,
    keepNext: true,
    spacing: { before: 120, after: 45 },
    children: [run(text, { size: 20, bold: true, color: C.green })],
  });
}

function footer() {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      run('제주를 담다 온라인 접수 입력문안 최신본  |  ', { size: 16, color: C.gray }),
      new TextRun({ children: [PageNumber.CURRENT], font: 'Malgun Gothic', size: 16, color: C.gray }),
    ],
  })] });
}

const titleValue = '여행으로 검증하고 다시 강화하는 제주 공공데이터, ‘제주를 담다’';

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

  sectionTitle('제품·서비스 정의'),
  p('‘제주를 담다(Pack Your Jeju)’는 제주 공공데이터를 정제·연결해 여행 선택의 근거로 제공하고, 하루방 리서치와 사용자 직접입력, 실제 방문 피드백을 거쳐 다시 신뢰 가능한 데이터로 축적하는 공공데이터 라이프사이클 서비스입니다. 여행 플랜은 최종 목적이 아니라 공공데이터를 현실에서 활용하고 검증하는 한 사이클입니다.'),

  sectionTitle('핵심 기술·기능'),
  bullet('Python 기반 공공데이터 ETL: 서로 다른 제주 관광·교통·기상 데이터를 공통 구조로 정규화하고 체크섬으로 변경 여부를 감지합니다.'),
  bullet('PostgreSQL 검색·연결: Full Text Search, GIN, pg_trgm으로 명칭·주소의 표기 차이를 보완하고, 공영주차장 1km·버스정류장 500m 범위의 접근성 근거를 연결합니다.'),
  bullet('하루방 AI 리서치: LLM Function Calling과 RAG로 지역·일정·동행자·취향과 대화 문맥을 해석하고 공식·플랫폼·경험 출처의 원문을 조사합니다.'),
  bullet('Trust Engine과 근거 원장: 출처 역할·최신성·교차확인·충돌을 규칙 기반으로 점수화하고, 점수 근거와 확인 필요 항목을 함께 표시합니다.'),
  bullet('운영형 PWA: React/Vite PWA와 FastAPI·Pydantic·SQLAlchemy·PostgreSQL로 구현하고, Vercel과 Railway에 분리 배포해 모바일에서 설치해 사용할 수 있습니다.'),

  sectionTitle('공공데이터 활용과 차별성'),
  p('비짓제주 관광정보 4,422건, 공영주차장 1,557건, 버스정류장 4,271건과 기상청 예보를 정규화·연결했습니다. 단순 추천 서비스와 달리 “어디를 갈지”뿐 아니라 어떤 데이터와 출처가 그 판단을 뒷받침하는지 보여주고, 실제 여행의 결과를 다음 데이터 품질 개선으로 되돌립니다.'),

  sectionTitle('세 가지 플랜 생성 경로', { pageBreakBefore: true }),
  bullet('공공데이터 후보: 정규화된 관광·교통·기상 근거를 바탕으로 장소와 접근 조건을 확인합니다.'),
  bullet('하루방 웹검색: 지역·일정·동행자·취향과 대화 문맥을 이어받아 원문을 재검색하고 최신성·충돌·주의점을 비교합니다.'),
  bullet('사용자 직접입력: 사용자가 발견한 장소도 플랜에 담되 입력 주체와 근거 상태를 구분해 저장합니다.'),
  p('세 경로는 하나의 플랜에서 함께 작동합니다. 공공데이터는 신뢰의 출발점이고, 하루방 검색과 사용자 입력은 선택 범위를 넓히며, 실제 여행은 그 근거를 검증합니다.'),

  sectionTitle('실제 여행 피드백의 신뢰 축적'),
  p('PlanItem·Evidence·VisitFeedback·ModerationCase·PublicDataCorrection을 분리한 PostgreSQL 근거 원장에 방문 여부, 정보 일치·불일치, 확인 시점과 근거 URL을 기록합니다. 중복 제출 방지 키로 반복 저장을 막고, 단일 제보가 원본을 바꾸지 않도록 합니다. 반복성·독립성·웹 재검증·운영자 검토를 통과한 내용만 원본을 보존한 버전형 보정 후보와 새로운 근거 데이터로 축적합니다.'),

  sectionTitle('현재 MVP와 개인 실행 역량'),
  p('현재 MVP는 개인 1인 창업자가 직접 설계·구현한 배포형 웹·API 시제품입니다. 여행팩·지도, 하루방 상담, 세 경로 후보 담기, 플랜·PDF, 방문 피드백과 검토의 최소 순환을 구현했으며 신뢰 엔진 골든셋 12/12와 백엔드 자동 테스트 229건을 통과했습니다. 신청자는 AI 엔지니어링 정규 교육과정을 모두 이수했으며 공식 수료 절차를 앞두고 있습니다. Python 데이터 처리, ML, LLM·RAG를 학습·적용했고 60개 이상의 웹 서비스·프로토타입 저장소를 구축했습니다.'),
  linkP('서비스: ', 'https://pack-your-jeju.vercel.app', 'https://pack-your-jeju.vercel.app'),

  sectionTitle('고도화 계획과 사업화'),
  p('향후에는 회원 인증·장기 저장, 증빙 원본 보호, 기여자 신뢰도, 중복·조작 신호 탐지, 기관 검토·환류 API와 지역별 데이터 품질 대시보드로 확장합니다. 무료 여행 플랜과 PWA 설치로 이용·방문·피드백 전환을 검증한 뒤, 여행자 프리미엄 기능, 로컬 사업자 정보 변경 리포트, 지자체·관광기관 품질 대시보드로 이어지는 B2C→B2B→B2G 모델을 단계적으로 검증합니다.'),

  sectionTitle('기대효과'),
  p('여행자는 근거가 연결된 플랜으로 헛걸음과 일정 실패를 줄이고, 제주 지역은 다양한 권역과 장소의 발견 기회를 넓힙니다. 공공기관은 실제 이용에서 반복 확인된 현장 신호로 갱신 우선순위를 판단하며, 공공데이터는 공개에서 끝나지 않고 활용·검증·보정·확장되는 지속 가능한 자산으로 발전합니다.'),

  box('복사 끝', '여기까지 주요내용 편집기에 입력', { labelFill: C.orange, fill: C.yellow, bold: true }),

  h1('3. 온라인 편집기 권장 서식'),
  infoTable([
    ['글꼴·크기', 'Noto Sans KR 또는 기본 글꼴, 11pt'],
    ['소제목', '제안 개요부터 기대효과까지 각 제목을 굵게 표시'],
    ['본문', '왼쪽 정렬, 문단 사이 한 줄 유지'],
  ]),

  h1('4. 대표이미지 권장안', { pageBreakBefore: true }),
  infoTable([
    ['규격', '가로 494px × 세로 375px 이상, 가로형 이미지'],
    ['권장 장면', '공공데이터·하루방 RAG·사용자 입력이 Trust Engine과 실제 여행 피드백을 거쳐 다시 근거 데이터로 순환하는 서비스 화면'],
    ['이미지 문구', '“공공데이터·RAG·Trust Engine으로 만드는 제주 여행 신뢰 라이프사이클”'],
    ['주의', '개인정보, API 키, 관리자 주소, 브라우저 북마크가 보이지 않게 캡처'],
  ]),

  h1('5. 첨부파일 선택 안내'),
  infoTable([
    ['필수 우선', '04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf'],
    ['편집본 보관', '04_제주를담다_공공데이터_라이프사이클_사업계획서.docx'],
    ['권장 자료', '시연영상 MP4 — 접수 화면에 별도 영상 칸이 있으면 해당 칸에 업로드'],
    ['여러 파일', '포털 안내에 따라 필요 시 압축하되, 사업계획서는 PDF 단독 제출을 우선'],
    ['공개 여부', '개인정보·신청자 정보가 포함된 파일은 “첨부파일 공개”를 선택하지 않음'],
  ]),

  h1('6. 저장 전 체크리스트'),
  bullet('제목과 주요내용의 아이템명이 ‘제주를 담다(Pack Your Jeju)’로 일치하는지 확인'),
  bullet('주요내용에 서비스 URL이 클릭 가능한 링크로 표시되는지 확인'),
  bullet('대표이미지가 494×375px 이상이며 깨지거나 찌그러지지 않는지 확인'),
  bullet('사업계획서가 최신 기술 중심 04번 PDF인지, 개인 1인 창업자 정보와 일치하는지 확인'),
  bullet('첨부파일 공개 체크가 개인정보 보호 원칙에 맞는지 확인'),
  bullet('저장 후 등록 상세 화면에서 제목·문단·링크·첨부파일을 다시 열어 확인'),
];

const doc = new Document({
  creator: 'Pack Your Jeju',
  title: '2026 제주 공공데이터·AI 활용 창업경진대회 온라인 접수 라이프사이클 개정본',
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
