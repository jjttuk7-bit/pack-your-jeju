import React, {useEffect, useMemo, useRef, useState} from 'react';

import type {
  RouteDayResult,
  RouteLocation,
  RouteSegment,
  TravelPlanItem,
} from '../types';


interface TravelRouteMapProps {
  activeDay: number;
  dayRoute: RouteDayResult;
  planItems: TravelPlanItem[];
  origin: RouteLocation;
  destination: RouteLocation;
  showRecommended: boolean;
}

type MarkerPoint = RouteLocation & {id: string};

const DAY_COLORS = ['#D7613B', '#2D6F65', '#C18A2E', '#6A7295'];


export default function TravelRouteMap({
  activeDay,
  dayRoute,
  planItems,
  origin,
  destination,
  showRecommended,
}: TravelRouteMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const naverKey = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined;
  const [mapStatus, setMapStatus] = useState<'idle' | 'ready' | 'fallback'>(
    naverKey ? 'idle' : 'fallback',
  );
  const route = showRecommended ? dayRoute.recommended : dayRoute.current;
  const itemById = useMemo(
    () => new Map(planItems.map((item) => [item.id, item])),
    [planItems],
  );
  const markers = useMemo<MarkerPoint[]>(() => {
    const ordered = route.item_ids.flatMap((itemId) => {
      const item = itemById.get(itemId);
      const lat = finiteNumber(item?.latitude);
      const lng = finiteNumber(item?.longitude);
      if (!item || lat == null || lng == null) return [];
      return [{id: item.id, label: item.name, lat, lng}];
    });
    return [
      {id: 'origin', ...origin},
      ...ordered,
      {id: 'destination', ...destination},
    ];
  }, [destination, itemById, origin, route.item_ids]);

  useEffect(() => {
    if (!naverKey || !mapRef.current) {
      setMapStatus('fallback');
      return;
    }

    let cancelled = false;
    let mapMarkers: any[] = [];
    let polylines: any[] = [];
    let authCheckTimer: number | null = null;

    ensureNaverMap(naverKey)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const w = window as any;
        const center = markers[0] ?? {lat: 33.38, lng: 126.53};
        const map = new w.naver.maps.Map(mapRef.current, {
          center: new w.naver.maps.LatLng(center.lat, center.lng),
          zoom: markers.length > 1 ? 10 : 9,
          minZoom: 8,
          mapDataControl: false,
          scaleControl: false,
          logoControlOptions: {position: w.naver.maps.Position.BOTTOM_LEFT},
        });
        const color = DAY_COLORS[(activeDay - 1) % DAY_COLORS.length];
        polylines = route.segments.flatMap((segment) => {
          const path = segment.geometry.map(
            (point) => new w.naver.maps.LatLng(point.lat, point.lng),
          );
          if (path.length < 2) return [];
          return [new w.naver.maps.Polyline({
            map,
            path,
            strokeColor: color,
            strokeOpacity: segment.status === 'estimated_route' ? 0.58 : 0.9,
            strokeWeight: 5,
            strokeStyle: segment.status === 'estimated_route' ? 'shortdash' : 'solid',
          })];
        });
        mapMarkers = markers.map((marker, index) => new w.naver.maps.Marker({
          position: new w.naver.maps.LatLng(marker.lat, marker.lng),
          map,
          title: `${index + 1}. ${marker.label}`,
          icon: {
            content: markerHtml(index + 1, color),
            size: new w.naver.maps.Size(30, 30),
            anchor: new w.naver.maps.Point(15, 15),
          },
        }));
        if (markers.length > 1) {
          const bounds = new w.naver.maps.LatLngBounds();
          markers.forEach((marker) => {
            bounds.extend(new w.naver.maps.LatLng(marker.lat, marker.lng));
          });
          map.fitBounds(bounds, {top: 38, right: 38, bottom: 38, left: 38});
        }
        authCheckTimer = window.setTimeout(() => {
          if (cancelled || !mapRef.current) return;
          const text = mapRef.current.textContent ?? '';
          if (text.includes('인증') && text.includes('실패')) {
            mapRef.current.innerHTML = '';
            setMapStatus('fallback');
            return;
          }
          setMapStatus('ready');
        }, 700);
      })
      .catch(() => {
        if (!cancelled) setMapStatus('fallback');
      });

    return () => {
      cancelled = true;
      if (authCheckTimer) window.clearTimeout(authCheckTimer);
      mapMarkers.forEach((marker) => marker.setMap(null));
      polylines.forEach((line) => line.setMap(null));
      mapMarkers = [];
      polylines = [];
    };
  }, [activeDay, markers, naverKey, route.segments]);

  return (
    <figure className="overflow-hidden rounded-2xl border border-[#D8C6A8] bg-[#FBF5E9]">
      <div ref={mapRef} className="relative h-[240px] w-full touch-pan-y">
        {mapStatus !== 'ready' ? (
          <FallbackRouteMap
            day={activeDay}
            markers={markers}
            segments={route.segments}
            estimated={route.status !== 'verified_route'}
          />
        ) : null}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E9DCC8] bg-white px-3 py-2.5 text-[10px] text-basalt-2">
        <span>Day {activeDay} 동선 {route.segments.length}개 구간</span>
        <span>{route.status === 'verified_route' ? '실제 경로' : '예상 구간 포함'}</span>
      </figcaption>
      <ol className="sr-only" aria-label={`Day ${activeDay} 방문 순서`}>
        {markers.map((marker, index) => (
          <li key={`${marker.id}-${index}`} aria-label={`${index + 1}. ${marker.label}`}>
            {index + 1}. {marker.label}
          </li>
        ))}
      </ol>
    </figure>
  );
}


