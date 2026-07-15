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
  PageBreak,
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
const OUT_FILE = path.join(OUT, '04_제주를담다_공공데이터_라이프사이클_사업계획서.docx');
fs.mkdirSync(OUT, { recursive: true });

const COLOR = {
  green: '145C55',
  green2: '2E756C',
  orange: 'F06435',
  ink: '263330',
  gray: '65716E',
  pale: 'E8F4F0',
  paleOrange: 'FFF0E8',
  paleBlue: 'EDF2F6',
  line: 'B9C9C4',
  white: 'FFFFFF',
  yellow: 'FFF7DF',
};

const A4 = { width: 11906, height: 16838 };
const MARGIN = { top: 760, right: 760, bottom: 760, left: 760 };
const CONTENT = A4.width - MARGIN.left - MARGIN.right;
const thin = { style: BorderStyle.SINGLE, size: 4, color: COLOR.line };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function run(text, options = {}) {
  return new TextRun({
    text,
    font: 'Malgun Gothic',
    size: options.size || 19,
    bold: options.bold || false,
    color: options.color || COLOR.ink,
    italics: options.italics || false,
    underline: options.underline,
  });
}

function paragraph(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: options.spacing || { after: 95, line: 255 },
    indent: options.indent,
    keepNext: options.keepNext,
    keepLines: options.keepLines,
    children: options.children || [run(text, options.run || {})],
  });
}

function title(text, subtitle) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 280, after: 190 },
      keepNext: true,
      children: [run('「2026년 제주 공공데이터·AI 활용 창업경진대회」', { size: 22, bold: true, color: COLOR.green })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: subtitle ? 160 : 360 },
      keepNext: true,
      children: [run(text, { size: 40, bold: true })],
    }),
    ...(subtitle ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      keepNext: true,
      children: [run(subtitle, { size: 22, bold: true, color: COLOR.orange })],
    })] : []),
  ];
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 40, after: 145 },
    keepNext: true,
    children: [run(text, { size: 29, bold: true, color: COLOR.green })],
  });
}

function subHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 130, after: 85 },
    keepNext: true,
    children: [run(text, { size: 23, bold: true, color: COLOR.ink })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'business-bullets', level },
    spacing: { after: 70, line: 250 },
    keepLines: true,
    children: [run(text, { size: 18 })],
  });
}

function note(text, color = COLOR.pale) {
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [CONTENT],
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        width: { size: CONTENT, type: WidthType.DXA },
        borders,
        shading: { fill: color, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 180, right: 180 },
        children: [paragraph(text, { alignment: AlignmentType.CENTER, spacing: { after: 0, line: 250 }, run: { size: 19, bold: true, color: COLOR.green } })],
      })],
    })],
  });
}

function statusNote(label, text, kind = 'current') {
  const fill = kind === 'current' ? COLOR.pale : COLOR.paleBlue;
  const accent = kind === 'current' ? COLOR.green : COLOR.gray;
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [1750, CONTENT - 1750],
    rows: [new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 1750, type: WidthType.DXA }, borders,
          shading: { fill: accent, type: ShadingType.CLEAR },
          margins: { top: 105, bottom: 105, left: 110, right: 110 },
          verticalAlign: VerticalAlign.CENTER,
          children: [paragraph(label, { alignment: AlignmentType.CENTER, spacing: { after: 0 }, run: { size: 17, bold: true, color: COLOR.white } })],
        }),
        new TableCell({
          width: { size: CONTENT - 1750, type: WidthType.DXA }, borders,
          shading: { fill, type: ShadingType.CLEAR },
          margins: { top: 105, bottom: 105, left: 150, right: 150 },
          verticalAlign: VerticalAlign.CENTER,
          children: [paragraph(text, { spacing: { after: 0, line: 230 }, run: { size: 17, color: COLOR.ink } })],
        }),
      ],
    })],
  });
}

function linkParagraph(label, url) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 90, after: 90 },
    children: [
      run(`${label}  `, { size: 18, bold: true, color: COLOR.gray }),
      new ExternalHyperlink({
        link: url,
        children: [run(url, { size: 18, bold: true, color: COLOR.orange, underline: {} })],
      }),
    ],
  });
}

