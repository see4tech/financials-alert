'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLocale } from '@/app/context/LocaleContext';
import { fetchIndicatorHistory } from '@/lib/api';

export type Point = { ts: string; value: number };

type IndicatorChartProps = {
  indicatorKey: string;
  compact?: boolean;
};

export function IndicatorChart({ indicatorKey, compact = false }: IndicatorChartProps) {
  const { t, locale } = useLocale();
  const [data, setData] = useState<{ data: Point[] } | null>(null);
  const [range, setRange] = useState<'30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{ point: Point; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!indicatorKey) return;
    setLoading(true);
    setError(null);
    fetchIndicatorHistory(indicatorKey, '90d', '1d')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [indicatorKey]);

  const localeCode = locale === 'es' ? 'es' : 'en';
  const formatDate = useCallback(
    (ts: string) => new Date(ts).toLocaleDateString(localeCode, { month: 'short', day: 'numeric' }),
    [localeCode],
  );
  const formatDateShort = useCallback(
    (ts: string) => new Date(ts).toLocaleDateString(localeCode, { day: 'numeric', month: 'numeric' }),
    [localeCode],
  );

  if (!indicatorKey) return null;

  if (loading) {
    return (
      <div className={compact ? 'py-4 text-sm text-gray-500' : 'p-8 text-gray-500'}>
        {t('common.loading')}
      </div>
    );
  }
  if (error) {
    return (
      <div className={compact ? 'py-4 text-sm text-red-600' : 'p-8 text-red-600'}>
        {t('common.error')}: {error}
      </div>
    );
  }

  const allPoints = data?.data || [];
  const displayedPoints = range === '30d' && allPoints.length > 30
    ? allPoints.slice(-30)
    : allPoints;
  const points = displayedPoints;
  const maxVal = allPoints.length ? Math.max(...allPoints.map((p) => p.value)) : 1;
  const minVal = allPoints.length ? Math.min(...allPoints.map((p) => p.value)) : 0;
  const rangeVal = maxVal - minVal || 1;
  const yTicks = [maxVal, minVal + rangeVal * 0.5, minVal].filter((v, i, a) => a.indexOf(v) === i);
  const xStep = Math.max(1, Math.floor(points.length / 5));
  const useShortDate = points.length > 14;
  const xFormat = useShortDate ? formatDateShort : formatDate;
  const chartHeight = compact ? 'h-40' : 'h-56';
  const minBarHeightPct = 4;

  const barHeightPct = (p: Point) => {
    if (maxVal === minVal) return 100;
    const pct = ((p.value - minVal) / rangeVal) * 100;
    return Math.max(minBarHeightPct, pct);
  };

  return (
    <div className="relative">
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => setRange('30d')}
          className={`px-3 py-1 rounded text-sm ${range === '30d' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          {t('indicatorsDetail.period30')}
        </button>
        <button
          type="button"
          onClick={() => setRange('90d')}
          className={`px-3 py-1 rounded text-sm ${range === '90d' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          {t('indicatorsDetail.period90')}
        </button>
      </div>
      {points.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="font-medium text-sm">{t('indicatorsDetail.noHistory')}</p>
          <p className="mt-1 text-xs">{t('indicatorsDetail.noHistoryHint')}</p>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-white relative">
          <div className={`flex gap-2 ${chartHeight}`}>
            <div className="flex flex-col justify-between text-right text-xs text-gray-500 pr-2 shrink-0">
              {yTicks.map((v) => (
                <span key={v}>{typeof v === 'number' && v % 1 !== 0 ? v.toFixed(2) : v}</span>
              ))}
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-end gap-px flex-1 relative">
                {points.map((p) => (
                  <div
                    key={p.ts}
                    className="flex-1 bg-blue-500 rounded-t min-w-0"
                    style={{
                      height: `${barHeightPct(p)}%`,
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredBar({
                        point: p,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                ))}
              </div>
              <div className="flex text-xs text-gray-500 mt-1 gap-px">
                {points.map((p, i) => (
                  <span key={p.ts} className="flex-1 min-w-0 text-center" style={{ flex: 1 }}>
                    {i % xStep === 0 ? xFormat(p.ts) : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {hoveredBar && (
            <div
              className="fixed z-50 px-2 py-1 text-xs font-medium bg-gray-800 text-white rounded shadow-lg pointer-events-none"
              style={{
                left: hoveredBar.x,
                top: hoveredBar.y - 32,
                transform: 'translate(-50%, 0)',
              }}
            >
              {formatDate(hoveredBar.point.ts)}: {hoveredBar.point.value}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">{t('indicatorsDetail.chartHint')}</p>
        </div>
      )}
    </div>
  );
}
