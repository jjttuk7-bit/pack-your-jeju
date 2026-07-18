import {buildInitialPlanPdfDraft} from './planPdf';
import {applyRouteProposal} from './routeProposal';
import type {
  HarubanPlanCheckState,
  HarubanPlanDraft,
  RoutePlanResponse,
  TravelInfo,
  TravelPlanItem,
  WeatherReportResponse,
} from './types';
import {
  applyWeatherProposal,
  planFingerprint,
  schedulePlanItemsForWeather,
} from './weatherProposal';


interface CreateHarubanPlanDraftInput {
  info: TravelInfo;
  items: TravelPlanItem[];
  weatherReport?: WeatherReportResponse | null;
  routeReport?: RoutePlanResponse | null;
  weatherError?: string | null;
  routeError?: string | null;
  now?: string;
}


function addReason(
  reasonsByItemId: Record<string, string[]>,
  itemId: string,
  reason: string,
) {
  if (!reason.trim()) return;
  reasonsByItemId[itemId] = Array.from(new Set([
    ...(reasonsByItemId[itemId] ?? []),
    reason.trim(),
  ]));
}


function unavailableCheck(label: string, error?: string | null): HarubanPlanCheckState {
  return {
    status: 'unavailable',
    headline: error?.trim() || `${label} 정보를 확인하지 못했습니다.`,
  };
}


export function createHarubanPlanDraft({
  info,
  items,
  weatherReport,
  routeReport,
  weatherError,
  routeError,
  now = new Date().toISOString(),
}: CreateHarubanPlanDraftInput): HarubanPlanDraft {
  const sourcePlanFingerprint = planFingerprint(items);
  const warnings: string[] = [];
  const reasonsByItemId: Record<string, string[]> = {};
  let composedItems = schedulePlanItemsForWeather(info, items);

  let weather = unavailableCheck('날씨', weatherError);
  if (weatherReport) {
    weatherReport.impacts.forEach((impact) => {
      addReason(reasonsByItemId, impact.item_id, impact.reason);
    });
    let applied = 0;
    for (const proposal of weatherReport.proposals) {
      const result = applyWeatherProposal(composedItems, proposal);
      if (result.ok) {
        composedItems = result.items;
        applied += 1;
      } else if (result.reason) {
        warnings.push(`날씨 제안 미반영: ${result.reason}`);
      }
    }
    const partial = weatherReport.forecast_meta.partial
      || weatherReport.forecast_meta.unavailable_regions.length > 0;
    weather = {
      status: partial ? 'partial' : applied > 0 ? 'applied' : 'unchanged',
      headline: weatherReport.headline,
      checkedAt: weatherReport.impacts.find((impact) => impact.forecast_issued_at)
        ?.forecast_issued_at ?? null,
    };
    weatherReport.forecast_meta.failures.forEach((failure) => {
      warnings.push(`${failure.region} 날씨 미확인: ${failure.reason}`);
    });
  } else if (weatherError) {
    warnings.push(`날씨 확인 실패: ${weatherError}`);
  }

  let route = unavailableCheck('동선', routeError);
  if (routeReport) {
    let applied = false;
    if (routeReport.proposal) {
      const result = applyRouteProposal(composedItems, routeReport.proposal);
      if (result.ok) {
        composedItems = result.items;
        applied = true;
        routeReport.proposal.operations.forEach((operation) => {
          operation.ordered_item_ids.forEach((itemId) => {
            routeReport.proposal?.reasons.forEach((reason) => {
              addReason(reasonsByItemId, itemId, reason);
            });
          });
        });
      } else if (result.reason) {
        warnings.push(`동선 제안 미반영: ${result.reason}`);
      }
    }
    route = {
      status: routeReport.partial
        ? 'partial'
        : applied
          ? 'applied'
          : routeReport.status === 'unavailable'
            ? 'unavailable'
            : 'unchanged',
      headline: routeReport.headline,
      checkedAt: routeReport.provider_meta.checked_at,
    };
    routeReport.provider_meta.failures.forEach((failure) => {
      warnings.push(`동선 일부 미확인: ${failure.reason}`);
    });
  } else if (routeError) {
    warnings.push(`동선 확인 실패: ${routeError}`);
  }

  composedItems
    .filter((item) => item.latitude == null || item.longitude == null)
    .forEach((item) => {
      warnings.push(`${item.name}: 위치 정보가 없어 동선 확인에서 제외했습니다.`);
    });

  const pdfDraft = buildInitialPlanPdfDraft(
    composedItems,
    info.durationDays,
    '하루방이 조합한 제주 여행',
  );
  return {
    ...pdfDraft,
    sourcePlanFingerprint,
    createdAt: now,
    weather,
    route,
    reasonsByItemId,
    warnings: Array.from(new Set(warnings)),
  };
}
