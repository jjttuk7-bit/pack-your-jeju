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
      spacing: { before: 160, after: 160 },
      keepNext: true,
      children: [run(text, { size: 40, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      keepNext: true,
      children: [run(subtitle, { size: 22, bold: true, color: COLOR.orange })],
    }),
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

// 1쪽: 표지와 핵심 정의
addPage([
  ...title('사 업 계 획 서', '공공데이터 라이프사이클 중심 개정본 · 제품·서비스 개발 부문'),
  table(['항목', '제출 내용'], [
    ['아이템명', '제주를 담다 (Pack Your Jeju)'],
    ['아이템 소개', '여행으로 검증하고 다시 강화하는 제주 공공데이터'],
    ['제품·서비스', '공공데이터 활용·여행·현장 피드백·검증·보정을 연결하는 신뢰 라이프사이클 플랫폼'],
    ['신청 주체', '개인 1인 창업자'],
    ['작성 기준일', '2026년 7월 15일'],
  ], [2100, CONTENT - 2100], { firstBold: true, bodySize: 18 }),
  linkParagraph('시제품', 'https://pack-your-jeju.vercel.app'),
  subHeading('사업의 중심'),
  note('여행 플랜은 최종 목적이 아니라 공공데이터가 실제 선택과 방문을 거쳐 다시 검증되는 한 사이클입니다.'),
  subHeading('한 문장 정의'),
  paragraph('제주를 담다는 공공데이터 후보, 하루방 웹검색 추천, 사용자 직접입력으로 여행 플랜을 만들고, 실제 여행의 피드백을 근거 원장과 운영자 검토를 거친 버전형 보정·신규 근거 데이터로 축적하여 다음 공공데이터 활용의 신뢰성과 범위를 높입니다.'),
  statusNote('현재 MVP', '세 가지 플랜 경로와 방문 피드백·검토 흐름의 최소 기능을 배포형 웹으로 구현했습니다.', 'current'),
  statusNote('고도화 계획', '회원·증빙 보호·기여자 신뢰·기관 환류까지 단계적으로 확장합니다.', 'future'),
]);

// 2쪽: 문제와 기회
addPage([
  sectionHeading('1 개발 서비스 개요'),
  subHeading('1-1. 문제 정의 — 공공데이터는 이용 이후가 보이지 않는다'),
  paragraph('제주 공공데이터는 관광지·행사·교통·날씨 같은 여행의 기본 근거를 제공하지만, 실제 이용자가 어떤 데이터를 선택했고 현장에서 무엇이 달랐는지 다시 데이터 품질 개선으로 연결하는 통로는 제한적입니다.'),
  table(['단절 지점', '현재 문제', '필요한 전환'], [
    ['활용 전', '데이터셋과 웹 정보가 흩어져 여행 조건에 맞게 비교하기 어려움', '공공데이터를 일정·동행자·취향에 맞는 선택 근거로 변환'],
    ['활용 중', '미수록·변경·충돌 정보를 사용자가 직접 다시 검색해야 함', '하루방 검색과 사용자 입력으로 공백을 보강하되 출처를 보존'],
    ['활용 후', '실제 방문 결과와 정보 차이가 다음 데이터에 누적되지 않음', '피드백을 검증 가능한 현장 신호와 보정 후보로 환류'],
  ], [1650, 3950, CONTENT - 5600], { firstBold: true, bodySize: 17 }),
  subHeading('핵심 해결 원칙'),
  table(['원칙', '설계'], [
    ['원본 보존', '공공데이터 원본·웹 근거·사용자 경험·운영자 판정을 서로 덮어쓰지 않고 이력으로 저장'],
    ['출처 분리', '공공데이터 후보·하루방 웹검색·사용자 직접입력의 출처와 확인 시점을 끝까지 유지'],
    ['검증 후 환류', '단일 제보를 사실로 확정하지 않고 반복성·독립성·웹 재확인·운영자 검토를 거침'],
    ['설명 가능한 선택', '추천 개수보다 왜 선택했는지, 무엇을 확인해야 하는지, 어떤 근거가 있는지를 제시'],
  ], [2250, CONTENT - 2250], { firstBold: true, bodySize: 17 }),
  subHeading('공공데이터 경진대회 관점의 가치'),
  note('공공데이터를 소비하는 앱에서, 이용 결과가 공공데이터의 최신성·신뢰성·포괄성을 강화하는 운영 모델로 확장합니다.', COLOR.paleOrange),
]);

// 3쪽: 전체 라이프사이클
addPage([
  subHeading('1-1. 핵심 모델 — 제주 공공데이터 라이프사이클'),
  paragraph('각 단계의 산출물이 다음 단계의 근거가 되며, 마지막 검증 결과가 다시 첫 단계의 데이터 품질로 돌아옵니다.'),
  table(['단계', '입력·행동', '남는 데이터'], [
    ['1. 공공데이터 수집', '비짓제주·수정요청·주차·정류장·기상 데이터 수집', '원본 스냅샷·수집 시점·원본 ID'],
    ['2. 정규화·신뢰 상태', '주소·좌표·카테고리 정규화와 변경·충돌 신호 계산', '장소 기준 레코드·확인 필요 상태'],
    ['3. 세 가지 플랜', '공공데이터 후보 + 하루방 웹검색 + 사용자 직접입력', '출처가 보존된 PlanItem 스냅샷'],
    ['4. 실제 여행', '사용자가 선택한 장소를 방문하거나 방문하지 못한 결과', '선택과 현장 결과의 연결'],
    ['5. 구조화 피드백', '방문·운영·주소·가격 불일치와 경험 평가, 선택 증빙', '사실 신호와 경험 신호가 분리된 원문'],
    ['6. 검증·판정', '독립 제보·웹 원문·이상 제출·운영자 검토', '승인·보류·기각 및 판정 버전'],
    ['7. 데이터 강화', '승인된 보정과 검증된 신규 장소 후보를 다음 조회에 반영', '버전형 보정·신규 근거 데이터·기관 전달 후보'],
  ], [2100, 5000, CONTENT - 7100], { firstBold: true, compact: true, bodySize: 16 }),
  subHeading('순환의 핵심 연결'),
  note('공공데이터 → 여행 플랜 → 실제 여행 → 피드백 → 검증 → 공공데이터 강화·확장 → 다음 여행 플랜'),
  paragraph('이 구조에서 여행 플랜은 공공데이터를 활용하는 접점이고, 실제 여행은 데이터의 현실 적합성을 확인하는 검증 환경이며, 피드백은 다음 데이터 품질을 높이는 시작점입니다.', { run: { size: 18, color: COLOR.gray } }),
]);

// 4쪽: 세 가지 플랜 경로
addPage([
  subHeading('1-1. 세 가지 플랜 생성 경로와 통합 근거 구조'),
  table(['플랜 경로', '무엇을 제공하는가', '반드시 보존하는 근거', '데이터 확장 기여'], [
    ['1. 공공데이터 후보', '공식 장소·행사·접근성·기상 기반의 기본 후보', '데이터셋·원본 ID·수집 시점·주소·좌표', '오류·변경·누락 가능성 발견'],
    ['2. 하루방 웹검색', '최신 공식·플랫폼·경험 원문을 비교한 추천', '출처 URL·출처 역할·확인 시점·선택 이유', '공공데이터 미수록·충돌 정보 발견'],
    ['3. 사용자 직접입력', '사용자가 알고 있거나 실제 가고 싶은 장소', '입력 원문·주소·좌표·존재·중복 확인 상태', '검증 후 신규 장소·별칭 후보 축적'],
  ], [2050, 3250, 3200, CONTENT - 8500], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('하나의 플랜, 서로 다른 출처'),
  note('세 경로는 같은 PlanItem으로 담되 출처를 합치거나 지우지 않습니다. 이름·주소·좌표·출처·확인 시점·선택 이유를 여행 당시 스냅샷으로 보존합니다.'),
  table(['통합 항목', '역할'], [
    ['Place', '여러 출처에서 발견한 동일 장소를 묶는 기준 레코드'],
    ['PlanItem', '사용자가 선택한 장소와 당시 근거·출처를 보존'],
    ['Evidence', '장소의 특정 주장과 이를 지지·충돌시키는 원문을 연결'],
    ['VisitFeedback', '실제 여행에서 발생한 사실 변경과 경험 평가를 기록'],
    ['PublicDataCorrection', '공공데이터 원본을 보존한 채 승인된 보정을 버전으로 제공'],
  ], [2550, CONTENT - 2550], { firstBold: true, bodySize: 17, compact: true }),
  subHeading('하루방의 역할'),
  paragraph('하루방은 공공데이터를 대체하는 추천기가 아니라, 웹 원문을 조사해 공백과 충돌을 찾고 공공데이터와 함께 비교 가능한 근거로 조립하는 리서치 에이전트입니다.'),
]);

// 5쪽: 공공데이터 활용
addPage([
  subHeading('1-2. 공공데이터 활용 적정성 — 원본에서 판단 근거까지'),
  table(['공공데이터', '가공', '현재 MVP 활용', '라이프사이클 확장'], [
    ['비짓제주 관광정보', '카테고리·주소·좌표 정규화, 체크섬 변경 감지', '관광·음식·카페·숙박·행사 후보', '미수록·변경 장소와 보정 후보 연결'],
    ['콘텐츠 수정요청', '1,686건 유형 분석, 장소 ID 매칭, 원문 보존', '폐업·이전·주소·운영 변경 재확인 신호', '반복 변경 유형과 갱신 우선순위 분석'],
    ['공영주차장', '좌표·명칭 정규화', '장소 반경 1km 내 주차 접근성', '변경 시점과 현장 접근 피드백 결합'],
    ['버스정류장', '좌표 정제·중복 제거', '장소 반경 500m 내 정류장 존재', '노선·도착·교통약자 접근성으로 확장'],
    ['기상청 예보', '여행일·권역별 위험 신호 정규화', '우천·강풍·폭염 주의와 대체 순간', '위험별 일정 변경 효과 측정'],
  ], [1900, 3100, 3100, CONTENT - 8100], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('개발 데이터 스냅샷'),
  metricCards([
    { value: '4,422', label: '정제 장소' },
    { value: '1,557', label: '공영주차장' },
    { value: '4,271', label: '버스정류장' },
    { value: '556', label: '수정요청 매칭 장소' },
  ]),
  paragraph('수치는 개발 DB와 공개 CSV 분석 스냅샷 기준입니다. 운영 시에는 데이터마다 수집·확인 시점과 유효 상태를 함께 표시합니다.', { run: { size: 16, color: COLOR.gray } }),
  subHeading('지속 가능한 가공 원칙'),
  bullet('원본 스냅샷과 파생 신뢰 상태를 분리해 언제든 판단을 재계산할 수 있게 합니다.'),
  bullet('공공데이터 미수록을 현실 세계의 장소 부재로 단정하지 않습니다.'),
  bullet('웹·현장 피드백은 공공데이터를 덮어쓰지 않고 별도 근거와 버전형 보정으로 축적합니다.'),
]);

// 6쪽: 신뢰 피드백 설계
addPage([
  subHeading('1-2. 피드백을 신뢰 있는 데이터로 축적하는 설계'),
  paragraph('피드백 총량이 아니라 누가 어떤 플랜을 실제로 이용했고, 무엇이 사실과 달랐으며, 서로 독립된 근거가 이를 지지하는지를 확인합니다.'),
  table(['검증 단계', '처리 내용', '자동 확정 여부'], [
    ['1. 원문 보존', '플랜 스냅샷과 방문 결과·자유 메모를 변경 불가능한 사건으로 저장', '확정 아님'],
    ['2. 신호 분리', '휴무·폐업·주소·운영시간 같은 사실과 혼잡·분위기 같은 경험을 분리', '확정 아님'],
    ['3. 선택 증빙', '위치·사진은 선택 제출, 개인정보 제거와 비공개 보관을 적용', '검토 우선순위만 반영'],
    ['4. 기여 신뢰', '플랜 포함 여부·정상 활동·독립 제보·반복 복사·이상 위치를 평가', '가중치만 반영'],
    ['5. 웹 재검증', '공식·플랫폼 원문과 공공데이터 값을 주장 단위로 대조', '충돌 시 추가 확인'],
    ['6. 운영자 검토', '승인·보류·기각·취소를 판단 근거와 함께 기록', '사람의 최종 판정'],
    ['7. 환류', '승인 보정만 다음 하루방 답변과 기관용 품질 후보에 반영', '버전형 보정 생성'],
  ], [2100, 5900, CONTENT - 8000], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('근거 원장 원칙'),
  note('공공데이터 원본 + 공식·플랫폼 웹 근거 + 사용자 현장 신호 + 운영자 판정 = 현재 표시 정보'),
  table(['보호 장치', '정책'], [
    ['허위·이해관계 제보', '단일 제보 자동 확정 금지, 독립성·증빙·공식 원문을 함께 검토'],
    ['개인정보', '선택 제출, EXIF 제거, 자동 가림, 최소 권한, 삭제·비식별화는 고도화 계획'],
    ['판정 오류', '승인·취소·재승인을 버전 계보로 남기고 과거 값을 자동 복원하지 않음'],
  ], [2500, CONTENT - 2500], { firstBold: true, bodySize: 16, compact: true }),
]);

// 7쪽: MVP와 기술적 우수성
addPage([
  subHeading('1-3. 현재 MVP 구현 범위와 기술적 우수성'),
  statusNote('현재 MVP', '전체 상용 운영이 아니라 세 가지 플랜 경로와 신뢰 순환 가능성을 검증하는 최소 구현 수준입니다.', 'current'),
  table(['MVP 기능', '구현 범위', '검증하려는 가설'], [
    ['공공데이터 여행팩', '조건별 후보·신뢰 배지·주차·정류장·날씨 신호 비교', '공공데이터가 실제 선택 근거가 되는가'],
    ['하루방 에이전트', '웹 원문 검색·출처 역할·후속 문맥·공공데이터 교차확인', '최신 공백을 근거 있게 보강할 수 있는가'],
    ['세 출처 플랜', '공공데이터·하루방 웹검색·사용자 직접입력 장소를 출처별로 담기', '서로 다른 출처를 한 플랜에서 비교할 수 있는가'],
    ['피드백·검토 흐름', '방문 결과·불일치·메모·검토 큐의 최소 API와 화면', '여행 경험이 다음 데이터 개선 신호가 되는가'],
    ['배포·검증', 'Vercel 웹, FastAPI, PostgreSQL, 자동 테스트', '실제 사용 흐름을 반복 시연할 수 있는가'],
  ], [2200, 4800, CONTENT - 7000], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('현재 MVP의 의도적 한계'),
  statusNote('고도화 계획', '운영 인증·장기 저장·증빙 보안·기여자 신뢰·기관 연계는 현재 완료 기능으로 주장하지 않습니다.', 'future'),
  subHeading('모방하기 어려운 핵심'),
  bullet('출처 역할·확인 시점·지원·충돌을 주장 가까이에 연결하는 근거 계약'),
  bullet('세 플랜 경로와 실제 방문을 이어 주는 근거 스냅샷'),
  bullet('공공데이터 원본을 보존하면서 승인 보정을 버전으로 쌓는 신뢰 순환 정책'),
  metricCards([
    { value: '12/12', label: '골든셋 게이트' },
    { value: '229', label: '백엔드 자동 테스트' },
    { value: '10p', label: '제출 규격' },
  ]),
]);

// 8쪽: 고도화 로드맵
addPage([
  sectionHeading('2 창업 및 사업화 계획'),
  subHeading('2-1. 단계별 고도화·확장 로드맵'),
  table(['단계', '고도화 계획', '완료 기준'], [
    ['MVP 검증', '세 출처 플랜·방문 피드백·검토 흐름, 사용자 시나리오 검증', '플랜 완성→실제 방문→피드백 전환이 측정됨'],
    ['1단계 운영 기반', '회원·권한·장기 저장·기기 동기화·오류 복구', '사용자별 데이터 격리와 복구 절차 검증'],
    ['2단계 신뢰 원장', '선택 증빙 보호·기여자 신뢰·이상 제출·반복 제보 분류', '피드백 원문을 잃지 않고 검토 우선순위 계산'],
    ['3단계 검증 순환', '웹 재검증·승인·보류·기각·취소·보정 버전·캐시 무효화', '승인 보정이 다음 답변에 추적 가능하게 반영'],
    ['4단계 데이터 확장', '검증된 직접입력 장소·품질 대시보드·기관 전달 후보', '신규 근거 데이터와 갱신 우선순위가 재사용됨'],
  ], [1900, 5600, CONTENT - 7500], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('확장 가능한 데이터 모델'),
  table(['확장 축', '발전 방향'], [
    ['범위', '관광 장소에서 축제·교통·기상·무장애·지역 소비 데이터로 확대'],
    ['지역', '제주에서 검증한 출처 어댑터와 신뢰 정책을 다른 관광 지역에 적용'],
    ['고객', '여행자용 플랜에서 로컬 사업자 신뢰 리포트와 기관 품질 대시보드로 확대'],
    ['지식 구조', '근거 원장이 축적된 뒤 장소·주장·출처 관계를 지식 그래프로 고도화'],
  ], [2200, CONTENT - 2200], { firstBold: true, bodySize: 17 }),
  subHeading('주요 위험과 대응'),
  table(['위험', '대응'], [
    ['허위 제보', '단일 제보 자동 확정 금지, 독립 제보·웹 근거·운영자 판정'],
    ['개인정보', '선택 제출·비공개 저장·자동 가림·삭제 절차를 단계별 도입'],
    ['1인 운영 과부하', '중요 주장 우선 검토, 자동 분류, 외부 전문가·기관 파일럿을 단계적으로 확보'],
  ], [2800, CONTENT - 2800], { firstBold: true, bodySize: 16, compact: true }),
]);

// 9쪽: 사업화 모델
addPage([
  subHeading('2-2. 사업화 계획 — 활용 서비스에서 데이터 품질 사업으로'),
  table(['시장 단계', '제공 가치', '수익·협력 가설', '검증 지표'], [
    ['1. B2C 활용', '무료 여행팩·하루방·기본 플랜·피드백', '핵심 순환의 사용성과 재방문 검증', '플랜 완성률·담기율·피드백 전환율'],
    ['2. B2C 고도화', '공유 플랜·여행 저널·고급 비교·알림', '여행 단위 패스 또는 구독 가설', '재열람·공유·지불 의향'],
    ['3. B2B 품질 리포트', '장소별 변경 신호·출처 충돌·현장 확인 상태', '로컬 사업자·권역 단위 구독 가설', '정정 시간·리포트 재사용률'],
    ['4. B2G 데이터 품질', '누락·반복 오류·갱신 우선순위·보정 후보', '기관 협력 제안·PoC·운영 계약 가설', '검토 시간·반영 후보·오판율'],
  ], [1850, 3650, 3000, CONTENT - 8500], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('시장 진입 순서'),
  table(['채널', '실행', '라이프사이클 기여'], [
    ['조건형 여행 콘텐츠', '아이·부모님·비 오는 날·대중교통 제주 플랜 사례', '공공데이터가 선택으로 전환되는 사용량 확보'],
    ['플랜 공유', '출처와 선택 이유가 포함된 링크·PDF', '동행자 검토와 실제 방문 연결'],
    ['로컬 파일럿', '변경이 잦은 업종·권역의 정정 신호 검증', '피드백 처리 효용과 리포트 수요 확인'],
    ['기관 제안', '비식별 오류·누락·반복 제보와 근거 URL 제공', '공공데이터 갱신 우선순위 PoC'],
  ], [2000, 4650, CONTENT - 6650], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('사업화 원칙'),
  bullet('가격·매출·기관 계약은 확정하지 않고 사용자 행동과 파일럿 업무시간 절감으로 검증합니다.'),
  bullet('가입자 수보다 실제 방문 피드백이 검증을 거쳐 다음 데이터에 사용되는 비율을 핵심으로 봅니다.'),
  bullet('B2C는 데이터 신뢰 순환을 작동시키는 사용 접점이고, B2B·B2G는 축적된 품질 신호의 확장 시장입니다.'),
]);

// 10쪽: 개인 실행과 성과
addPage([
  subHeading('개인 1인 창업자의 실행 전략·성과지표·기대효과'),
  paragraph('초기에는 핵심 순환을 직접 설계·개발·검증하고, 개인정보·법률·기관 데이터 협력이 필요한 단계부터 외부 전문성과 파트너를 프로젝트 단위로 확보합니다.'),
  table(['실행 단계', '1인 창업자 직접 수행', '외부 협력 확보 시점'], [
    ['MVP·사용성', '제품 기획, 공공데이터 정규화, 하루방, 웹·API, 사용자 테스트', '필요 시 UX 인터뷰 참여자와 로컬 검증 협력'],
    ['운영 기반', '도메인 모델·API 계약·관측 지표·우선순위 관리', '보안·개인정보 검토, 인프라 점검'],
    ['신뢰 검증', '검토 정책·근거 비교 화면·오판 지표 운영', '지역 전문가·사업자·기관 실무자 파일럿'],
    ['사업 확장', '제품 방향·데이터 품질 리포트·파트너 제안', '영업·법무·기관 협력은 성과 기반으로 보강'],
  ], [1900, 4750, CONTENT - 6650], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('핵심 성과지표'),
  table(['영역', '지표', '확인 질문'], [
    ['활용', '세 출처 혼합 플랜 비율·플랜 완성률', '공공데이터가 실제 선택에 쓰였는가'],
    ['현장', '저장 플랜의 방문 피드백 전환율', '계획이 실제 여행과 연결됐는가'],
    ['신뢰', '독립 제보 일치율·검토 시간·승인 취소율', '빠르면서도 잘못된 보정을 막았는가'],
    ['환류', '승인 보정의 다음 답변 사용 횟수·기관 전달 후보', '현장 근거가 데이터 개선에 재사용됐는가'],
    ['사업', '반복 사용·지불 의향·파일럿 재계약 의향', '지속적으로 비용을 지불할 문제인가'],
  ], [1700, 4300, CONTENT - 6000], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('기대효과'),
  table(['대상', '효과'], [
    ['여행자', '낡거나 충돌하는 정보로 인한 헛걸음을 줄이고 선택 근거를 공유'],
    ['제주 지역', '다양한 권역과 신규 장소가 근거를 갖고 발견되는 구조 마련'],
    ['로컬 사업자', '잘못된 운영정보와 반복 문의를 조기에 발견'],
    ['공공기관', '현장 근거가 연결된 오류·누락·갱신 우선순위 후보 확보'],
  ], [2200, CONTENT - 2200], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('결론'),
  note('플랜을 만드는 것은 활용이고, 여행을 검증 가능한 데이터로 되돌려 제주 공공데이터를 강화·확장하는 것이 사업의 핵심입니다.', COLOR.paleOrange),
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