function table(headers, rows, widths, options = {}) {
  if (widths.reduce((sum, value) => sum + value, 0) !== CONTENT) {
    throw new Error(`Table widths must sum to ${CONTENT}`);
  }
  const headerRow = new TableRow({
    cantSplit: true,
    tableHeader: true,
    children: headers.map((header, index) => new TableCell({
      width: { size: widths[index], type: WidthType.DXA },
      borders,
      shading: { fill: options.headerFill || COLOR.green, type: ShadingType.CLEAR },
      margins: { top: 85, bottom: 85, left: 95, right: 95 },
      verticalAlign: VerticalAlign.CENTER,
      children: [paragraph(header, {
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: 225 },
        run: { size: options.headerSize || 17, bold: true, color: COLOR.white },
      })],
    })),
  });

  const bodyRows = rows.map((row, rowIndex) => new TableRow({
    cantSplit: true,
    children: row.map((value, index) => new TableCell({
      width: { size: widths[index], type: WidthType.DXA },
      borders,
      shading: rowIndex % 2 === 1 ? { fill: 'F8FAF9', type: ShadingType.CLEAR } : undefined,
      margins: { top: 75, bottom: 75, left: 105, right: 105 },
      verticalAlign: VerticalAlign.CENTER,
      children: [paragraph(String(value), {
        alignment: index === 0 && options.firstCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 0, line: options.compact ? 215 : 235 },
        run: { size: options.bodySize || 17, bold: index === 0 && options.firstBold },
      })],
    })),
  }));

  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...bodyRows],
  });
}

function metricCards(metrics) {
  const width = Math.floor(CONTENT / metrics.length);
  const widths = metrics.map((_, index) => index === metrics.length - 1 ? CONTENT - width * (metrics.length - 1) : width);
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: widths,
    rows: [new TableRow({
      cantSplit: true,
      children: metrics.map((metric, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        borders,
        shading: { fill: index % 2 === 0 ? COLOR.pale : COLOR.paleOrange, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 80, right: 80 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          paragraph(metric.value, { alignment: AlignmentType.CENTER, spacing: { after: 40 }, run: { size: 27, bold: true, color: index % 2 === 0 ? COLOR.green : COLOR.orange } }),
          paragraph(metric.label, { alignment: AlignmentType.CENTER, spacing: { after: 0, line: 220 }, run: { size: 16, bold: true, color: COLOR.gray } }),
        ],
      })),
    })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function footer() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        run('제주를 담다 (Pack Your Jeju)  |  ', { size: 16, color: COLOR.gray }),
        new TextRun({ children: [PageNumber.CURRENT], font: 'Malgun Gothic', size: 16, color: COLOR.gray }),
      ],
    })],
  });
}

const pages = [];
function addPage(children) {
  if (pages.length) pages.push(pageBreak());
  pages.push(...children);
}

// 1쪽: 표지와 기술·서비스 요약
addPage([
  ...title('사 업 계 획 서'),
  table(['항목', '제출 내용'], [
    ['아이템명', '제주를 담다 (Pack Your Jeju)'],
    ['아이템 소개', '여행으로 검증하고 다시 강화하는 제주 공공데이터'],
    ['제품·서비스', '공공데이터·웹 근거·실제 여행 피드백을 연결하는 제주 여행 의사결정·데이터 신뢰 플랫폼'],
    ['핵심 기술', 'Python ETL · PostgreSQL 검색 · LLM Function Calling/RAG · Trust Engine · 근거 원장 · React PWA/FastAPI'],
    ['신청 주체', '개인 1인 창업자'],
  ], [2100, CONTENT - 2100], { firstBold: true, bodySize: 17, compact: true }),
  linkParagraph('시제품', 'https://pack-your-jeju.vercel.app'),
  note('제주 여행을 통해 공공데이터는 실제 선택과 방문 속에서 검증되고, 그 결과는 다시 신뢰 가능한 데이터로 축적됩니다.'),
  subHeading('기술이 만드는 서비스'),
  paragraph('공공데이터 후보, 하루방 웹검색 추천, 사용자 직접입력을 출처가 보존된 하나의 플랜으로 만들고, 실제 여행의 피드백을 검증·판정·버전 보정하여 다음 여행과 공공데이터 품질 개선에 다시 사용합니다.'),
  statusNote('현재 MVP', '데이터 수집·여행팩·하루방·Trust Engine·세 출처 플랜·방문 피드백·검토 API를 배포형 웹으로 구현했습니다.', 'current'),
  statusNote('고도화 계획', '운영 인증·장기 증빙 보관·기여자 신뢰·기관 환류를 단계적으로 확장합니다.', 'future'),
]);

