const fs = require('fs');
const path = require('path');
const {
  AlignmentType,
  BorderStyle,
  Document,
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
const OUT_FILE = path.join(OUT, '04_제주를담다_최종_사업계획서.docx');
fs.mkdirSync(OUT, { recursive: true });

const COLOR = {
  green: '174E45',
  green2: '2E6B60',
  orange: 'E96638',
  ink: '202522',
  gray: '66706B',
  pale: 'EEF5F1',
  paleOrange: 'FFF3EB',
  line: 'B8C6C0',
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

// 1쪽: 표지와 요약
addPage([
  ...title('사 업 계 획 서', '제품·서비스 개발 부문'),
  table(['항목', '제출 내용'], [
    ['아이템명', '제주를 담다 (Pack Your Jeju)'],
    ['아이템 소개', '근거로 계획하는 제주 AI 여행'],
    ['제품·서비스', '공공데이터·웹 근거·AI를 연결하는 제주 여행 의사결정 서비스'],
    ['시제품 URL', 'https://pack-your-jeju.vercel.app'],
    ['작성 기준일', '2026년 7월 15일'],
  ], [2150, CONTENT - 2150], { firstBold: true, bodySize: 18 }),
  subHeading('한 문장 정의'),
  note('여행자가 제주에서 무엇을 선택할지 결정하도록, 하루방이 웹 원문을 조사하고 제주 공공데이터를 마지막에 교차확인하며 실제 방문 피드백을 다음 선택의 근거로 축적합니다.'),
  subHeading('제품의 핵심 경쟁력'),
  table(['충분한 조사', '근거가 보이는 선택', '여행 후 더 좋아지는 정보'], [[
    '검색어와 출처 유형을 바꿔 공식·플랫폼·경험 원문을 확인',
    '출처 역할·확인 시점·충돌·공공데이터 일치 여부를 주장 가까이에 표시',
    '방문 피드백을 원본과 분리해 근거 원장과 운영자 검토로 연결',
  ]], [Math.floor(CONTENT / 3), Math.floor(CONTENT / 3), CONTENT - Math.floor(CONTENT / 3) * 2], { bodySize: 17 }),
  subHeading('제출 문서의 사실 구분'),
  paragraph('현재 시제품에서 동작하는 기능은 “현재 구현”으로, 인증·기관 협력·유료화 등은 “고도화 계획”으로 구분했습니다. 대표자와 팀원 정보는 개인정보 수령 후 신청서에 별도 입력합니다.', { run: { size: 18, color: COLOR.gray } }),
]);

// 2쪽: 1-1 문제와 해결
addPage([
  sectionHeading('1 개발 서비스 개요'),
  subHeading('1-1. 개발 서비스의 기능 및 특징 — 문제와 해결'),
  paragraph('제주 여행 정보의 문제는 장소가 부족한 것이 아니라, 정보가 여러 채널에 흩어져 있고 어떤 정보가 지금도 유효한지 판단하기 어렵다는 데 있습니다. 지도는 검색과 길찾기에 강하고, 리뷰는 경험을 제공하며, 관광 포털은 공식 정보를 제공하지만 여행자의 일정·동행자·취향을 한 번에 비교해 주지는 않습니다.'),
  table(['여행 단계', '사용자 문제', '제주를 담다의 해결'], [
    ['여행 전', '공식 정보·지도·리뷰를 오가며 후보를 직접 비교해야 함', '지역·기간·동행자·여행 순간을 바탕으로 비교 가능한 플랜 구성'],
    ['여행 중', '운영시간·휴무·접근성처럼 변하는 정보를 다시 확인해야 함', '하루방이 최신 웹 원문을 조사하고 출처 역할·확인 시점을 함께 제시'],
    ['여행 후', '현장에서 발견한 정보 차이가 다음 여행자에게 연결되지 않음', '방문 피드백을 별도 현장 신호로 저장하고 검토·보정 흐름으로 연결'],
  ], [1500, 3650, CONTENT - 5150], { firstBold: true, bodySize: 17 }),
  subHeading('해결 원칙'),
  bullet('충분히 조사한다: 추천·운영정보 질문은 웹 리서치를 기본 경로로 사용하고, 결과가 빈약하면 검색어와 출처 유형을 바꿔 재검색합니다.'),
  bullet('사실을 만들지 않는다: 장소명·주소·운영시간·가격 등은 확인한 웹 원문 또는 내부 데이터에 근거하며 추론을 사실과 구분합니다.'),
  bullet('불확실성을 숨기지 않는다: 검색 상태를 충분·부분·충돌·이용 불가로 나누고 공공데이터 미수록을 장소 부재로 단정하지 않습니다.'),
  bullet('선택을 돕는다: 후보 수보다 직접 결론, 후보별 이유, 비교 기준, 주의점과 출처를 중심으로 답합니다.'),
  subHeading('핵심 사용자'),
  paragraph('처음 제주를 방문하는 여행자, 아이·부모님과 이동 부담을 고려해야 하는 가족, 짧은 기간에 취향별 후보를 비교하려는 커플·친구 여행자가 1차 사용자입니다.'),
]);

// 3쪽: 현재 기능
addPage([
  subHeading('1-1. 개발 서비스의 기능 및 특징 — 현재 시제품'),
  table(['기능', '현재 구현 내용', '사용자 가치'], [
    ['여행 조건 입력', '제주 12권역, 일정, 동행자, 목적과 오름·바다·맛집·카페·숙박·행사 등 12개 순간 선택', '질문을 검색 가능한 조건으로 구조화'],
    ['신뢰 여행팩', '비짓제주 후보와 수정요청·날씨·주차장·정류장 신호를 카드와 지도에서 비교', '확인된 내용과 확인 필요 항목을 구분'],
    ['후보 더 보기', '최초 비교 후보 이후 전체 개수와 cursor 기반 추가 후보 제공', '고정된 소수 추천에 갇히지 않음'],
    ['하루방 상담', '웹 리서치, 출처 역할 평가, 후속 질문 문맥 유지, 공공데이터 교차확인', '짧은 후속 질문도 이전 조건을 이어서 답변'],
    ['웹 후보 담기', '하루방이 찾은 웹 후보를 출처와 함께 여행 플랜에 추가', '공공데이터 미수록 후보도 근거가 있으면 선택 가능'],
    ['플랜·PDF', '공공데이터·웹검색·직접입력 장소를 출처가 보존된 항목으로 저장·삭제하고 PDF 생성', '선택 이유와 당시 근거를 다시 확인'],
    ['방문 피드백', '방문 여부·정보 불일치·메모와 선택 증빙을 원본과 분리 저장', '현장 경험을 다음 품질 개선 신호로 전환'],
    ['운영자 검토', '반복 제보·출처 충돌을 검토 큐에서 확인하고 보정 승인·취소 이력 관리', '허위·단일 제보가 곧바로 사실이 되는 것을 방지'],
  ], [1850, 5200, CONTENT - 7050], { firstBold: true, compact: true, bodySize: 16 }),
  subHeading('사용 흐름'),
  note('조건 선택 → 후보 비교 → 하루방 추가 조사 → 플랜 담기·저장 → 실제 방문 → 피드백 → 운영자 검토 → 다음 답변의 근거 개선'),
  subHeading('운영 안전장치'),
  bullet('AI·검색·데이터베이스 중 일부가 실패해도 실패 원인과 제한 상태를 구분하며, 웹 검색 실패를 내부 후보 목록으로 조용히 대체하지 않습니다.'),
  bullet('플랜 항목에는 장소명·주소·좌표·출처 URL·확인 시점·선택 이유의 스냅샷을 남겨 당시 판단 근거를 복원할 수 있게 합니다.'),
]);

// 4쪽: 하루방과 신뢰 구조
addPage([
  subHeading('1-1. 하루방 AI의 역할과 기술적 우수성'),
  paragraph('하루방은 정답을 기억에서 생성하는 일반 챗봇이 아니라, 질문에 필요한 근거를 계획·수집·평가하고 비교 가능한 답으로 조립하는 제주 여행 리서치 에이전트입니다.'),
  table(['단계', '처리 방식', '품질 통제'], [
    ['1. 문맥 해석', '지역·일정·동행자·취향·기존 후보·제외 조건을 대화에서 추출', '“오름은?”, “그중 한 곳”도 직전 조건을 이어받음'],
    ['2. 검색 계획', '질문 유형에 맞춰 검색어·지역 표현·출처 유형을 확장', '한 번의 빈약한 검색으로 종료하지 않음'],
    ['3. 원문 확인', '공식·플랫폼·경험 출처의 원문에서 핵심 주장 확인', '검색 결과 제목·요약만으로 답하지 않음'],
    ['4. 근거 평가', '최신성·출처 역할·주장 일치·충돌 여부를 구조화', '운영 사실은 최신 공식 출처를 우선'],
    ['5. 답변 조립', '결론·이유·비교·주의점·출처를 사용자 조건에 맞게 구성', '근거 밖 장소와 사실을 추가하지 않음'],
    ['6. 교차확인', '선택 지역 내부 공공데이터의 일치·불일치·미확인 표시', '공공데이터는 답변을 제한하지 않고 마지막 보조 근거로 사용'],
  ], [1500, 4300, CONTENT - 5800], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('출처의 역할 구분'),
  table(['공식', '플랫폼', '경험', '내부 공공데이터'], [[
    '지자체·공공기관·장소 공식 채널: 주소, 운영시간, 휴무, 요금, 예약',
    '지도·예약·지역 매체: 위치, 영업 상태, 메뉴, 대중적 반응 보완',
    '블로그·영상·SNS·리뷰: 분위기, 혼잡 체감, 동행자 적합성',
    '장소 존재·분류·주소·접근성의 마지막 교차확인',
  ]], [2600, 2600, 2600, CONTENT - 7800], { bodySize: 15, compact: true }),
  subHeading('검증 현황'),
  metricCards([
    { value: '12/12', label: '골든셋 게이트 통과' },
    { value: '1.00', label: '검증·fallback·배지 지표' },
    { value: '229', label: '백엔드 자동 테스트 통과' },
  ]),
  paragraph('검증 기준: 골든셋은 2026-07-10 실행 보고서, 자동 테스트는 2026-07-15 격리 작업공간 기준입니다.', { run: { size: 16, color: COLOR.gray } }),
]);

// 5쪽: 공공데이터
addPage([
  subHeading('1-2. 공공데이터 활용 적정성'),
  paragraph('제주 공공데이터는 후보를 제한하는 단일 추천 풀이 아니라, 장소의 기본 정체성·정보 변경 가능성·이동 접근성·기상 위험을 검증하는 근거 계층으로 사용합니다.'),
  table(['데이터', '획득·가공', '서비스 활용', '지속 활용'], [
    ['비짓제주 관광정보', 'API 수집 → 카테고리·주소·좌표 정규화 → 체크섬 기반 변경 감지', '관광지·음식·카페·숙박·축제·쇼핑·문화 후보와 원출처', '증분 재수집과 유효기간·삭제 상태 관리'],
    ['콘텐츠 수정요청', '공개 CSV 1,686건 유형 분석 → 장소 ID 매칭 → 원문 이력 보존', '운영시간·주소·폐업·이전 등 방문 전 재확인 신호', '새 요청 재수집, 반복 변경 유형과 갱신 우선순위 분석'],
    ['공영주차장', '공공 CSV의 좌표·주차장명 정규화', '장소 반경 1km 내 주차 접근성 확인', '기준일과 수집 시점을 보존해 주기 갱신'],
    ['버스정류장', '정류장 좌표 정제·중복 제거', '장소 반경 500m 내 정류장 존재 확인', '노선·도착 정보는 검증 후 단계 확장'],
    ['기상청 예보', '여행일·권역별 예보 조회와 위험 규칙 적용', '강풍·우천·폭염 시 야외 일정 주의와 대체 순간 제안', '예보 시점·유효시간을 보존하고 실패 상태 분리'],
  ], [1850, 2850, 3350, CONTENT - 8050], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('개발 데이터 스냅샷'),
  metricCards([
    { value: '4,422', label: '정제 장소' },
    { value: '1,557', label: '공영주차장' },
    { value: '4,271', label: '버스정류장' },
    { value: '556', label: '수정요청 매칭 장소' },
  ]),
  paragraph('수치는 개발 DB와 공개 CSV 분석 스냅샷 기준이며 운영 서비스에서는 수집·확인 시점을 함께 표시합니다. 1,686건은 수정요청 전체, 556건은 현재 장소 레코드에 연결된 이력입니다.', { run: { size: 16, color: COLOR.gray } }),
  subHeading('가공·활용의 지속성'),
  bullet('원본 스냅샷과 파생 신뢰 상태를 분리해 공급 데이터가 갱신돼도 판단 이력을 재현합니다.'),
  bullet('외부 호출에는 timeout·제한된 재시도·오류 분류를 적용하고 오래된 캐시를 최신 정보처럼 표시하지 않습니다.'),
  bullet('방문 피드백은 공공데이터 원본을 덮어쓰지 않으며 운영자 승인 보정만 버전 이력으로 추가합니다.'),
]);

// 6쪽: 차별성
addPage([
  subHeading('1-3. 기존 서비스와의 차별성 및 독창성'),
  table(['비교 대상', '기존 강점', '남는 문제', '제주를 담다의 차별점'], [
    ['지도 앱', '검색·길찾기·리뷰량', '왜 이 여행자에게 맞는지와 정보 충돌 설명이 약함', '동행자·일정·취향별 비교 이유와 근거 상태 제시'],
    ['관광 포털', '공식 관광 콘텐츠', '다양한 출처 비교와 개인 일정 조립이 제한적', '공식 정보는 운영 사실에 우선하고 다른 출처와 함께 비교'],
    ['블로그·SNS', '생생한 경험과 분위기', '개별 경험을 최신 운영 사실로 일반화할 위험', '경험 근거로만 역할을 제한하고 운영 사실은 별도 확인'],
    ['일반 AI 여행 챗봇', '대화 편의와 빠른 일정 생성', '출처 없는 사실 생성과 오래된 기억 사용 가능성', '웹 원문·확인 시점·출처 역할·공공데이터 교차확인 연결'],
    ['단순 공공데이터 앱', '공식 데이터 노출', '데이터 미수록을 현실의 부재로 오해할 수 있음', '공공데이터는 마지막 교차확인으로 사용하고 웹 후보를 배제하지 않음'],
  ], [1650, 2400, 3100, CONTENT - 7150], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('모방하기 어려운 핵심 자산'),
  bullet('근거 계약: 답변의 각 주장과 출처·확인 시점·지원·충돌 상태를 연결하는 구조화된 신뢰 파이프라인'),
  bullet('대화 문맥: 지역·일정·동행자·취향·이전 후보·제외 조건을 후속 검색 계획에 이어 주는 멀티턴 상태'),
  bullet('근거 원장: 공공데이터·웹검색·사용자 직접입력·방문 피드백·운영자 판정을 덮어쓰지 않고 이력으로 보존'),
  bullet('신뢰 순환: 여행 전 조사 → 플랜 스냅샷 → 현장 피드백 → 재검증 → 다음 추천 개선을 하나의 서비스 흐름으로 연결'),
  subHeading('차별화 문장'),
  note('많이 추천하는 AI가 아니라, 확인된 것과 확인되지 않은 것을 구분해 사용자가 다음 행동을 결정하게 하는 제주 여행 서비스'),
  subHeading('지식재산·확장성'),
  paragraph('핵심 자산은 특정 장소 목록이 아니라 출처 역할 평가, 최신성·충돌 판정, 플랜 근거 스냅샷, 피드백 검토 정책입니다. 제주에서 검증한 뒤 지역별 공공데이터 어댑터를 추가하는 방식으로 다른 관광지에 확장할 수 있습니다.'),
]);

// 7쪽: 사업성
addPage([
  sectionHeading('2 창업 및 사업화 계획'),
  subHeading('2-1. 개발 제품·서비스를 활용한 창업 계획'),
  table(['고객군', '핵심 과업', '제공 가치', '초기 검증 방법'], [
    ['제주 자유여행자', '짧은 시간에 믿을 만한 후보와 일정을 결정', '조건별 비교·근거·주의점이 있는 여행 플랜', '플랜 생성→저장→방문 피드백 전환율 측정'],
    ['가족·동행자 그룹', '아이·부모님·비렌터카 조건과 이동 부담 조율', '주차·정류장·날씨·동행자 적합성 비교', '가족 시나리오 사용성 인터뷰와 완주율'],
    ['제주 로컬 사업자', '잘못된 운영정보를 발견하고 수정 필요를 파악', '출처 충돌·현장 제보·보정 상태 리포트', '소규모 장소 파일럿과 수정 처리 시간 측정'],
    ['지자체·관광기관', '변경·누락 가능성이 큰 데이터의 갱신 우선순위 결정', '지역·주장 유형별 근거 공백과 반복 제보 대시보드', '기관 실무자 인터뷰와 리포트 PoC'],
  ], [1800, 3000, 3100, CONTENT - 7900], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('창업 추진 원칙'),
  bullet('B2C 사용성으로 실제 선택과 방문 데이터를 먼저 검증하고, 검증된 운영 데이터를 B2B·B2G 리포트로 확장합니다.'),
  bullet('회원 가입 수나 추천 클릭만이 아니라 근거가 있는 플랜이 실제 방문 피드백과 정보 개선으로 이어지는지를 핵심 성과로 봅니다.'),
  bullet('개인정보·증빙·운영자 검토가 필요한 기능은 이용자 수보다 오판율과 처리 품질을 우선해 단계적으로 개방합니다.'),
  subHeading('현재 준비 수준'),
  table(['완료', '고도화 중', '사업 검증 단계'], [[
    '배포형 웹·API, 여행팩, 하루방, 후보 확장, 플랜 API, 피드백·검토 API와 화면',
    '운영 인증·권한, 장기 저장소, 증빙 보안, 검색 공급자 품질·비용 최적화',
    '사용자 인터뷰, 반복 사용 지표, 로컬 파일럿, 기관 데이터 품질 PoC',
  ]], [3500, 3500, CONTENT - 7000], { bodySize: 16 }),
]);

// 8쪽: 수익/마케팅
addPage([
  subHeading('2-2. 사업화 계획 — 수익모델과 시장 진입'),
  table(['단계', '제공 상품', '과금 가설', '검증 지표'], [
    ['1단계 B2C 무료', '여행팩 생성, 하루방 상담, 기본 PDF, 방문 피드백', '무료로 핵심 가치와 재방문 검증', '플랜 완성률, 후보 담기율, 피드백 전환율'],
    ['2단계 B2C 프리미엄', '공유 플랜, 여행 저널 아카이브, 고급 체크리스트·비교 기능', '월 구독 또는 여행 단위 패스 가설', '무료→유료 전환 의향, 저장·재열람 빈도'],
    ['3단계 B2B', '장소 정보 신뢰 페이지, 변경 신호 알림, 출처·현장 리포트', '장소·권역 단위 구독 가설', '정보 정정 시간, 리포트 재사용률'],
    ['4단계 B2G', '지역별 근거 공백, 반복 오류 유형, 갱신 우선순위 대시보드', 'PoC·라이선스·운영 계약 가설', '기관 검토 시간 단축, 반영된 보정 건수'],
  ], [1450, 3800, 2400, CONTENT - 7650], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('고객 획득 전략'),
  table(['채널', '실행', '목적'], [
    ['검색 콘텐츠', '“아이와 제주”, “비 오는 제주”, “대중교통 제주”처럼 조건형 랜딩과 근거 비교 사례 제작', '의도가 분명한 여행자를 서비스 체험으로 연결'],
    ['공유 루프', '플랜 링크·PDF에 출처와 선택 이유를 함께 제공', '동행자 검토 과정에서 자연 유입'],
    ['로컬 협력', '정보 변경이 잦은 업종·권역의 소규모 파일럿', '정정 효용과 사업자 리포트 수요 검증'],
    ['기관 협력', '수정요청·반복 제보·공공데이터 미확인 현황을 비식별 리포트로 제시', '공공데이터 품질 개선 PoC 확보'],
  ], [1750, 5500, CONTENT - 7250], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('가격 결정 원칙'),
  paragraph('초기 문서에는 검증되지 않은 가격·매출을 확정값으로 제시하지 않습니다. 무료 사용자의 반복 행동, 프리미엄 기능별 지불 의향, B2B·B2G 파일럿의 업무시간 절감 효과를 측정한 뒤 가격을 확정합니다.'),
  subHeading('운영 비용 통제'),
  bullet('단순 사실·내부 조회는 규칙 기반 경로를 우선하고, 복합 비교·웹 조사에만 모델과 검색 비용을 집중합니다.'),
  bullet('출처 캐시에는 URL과 확인 시점을 함께 보존하고, 정보 유형별 유효기간으로 불필요한 재검색을 줄입니다.'),
]);

// 9쪽: 로드맵
addPage([
  subHeading('2-2. 사업화 계획 — 개발·운영 로드맵'),
  table(['단계', '핵심 범위', '완료 기준'], [
    ['현재 시제품', '웹 우선 하루방, 멀티턴, 출처 역할, 후보 추가 탐색, 플랜·피드백·운영자 검토 기본 흐름', '핵심 API·화면과 자동 테스트가 동작'],
    ['1단계 운영 기반', 'Supabase Auth·권한·장기 저장, 비회원 플랜의 계정 연결, 오류 복구', '사용자별 데이터 격리와 저장·공유 안정성 검증'],
    ['2단계 근거 원장', '선택 증빙, 개인정보 보호, 이상 제출 탐지, 반복 제보 분류', '피드백 원문 유실 없이 현장 신뢰 상태 계산'],
    ['3단계 검토 순환', '웹 재검증, 운영자 승인·보류·기각·취소, 보정 버전과 하루방 캐시 무효화', '승인 보정이 다음 답변 근거에 추적 가능하게 반영'],
    ['4단계 사업 확장', '커뮤니티 확인 후보, 로컬 리포트, 기관용 품질 대시보드와 내보내기', '파일럿 고객의 실제 업무 개선과 반복 사용 확인'],
  ], [1800, 5300, CONTENT - 7100], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('기술 운영 구조'),
  table(['영역', '역할', '운영 방향'], [
    ['Vercel · React/Vite', '웹·모바일 사용자 인터페이스', '빠른 배포, 접근성·반응형·PWA 품질 유지'],
    ['Railway · FastAPI', '하루방 웹 리서치, 장소 판별, 신뢰 계산, PDF와 장시간 작업', '외부 호출 timeout·재시도·구조화 오류와 관측 로그'],
    ['PostgreSQL', '공공데이터, 플랜, 근거, 피드백, 판정 이력', '원본·파생 상태 분리, 백업·복구·마이그레이션 검증'],
    ['Supabase 단계 도입', 'Auth, RLS, 사용자별 장기 데이터, 비공개 증빙 Storage', '복제 검증 후 전환하고 실패 시 되돌릴 수 있는 절차 마련'],
  ], [2050, 4100, CONTENT - 6150], { firstBold: true, bodySize: 16, compact: true }),
  subHeading('주요 위험과 대응'),
  table(['위험', '대응'], [
    ['출처 충돌·검색 장애', '충돌 내용을 함께 제시하고 검색 실패를 공공데이터로 숨기지 않음'],
    ['허위·이해관계 제보', '단일 제보 자동 확정 금지, 계정·반복성·증빙·독립 제보를 검토 우선순위에만 반영'],
    ['개인정보·증빙 노출', '선택 제출, 비공개 저장, EXIF 제거, 최소 권한, 삭제·비식별화 절차'],
  ], [3000, CONTENT - 3000], { firstBold: true, bodySize: 16, compact: true }),
]);

// 10쪽: KPI와 기대효과
addPage([
  subHeading('성과지표·기대효과 및 실행 역량'),
  table(['영역', '핵심 지표', '판단 질문'], [
    ['사용자 가치', '플랜 완성률, 후보 담기율, 저장·재열람률', '근거를 본 사용자가 실제 선택까지 진행했는가'],
    ['현장 전환', '저장 플랜의 방문 피드백 전환율', '여행 전 계획이 실제 방문과 연결됐는가'],
    ['근거 품질', '최신 근거 연결률, 주장 지원률, 출처 충돌 표시율', '답변의 핵심 주장을 사용자가 검증할 수 있는가'],
    ['운영 품질', '중요 제보 처리시간, 승인 취소·오판율', '빠르면서도 잘못된 보정을 만들지 않는가'],
    ['공공데이터 환류', '승인 보정이 이후 답변에 사용된 횟수, 기관 전달 후보 수', '현장 근거가 다음 선택과 데이터 개선에 쓰였는가'],
    ['사업성', '프리미엄 기능별 지불 의향, 파일럿 재계약 의향', '고객이 반복적으로 비용을 지불할 문제인가'],
  ], [1800, 3900, CONTENT - 5700], { firstBold: true, bodySize: 15, compact: true }),
  subHeading('기대효과'),
  table(['대상', '기대효과'], [
    ['여행자', '낡거나 충돌하는 정보로 인한 헛걸음과 일정 붕괴를 줄이고, 동행자와 선택 근거를 공유'],
    ['제주 지역', '유명 장소 쏠림보다 권역·취향·접근 조건에 맞는 다양한 후보 발견을 지원'],
    ['로컬 사업자', '잘못된 운영정보와 반복 문의를 빠르게 발견하고 정정 필요성을 파악'],
    ['공공기관', '누락·변경 가능성이 큰 데이터와 반복되는 현장 신호를 갱신 우선순위로 활용'],
  ], [2200, CONTENT - 2200], { firstBold: true, bodySize: 16 }),
  subHeading('팀 실행 역량 입력란'),
  table(['구성원', '담당 분야', '관련 경험·성과'], [
    ['[대표자 성명]', '[기획 / AI / 개발 / 디자인 중 입력]', '[경력·프로젝트·수상·창업 경험 입력]'],
    ['[팀원 성명]', '[담당 분야 입력]', '[관련 경험 입력]'],
    ['[팀원 성명]', '[담당 분야 입력]', '[관련 경험 입력]'],
  ], [2200, 3000, CONTENT - 5200], { firstBold: true, bodySize: 16 }),
  paragraph('※ 대표자·팀원 개인정보와 경력은 확인 가능한 내용만 입력하며, 개인 참여인 경우 불필요한 행을 삭제합니다.', { run: { size: 15, color: COLOR.gray } }),
  subHeading('결론'),
  note('제주를 담다는 공공데이터를 단순 노출하는 앱이 아니라, AI가 최신 웹 근거와 제주 공공데이터를 실제 여행 결정으로 번역하고 여행자의 경험을 다음 정보 개선으로 돌려보내는 신뢰 순환 서비스입니다.', COLOR.paleOrange),
]);

const document = new Document({
  creator: 'Pack Your Jeju',
  title: '2026 제주 공공데이터·AI 활용 창업경진대회 사업계획서',
  description: '제주를 담다 (Pack Your Jeju) 제품·서비스 개발 부문 사업계획서',
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