function FallbackRouteMap({
  day,
  markers,
  segments,
  estimated,
}: {
  day: number;
  markers: MarkerPoint[];
  segments: RouteSegment[];
  estimated: boolean;
}) {
  const color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_72%_18%,#FFFFFF_0%,#F9F1E2_38%,#E7F0E9_100%)]">
      <svg viewBox="0 0 360 240" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path
          d="M28 135C47 86 96 55 151 45c61-11 131 1 168 33 30 27 30 66 4 94-31 33-99 45-166 35-66-10-119-38-132-72-2-6-1-7 3-10Z"
          fill="#FFF9EE"
          stroke="#C9A97F"
          strokeWidth="2"
        />
        {segments.map((segment, index) => {
          const points = segment.geometry.map(projectJejuCoordinate);
          if (points.length < 2) return null;
          const d = points.map((point, pointIndex) => (
            `${pointIndex === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
          )).join(' ');
          return (
            <path
              key={`${segment.from_id}-${segment.to_id}-${index}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={segment.status === 'estimated_route' ? '7 6' : undefined}
              opacity={segment.status === 'estimated_route' ? 0.68 : 0.9}
            />
          );
        })}
        {markers.map((marker, index) => {
          const point = projectJejuCoordinate(marker);
          return (
            <g key={`${marker.id}-${index}`} transform={`translate(${point.x} ${point.y})`}>
              <circle r="12" fill={color} stroke="#fff" strokeWidth="2.5" />
              <text
                y="4"
                textAnchor="middle"
                fill="#fff"
                fontSize="10"
                fontWeight="800"
                fontFamily="sans-serif"
              >
                {index + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-3 left-3 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-[10px] font-bold text-basalt shadow-sm">
        간이 지도 · {estimated ? '예상 동선' : '경로 미리보기'}
      </div>
    </div>
  );
}


function ensureNaverMap(clientId: string): Promise<void> {
  const w = window as any;
  if (w.naver?.maps) return Promise.resolve();
  const existing = document.getElementById('naver-map-sdk');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), {once: true});
      existing.addEventListener('error', () => reject(new Error('naver map load failed')), {once: true});
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'naver-map-sdk';
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('naver map load failed'));
    document.head.appendChild(script);
  });
}


function markerHtml(index: number, color: string): string {
  return `<div style="width:30px;height:30px;border-radius:999px;background:${color};color:#fff;border:2px solid #fff;box-shadow:0 6px 14px rgba(46,50,53,.22);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">${index}</div>`;
}


function projectJejuCoordinate(point: {lat: number; lng: number}): {x: number; y: number} {
  const x = 34 + ((point.lng - 125.9) / 1.25) * 292;
  const y = 195 - ((point.lat - 33.1) / 0.55) * 145;
  return {
    x: Math.min(330, Math.max(30, x)),
    y: Math.min(205, Math.max(35, y)),
  };
}


function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