// 2쪽: 전체 기술 아키텍처
addPage([
  sectionHeading('1 개발 서비스 개요'),
  subHeading('1-1. 개발 서비스의 기능 및 특징'),
  paragraph('제주를 담다는 여행 조건을 입력받아 공공데이터와 웹 원문을 조사하고, 신뢰 상태가 설명된 플랜을 만든 뒤 실제 방문 결과를 다시 데이터 품질 신호로 축적하는 웹 서비스입니다.'),
  subHeading('전체 기술 아키텍처'),
  table(['계층', '실제 기술', '담당 기능'], [
    ['사용자 접점', 'React · Vite · React PWA · 지도 UI', '조건 입력, 여행팩 비교, 하루방 대화, 플랜·PDF, 방문 피드백'],
    ['서비스 API', 'FastAPI · Python 3.11 · Pydantic · SQLAlchemy', '요청 검증, 기능 라우팅, 인증·권한 경계, 구조화 응답'],
    ['데이터·AI 엔진', '공공데이터 ETL · LLM Function Calling · RAG · Trust Engine', '수집·정규화, 검색 계획, 근거 조립, 신뢰 판단과 주장 검증'],
    ['근거 저장소', 'PostgreSQL · JSONB · GIN · pg_trgm · 버전형 스키마', '장소·출처·플랜·피드백·검토·보정 이력 저장과 검색'],
    ['배포·운영', 'Vercel Web · Railway API/DB · 환경변수 · timeout/fallback', '분리 배포, 키 보호, 외부 서비스 장애의 제한 상태 처리'],
  ], [1750, 3800, CONTENT - 5550], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('입력에서 데이터 환류까지'),
  note('여행 조건 → 공공데이터·웹 근거 검색 → Trust Engine 판단 → 출처 보존 플랜 → 실제 여행 → 피드백·운영자 검토 → 버전형 보정'),
  table(['입력', '처리', '출력'], [
    ['지역·기간·동행자·취향·질문', '구조화 필터, 웹 리서치, 출처 분류, 신뢰 계산', '근거·주의점이 포함된 후보와 하루방 답변'],
    ['세 경로의 장소 선택', '출처·확인 시점·선택 이유 스냅샷', '지도·일정·PDF로 이어지는 여행 플랜'],
    ['방문·불일치·경험 피드백', '사실/경험 분리, 중복 방지, 검토 큐와 판정', '신뢰 상태·보정 버전·기관 전달 후보'],
  ], [2950, 3800, CONTENT - 6750], { firstBold: true, bodySize: 16, compact: true }),
]);

// 3쪽: 데이터·검색·공간 결합 기술
addPage([
  subHeading('1-1. 핵심 기술 ① — 데이터·검색·공간 결합'),
  table(['핵심 기술', '구현 방식', '서비스 효과', '구현 상태'], [
    ['Python 기반 공공데이터 ETL', '비짓제주·수정요청·주차·정류장 데이터를 수집하고 원본 ID·수집 시점을 보존', '서로 다른 데이터를 장소 기준으로 비교 가능하게 변환', '현재 MVP'],
    ['정규화·변경 감지', '장소명·주소·좌표·카테고리 정제와 체크섬 기반 변경 신호 계산', '낡거나 달라진 정보를 재확인 대상으로 표시', '현재 MVP'],
    ['PostgreSQL 검색', '관계형 필터, Full Text Search, GIN, pg_trgm 명칭·주소 유사 검색', '조건에 맞는 후보를 빠르게 찾고 별칭·중복 장소 판별', '현재 MVP'],
    ['공간 접근성 결합', '좌표 거리 계산으로 장소 반경 1km 주차장, 500m 버스정류장 확인', '가족·대중교통 여행자의 이동 판단 근거 제공', '현재 MVP'],
    ['기상 위험 정규화', '기상청 예보를 날짜·권역·강풍·우천·폭염 신호로 변환', '오름·바다 등 야외 일정의 주의와 대체 판단', '현재 MVP'],
    ['pgvector 의미 검색', 'PostgreSQL vector(1536) 스키마를 의미 검색 확장 기반으로 준비', '장소·주장·출처 의미 유사도 검색으로 고도화', '고도화 계획'],
  ], [2150, 4000, 3000, CONTENT - 9150], { firstBold: true, bodySize: 14, compact: true }),
  subHeading('개발 데이터 스냅샷과 검색 근거'),
  metricCards([
    { value: '4,422', label: '정제 장소' },
    { value: '1,557', label: '공영주차장' },
    { value: '4,271', label: '버스정류장' },
    { value: '556', label: '수정요청 매칭 장소' },
  ]),
  paragraph('현재 후보 검색은 활성 구현인 구조화 조회·GIN·pg_trgm을 중심으로 설명합니다. pgvector는 향후 근거 문장과 장소의 의미 검색을 위한 확장 기반이며 현재 성능으로 과장하지 않습니다.', { run: { size: 16, color: COLOR.gray } }),
  subHeading('기술적 특징'),
  bullet('추천 전에 원본 ID·주소·좌표·수집 시점과 변경 신호를 먼저 확보합니다.'),
  bullet('접근성과 날씨를 별도 카드가 아니라 장소 선택의 신뢰 근거로 결합합니다.'),
  bullet('검색 결과가 없을 때 존재하지 않는 장소를 생성하지 않고 데이터 공백 상태를 반환합니다.'),
]);

// 4쪽: AI·신뢰·근거 원장 기술
addPage([
  subHeading('1-1. 핵심 기술 ② — 하루방·Trust Engine·근거 원장'),
  table(['기술', '입력과 처리', '출력·효과'], [
    ['LLM Function Calling·RAG 하루방', '멀티턴 문맥에서 지역·일정·동행자·취향·제외 조건을 해석하고 DB·웹 검색 도구를 호출. 공식·플랫폼·경험 출처를 분류하고 근거가 부족하면 검색어를 바꿔 재시도', '확인한 원문만 비교·요약한 답변, 출처 URL, 확인 시점, 선택 이유, sufficient/partial/unavailable 연구 상태'],
    ['규칙 기반 Trust Engine', '공공데이터 확인·수정요청·사용자 조건·기상·주차·정류장·운영정보·방문 피드백·최신성을 항목별 계산. 리뷰 문장을 주장 단위로 분해·검증', '0~100 의사결정 보조 점수, 산출 근거 breakdown, 신뢰 배지, 확인 필요 항목, 확인·충돌·미확인 판정'],
    ['PostgreSQL 근거 원장', 'PlanItem·Evidence·VisitFeedback·ModerationCase·PublicDataCorrection을 연결. idempotency key로 중복 제출을 막고 승인·취소·재승인을 버전 계보로 저장', '여행 당시 출처 스냅샷, 사실/경험 분리 피드백, 원본을 덮어쓰지 않는 버전형 보정과 추적 가능한 판정 이력'],
  ], [2700, 4550, CONTENT - 7250], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('기술이 만드는 핵심 기능'),
  table(['서비스 기능', '적용 기술', '사용자가 얻는 결과'], [
    ['여행팩·지도', '공공데이터 ETL + PostgreSQL 검색 + 공간·기상 결합', '조건에 맞는 후보와 주차·정류장·날씨 주의'],
    ['하루방 상담', 'LLM Function Calling + RAG + 웹 리서치', '최신 원문과 충돌·미확인 범위가 표시된 비교 답변'],
    ['세 출처 플랜', 'PlanItem provenance snapshot', '공공데이터·웹검색·직접입력의 출처를 잃지 않는 일정'],
    ['피드백·검토', '근거 원장 + 기여 신호 + 운영자 판정', '여행 경험이 검증 가능한 보정·신규 근거 후보로 전환'],
  ], [2100, 3800, CONTENT - 5900], { firstBold: true, bodySize: 16, compact: true }),
  statusNote('현재 MVP', '하루방 검색·공공데이터 교차확인·Trust Engine·출처 보존 플랜·피드백 저장·검토 큐·버전 보정의 최소 API와 화면을 구현했습니다.', 'current'),
  statusNote('고도화 계획', '장기 증빙 보호·기여자 평판·자동 이상 탐지·기관 환류 API는 운영 검증 후 단계적으로 확장합니다.', 'future'),
]);

// 5쪽: 공공데이터 활용 적정성
addPage([
  subHeading('1-2. 공공데이터의 활용 적정성'),
  paragraph('공공데이터를 후보 목록으로 소비하지 않고, 획득·정제·결합·서비스 활용·이용 후 검증까지 이어지는 데이터 자산으로 설계했습니다.'),
  table(['공공데이터·출처', '획득·원본 내용', '정제·결합 기술', '현재 기능·지속 활용'], [
    ['비짓제주 관광정보', '관광지·음식·카페·숙박·행사, 주소·좌표·원본 ID', 'Python ETL, 카테고리·주소·좌표 정규화, 체크섬 변경 감지', '여행 후보·지도·출처 제공, 미수록·변경 장소 재확인'],
    ['비짓제주 콘텐츠 수정요청', '1,686건의 운영시간·주소·연락처·가격 등 수정 원문', '유형 분류, 장소 ID 매칭, 원문 보존', '변경 가능성 신호, 반복 오류·갱신 우선순위 분석'],
    ['제주 공영주차장', '명칭·주소·좌표·주차 정보', '좌표 정제, 장소와 1km 거리 결합', '주차 접근성 판단, 현장 접근 피드백과 교차검증'],
    ['버스정류장', '정류장 명칭·좌표·식별 정보', '중복 제거, 장소와 500m 거리 결합', '대중교통 접근성 판단, 노선·교통약자 정보로 확장'],
    ['기상청 단기예보', '여행일·권역별 강수·바람·기온 예보', '날짜·권역 매핑, 우천·강풍·폭염 위험 신호 정규화', '야외 일정 주의·대체 후보, 일정 변경 효과 측정'],
  ], [2050, 2850, 3250, CONTENT - 8150], { firstBold: true, bodySize: 14, compact: true }),
  subHeading('활용 규모와 중요성'),
  metricCards([
    { value: '4,422', label: '정제 장소' },
    { value: '1,557', label: '공영주차장' },
    { value: '4,271', label: '버스정류장' },
    { value: '556', label: '수정요청 매칭 장소' },
  ]),
  paragraph('수치는 개발 DB와 공개 CSV 분석 스냅샷 기준입니다. 운영 시 데이터마다 수집·확인 시점·유효 상태를 함께 표시하고, 원본과 파생 판단을 분리해 재계산할 수 있게 합니다.', { run: { size: 16, color: COLOR.gray } }),
  note('공공데이터는 서비스의 출발점이며, 웹 리서치와 실제 여행은 공백·충돌·변화를 찾아 다음 데이터 품질로 되돌리는 검증 수단입니다.', COLOR.paleOrange),
]);

// 6쪽: 공공데이터 라이프사이클
addPage([
  subHeading('1-2. 공공데이터 라이프사이클 — 지속 획득·가공·활용'),
  table(['단계', '적용 기술·행동', '축적되는 결과'], [
    ['1. 수집', '공개 API·CSV 수집, 원본 ID·수집 시점·원문 스냅샷 보존', '재현 가능한 원본 데이터'],
    ['2. 정규화', 'Python ETL, 장소명·주소·좌표·카테고리 정제, 체크섬 변경 감지', '검색 가능한 Place 기준 레코드'],
    ['3. 검색·판단', 'PostgreSQL 검색, 공간·기상 결합, Trust Engine 산출', '조건별 후보·신뢰 근거·확인 필요 항목'],
    ['4. 세 출처 플랜', '공공데이터 후보 + 하루방 웹검색 + 사용자 직접입력', '출처·확인 시점이 보존된 PlanItem'],
    ['5. 실제 여행', '방문·미방문·정보 불일치·경험 태그와 선택 증빙', '사실 신호와 경험 신호가 분리된 원문'],
    ['6. 재검증·판정', '독립 제보, 공식·플랫폼 원문 대조, 운영자 승인·보류·기각', '추적 가능한 Evidence·ModerationDecision'],
    ['7. 강화·확장', '원본 비파괴 PublicDataCorrection과 검증된 신규 장소 후보', '다음 답변·품질 대시보드·기관 전달 후보'],
  ], [1900, 5200, CONTENT - 7100], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('순환의 핵심'),
  note('공공데이터 → 여행 플랜 → 실제 여행 → 구조화 피드백 → 웹 재검증·운영자 판정 → 버전 보정·신규 근거 → 다음 공공데이터 활용'),
  table(['지속 가능성 원칙', '설계'], [
    ['원본 보존', '사용자 피드백과 보정이 공공데이터 원본을 직접 UPDATE하지 않음'],
    ['재계산 가능', '원본 스냅샷과 파생 신뢰 상태를 분리해 판단 기준 변경 시 다시 계산'],
    ['오염 방지', '단일 제보 자동 확정 금지, idempotency key·독립 신호·운영자 판정 적용'],
    ['공백 인정', '공공데이터 미수록을 장소 부재로 단정하지 않고 웹·직접입력 후보로 발견'],
  ], [2450, CONTENT - 2450], { firstBold: true, bodySize: 16, compact: true }),
  paragraph('여행 플랜은 공공데이터의 활용이고, 실제 여행은 공공데이터의 현실 적합성을 확인하는 검증 환경입니다.', { alignment: AlignmentType.CENTER, run: { size: 19, bold: true, color: COLOR.green } }),
]);

// 7쪽: 차별성·독창성
addPage([
  subHeading('1-3. 기존 서비스와의 차별성 및 독창성'),
  table(['비교 대상', '일반적 기능·한계', '제주를 담다의 차별 기술'], [
    ['지도·여행 플랫폼', '장소 탐색과 후기 중심, 정보의 출처 역할·변경 상태 판단은 사용자 몫', '공공데이터 상태·수정요청·접근성·기상·최신성을 Trust Engine으로 함께 설명'],
    ['일반 여행 AI', '최신 원문 확인 없이 그럴듯한 장소·운영 사실을 생성할 위험', 'LLM Function Calling·RAG로 DB·웹 도구를 호출하고 확인된 근거 밖 사실 생성을 제한'],
    ['공공데이터 포털', '원본 데이터 제공에서 실제 선택·방문 이후의 품질 환류가 단절', '플랜 스냅샷과 VisitFeedback을 연결해 이용 결과를 보정·신규 근거 후보로 축적'],
    ['후기·SNS', '분위기 경험과 휴무·주소·가격 같은 운영 사실이 혼합', 'Evidence에서 fact/experience를 분리하고 출처 역할·확인 시점·지원 상태를 저장'],
    ['단순 신고 시스템', '신고 접수와 처리 결과 사이의 근거·판정 계보가 약함', 'ModerationCase·Decision·PublicDataCorrection으로 승인·취소·재승인을 버전 이력으로 보존'],
  ], [2050, 3900, CONTENT - 5950], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('기술적 독창성 3축'),
  table(['독창성', '구현 방식', '방어 가능한 가치'], [
    ['역할 기반 멀티소스 RAG', '공공데이터·공식·플랫폼·경험 출처를 같은 사실처럼 섞지 않고 주장별 역할로 결합', '최신성·공식성·경험성을 동시에 확보하면서 출처 충돌을 숨기지 않음'],
    ['여행 시점 근거 스냅샷', '장소명뿐 아니라 출처 URL·확인 시점·선택 이유를 PlanItem에 보존', '정보가 바뀐 뒤에도 당시 판단과 실제 여행 결과를 비교 가능'],
    ['비파괴 신뢰 순환', '원본 공공데이터와 현장 신호·운영자 판정·보정 버전을 분리', '허위 제보가 원본을 오염시키지 않으면서 검증 결과는 다음 활용에 재사용'],
  ], [2450, 4500, CONTENT - 6950], { firstBold: true, bodySize: 16, compact: true }),
  statusNote('현재 MVP', 'React PWA·FastAPI·PostgreSQL 기반의 여행팩, 하루방, Trust Engine, 세 출처 플랜, 피드백·검토 흐름을 배포했습니다.', 'current'),
  metricCards([
    { value: '12/12', label: '골든셋 게이트' },
    { value: '229', label: '백엔드 자동 테스트' },
    { value: '5', label: '공공데이터·공공 API 축' },
  ]),
]);

// 8쪽: 개인 창업자의 역량과 창업 계획
addPage([
  sectionHeading('2 창업 및 사업화 계획'),
  subHeading('2-1. 개발 제품 및 서비스를 활용한 창업 계획'),
  subHeading('개인 창업자의 기술 역량과 추진 의지'),
  paragraph('신청자는 AI 엔지니어링 정규 교육과정을 모두 이수했으며 공식 수료 절차를 앞두고 있습니다. Python 기반 데이터 처리, 머신러닝, LLM·RAG 응용을 학습하고 60개 이상의 웹 서비스·프로토타입 저장소를 구축하며 기획부터 AI 기능, 웹·API, 배포까지 전 과정을 반복적으로 수행했습니다.'),
  note('학습한 기술을 과제로 끝내지 않고, 공공데이터 파이프라인·하루방 에이전트·Trust Engine·플랜·피드백 검증을 하나의 배포형 MVP로 직접 연결했습니다.', COLOR.paleOrange),
  table(['보유·학습 역량', '제주를 담다에 적용한 결과', '실행 증거'], [
    ['Python 데이터 처리·ML', '공공데이터 ETL, 정규화, 변경 신호, 좌표 접근성 계산', '4,422 장소·1,557 주차장·4,271 정류장 개발 스냅샷'],
    ['LLM·RAG·Function Calling', '하루방 검색 도구 호출, 멀티턴 문맥, 근거 조립과 주장 검증', '실제 배포 상담 흐름·골든셋 12/12'],
    ['웹·API·데이터베이스', 'React PWA, FastAPI, SQLAlchemy, PostgreSQL 근거 원장', 'Vercel/Railway 배포·백엔드 테스트 229건'],
    ['제품 기획·서비스 구현', '여행팩→플랜→실제 여행→피드백→검토의 전체 사용자 흐름', '60개 이상 웹 서비스·프로토타입 저장소 구축 경험'],
  ], [2450, 4400, CONTENT - 6850], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('개인 창업자 직접 수행과 외부 협력'),
  table(['구분', '수행 영역', '확보 방식'], [
    ['직접 수행', '제품 방향, 데이터 모델, Python ETL, AI/RAG, FastAPI, React PWA, 테스트·배포', '핵심 기술과 데이터 책임을 신청자가 일관되게 관리'],
    ['전문 검토', '개인정보·보안·법률, 증빙 보호, 인프라 운영 점검', '운영 단계에서 분야별 전문가를 프로젝트 단위로 확보'],
    ['현장·기관 협력', '제주 현장 정보 검증, 로컬 파일럿, 공공데이터 환류 협의', '사용 지표가 확보된 뒤 사업자·기관과 단계별 PoC 추진'],
  ], [2000, 4700, CONTENT - 6700], { firstBold: true, bodySize: 16, compact: true }),
  statusNote('창업 방향', '여행 서비스의 사용량으로 현장 신호를 만들고, 축적된 데이터 품질 신호를 B2B·B2G 가치로 확장합니다.', 'current'),
]);

// 9쪽: 사업화 모델과 시장 진입
addPage([
  subHeading('2-2. 개발 제품 및 서비스의 사업화 계획'),
  paragraph('초기에는 여행자가 실제로 쓰는 B2C 서비스로 공공데이터 활용·방문·피드백 순환을 검증하고, 축적된 품질 신호를 로컬 사업자와 공공기관의 업무 가치로 확장합니다.'),
  table(['시장 단계', '고객·문제', '제공 서비스', '수익·협력 가설', '검증 지표'], [
    ['B2C 무료 활용', '근거 있는 제주 계획이 필요한 여행자', '여행팩·하루방·기본 플랜·PWA·피드백', '핵심 순환의 사용성과 재방문 검증', '플랜 완성률·담기율·피드백 전환율'],
    ['B2C 고도화', '계획을 저장·공유·다시 쓰는 여행자', '공유 플랜·여행 저널·고급 비교·변경 알림', '여행 단위 패스·구독 가설', '재열람·공유·지불 의향'],
    ['B2B 품질 리포트', '잘못된 운영정보와 반복 문의가 발생하는 로컬 사업자', '변경 신호·출처 충돌·현장 확인 상태 리포트', '사업자·권역 단위 구독 가설', '정정 시간·리포트 재사용률'],
    ['B2G 데이터 품질', '오류·누락·갱신 우선순위가 필요한 기관', '반복 오류·미수록 장소·보정 후보 대시보드', '기관 PoC·운영 협력 가설', '검토 시간·반영 후보·오판율'],
  ], [1550, 2400, 3000, 2300, CONTENT - 9250], { firstBold: true, bodySize: 13, compact: true }),
  subHeading('홍보·마케팅과 시장 진입 순서'),
  table(['단계', '실행 채널', '확보하려는 행동·데이터'], [
    ['1. 발견', '아이·부모님·비 오는 날·대중교통 등 조건형 제주 콘텐츠', '공공데이터 후보가 실제 선택으로 전환되는 유입'],
    ['2. 사용', '모바일 PWA 설치, 하루방 상담, 여행팩·지도', '반복 방문·후보 비교·플랜 시작 행동'],
    ['3. 확산', '출처·선택 이유가 포함된 플랜 링크와 PDF 공유', '동행자 검토·공유 유입·실제 일정 확정'],
    ['4. 현장 검증', '여행 후 알림·간단 피드백·정보 불일치 신고', '방문 전환·현장 신호·보정 후보'],
    ['5. 파일럿', '변경이 잦은 업종·권역의 로컬 리포트와 기관 제안', '정정 효율·대시보드 수요·기관 환류 가능성'],
  ], [1500, 4300, CONTENT - 5800], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('사업화 원칙'),
  bullet('가격·매출·기관 계약을 확정된 성과로 쓰지 않고 사용자 행동과 파일럿 업무시간 절감으로 검증합니다.'),
  bullet('가입자 수보다 실제 방문 피드백이 검증을 거쳐 다음 정보에 재사용되는 비율을 핵심 지표로 봅니다.'),
  bullet('B2C는 신뢰 라이프사이클의 사용 접점이고, B2B·B2G는 축적된 데이터 품질 신호의 확장 시장입니다.'),
]);

// 10쪽: 실행 로드맵·위험·성과지표
addPage([
  subHeading('2-2. 단계별 실행 가능성과 성과 검증'),
  table(['단계', '기술·사업 고도화', '완료 기준'], [
    ['현재 MVP', '공공데이터·하루방·직접입력 플랜, Trust Engine, 피드백·검토 최소 흐름', '플랜 생성부터 피드백까지 반복 시연'],
    ['1단계 운영 기반', '회원·권한·장기 저장·기기 동기화·오류 복구', '사용자별 데이터 격리·복구 절차 검증'],
    ['2단계 신뢰 원장', '증빙 보호·기여자 신뢰·이상 제출·반복 제보 분류', '원문을 잃지 않고 검토 우선순위 계산'],
    ['3단계 검증 순환', '웹 재검증·승인·취소·보정 버전·캐시 무효화', '승인 보정이 다음 답변에 추적 가능하게 반영'],
    ['4단계 데이터 사업', '검증된 신규 장소·품질 대시보드·기관 전달 API', '갱신 우선순위·신규 근거가 외부 업무에 재사용'],
  ], [1800, 5650, CONTENT - 7450], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('주요 위험과 대응'),
  table(['위험', '대응 기술·운영 원칙'], [
    ['허위·이해관계 제보', '단일 제보 자동 확정 금지, idempotency key, 독립 신호·웹 근거·운영자 판정'],
    ['개인정보·증빙', '선택 제출·비공개 저장·자동 가림·삭제 절차를 운영 단계에서 전문 검토 후 도입'],
    ['외부 API 장애', 'timeout·제한 재시도·오류 분류·제한 상태·지도/날씨/LLM fallback'],
    ['개인 운영 과부하', '중요 주장 우선 검토, 자동 분류, 보안·법률·현장·기관 전문성 단계별 확보'],
  ], [2500, CONTENT - 2500], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('핵심 성과지표와 기대효과'),
  table(['영역', '성과지표', '기대효과'], [
    ['공공데이터 활용', '세 출처 혼합 플랜 비율·플랜 완성률', '공공데이터가 실제 선택과 일정으로 전환'],
    ['현장 검증', '저장 플랜의 방문·피드백 전환율', '낡거나 충돌하는 정보의 현장 신호 확보'],
    ['신뢰 품질', '독립 제보 일치율·검토 시간·승인 취소율', '잘못된 보정을 막으면서 검토 효율 향상'],
    ['데이터 환류', '승인 보정 재사용 횟수·기관 전달 후보', '오류·누락·갱신 우선순위를 근거와 함께 제공'],
    ['사업성', '반복 사용·지불 의향·파일럿 재사용 의향', '여행 서비스에서 데이터 품질 사업으로 확장 가능성 검증'],
  ], [1900, 3900, CONTENT - 5800], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('결론'),
  note('여행 플랜은 공공데이터의 활용이고, 실제 여행은 공공데이터의 검증입니다. 검증된 결과를 다시 데이터로 축적하는 것이 제주를 담다의 기술이자 사업 모델입니다.', COLOR.paleOrange),
]);

const document = new Document({
  creator: 'Pack Your Jeju',
  title: '2026 제주 공공데이터·AI 활용 창업경진대회 공공데이터 라이프사이클 사업계획서',
  description: '제주를 담다 공공데이터 활용·여행·피드백·검증·보정 라이프사이클 사업계획서',
  styles: {
    default: {
      document: {
        run: { font: 'Malgun Gothic', size: 19, color: COLOR.ink },
        paragraph: { spacing: { line: 255 } },
      },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Malgun Gothic', size: 29, bold: true, color: COLOR.green },
        paragraph: { spacing: { before: 80, after: 140 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Malgun Gothic', size: 23, bold: true, color: COLOR.ink },
        paragraph: { spacing: { before: 130, after: 85 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [{
      reference: 'business-bullets',
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 420, hanging: 220 } } },
        },
        {
          level: 1,
          format: LevelFormat.BULLET,
          text: '–',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 740, hanging: 220 } } },
        },
      ],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: A4,
        margin: MARGIN,
      },
    },
    footers: { default: footer() },
    children: pages,
  }],
});

Packer.toBuffer(document).then((buffer) => {
  fs.writeFileSync(OUT_FILE, buffer);
  console.log(OUT_FILE);
});

