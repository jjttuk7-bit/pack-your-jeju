import { describe, expect, it } from 'vitest';
import {
  buildPlanPdfCustomScheduleItem,
  buildTravelPlanPdfRequest,
} from './planPdf';

describe('buildPlanPdfCustomScheduleItem', () => {
  it('시간이 있는 사용자 일정을 공백 제거 후 고정 일정으로 만든다', () => {
    const item = buildPlanPdfCustomScheduleItem(
      {
        name: '  렌터카 반납  ',
        day: 2,
        startTime: ' 18:30 ',
        address: '  제주공항 렌터카하우스  ',
        note: '  출발 2시간 전 반납  ',
      },
      'custom-1',
      3,
    );

    expect(item).toEqual({
      id: 'custom-1',
      name: '렌터카 반납',
      moment: 'user_added',
      source: 'user_added',
      day: 2,
      startTime: '18:30',
      fixed: true,
      address: '제주공항 렌터카하우스',
      note: '출발 2시간 전 반납',
    });
  });

  it('시간이 없으면 빈 필드를 null로 바꾸고 Day를 여행 기간 안으로 보정한다', () => {
    const item = buildPlanPdfCustomScheduleItem(
      {
        name: '숙소 체크인',
        day: 99,
        startTime: '   ',
        address: ' ',
        note: '\t',
      },
      'custom-2',
      3,
    );

    expect(item).toEqual({
      id: 'custom-2',
      name: '숙소 체크인',
      moment: 'user_added',
      source: 'user_added',
      day: 3,
      startTime: null,
      fixed: false,
      address: null,
      note: null,
    });
  });

  it('일정명이 비어 있으면 일정을 만들지 않는다', () => {
    expect(buildPlanPdfCustomScheduleItem(
      {
        name: '   ',
        day: 1,
        startTime: '',
        address: '',
        note: '',
      },
      'custom-3',
      2,
    )).toBeNull();
  });

  it('올바르지 않은 시간은 일정을 만들지 않는다', () => {
    expect(buildPlanPdfCustomScheduleItem(
      {
        name: '저녁 약속',
        day: 1,
        startTime: '25:00',
        address: '',
        note: '',
      },
      'custom-4',
      2,
    )).toBeNull();
  });
});

describe('buildTravelPlanPdfRequest', () => {
  it('사용자 일정의 시간과 고정 상태를 PDF 요청에 전달한다', () => {
    const request = buildTravelPlanPdfRequest(
      {
        regions: ['jeju_city'],
        startDate: '2026-07-19',
        durationDays: 2,
        companion: 'solo',
        purpose: 'healing',
      },
      ['quiet_cafe'],
      {
        title: '나의 제주 여행',
        items: [
          {
            id: 'custom-1',
            name: '렌터카 반납',
            moment: 'user_added',
            source: 'user_added',
            day: 2,
            order: 1,
            pdfMemo: '출발 2시간 전 반납',
            startTime: '18:30',
            fixed: true,
          },
        ],
      },
      [],
    );

    expect(request.items[0]).toEqual({
      id: 'custom-1',
      name: '렌터카 반납',
      day: 2,
      order: 1,
      start_time: '18:30',
      fixed: true,
      source: 'user_added',
      address: null,
      memo: '출발 2시간 전 반납',
      badge: null,
      source_title: null,
      source_url: null,
      checked_at: null,
      check_required: [],
    });
  });
});
