import { useMemo } from 'react';

import { useI18n } from '../state/I18nContext';

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices,
  caption,
  size = 168,
  thickness = 26,
}: {
  slices: ChartSlice[];
  caption?: string;
  size?: number;
  thickness?: number;
}) {
  const { formatNumber, formatPercent } = useI18n();

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    let offset = 0;
    return slices.map((slice) => {
      const ratio = total > 0 ? slice.value / total : 0;
      const segment = { ...slice, ratio, dash: ratio * circumference, offset };
      offset += ratio * circumference;
      return segment;
    });
  }, [slices, total, circumference]);

  return (
    <div className="donut">
      <svg
        className="chart"
        viewBox={`0 0 ${size} ${size}`}
        style={{ maxWidth: size, margin: '0 auto', display: 'block' }}
        role="img"
        aria-label={caption}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-inset)"
            strokeWidth={thickness}
          />
          {total > 0 &&
            segments.map((segment) => (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
                strokeDashoffset={-segment.offset}
                strokeLinecap="butt"
              />
            ))}
        </g>
        <text
          className="donut__total"
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {formatNumber(total)}
        </text>
      </svg>

      {caption && <div className="donut__caption">{caption}</div>}

      <div className="chart__legend">
        {segments.map((segment) => (
          <span key={segment.label} className="chart__legend-item">
            <span className="dot" style={{ background: segment.color }} />
            {segment.label}: <strong>{formatNumber(segment.value)}</strong>
            {total > 0 && <span className="text-muted">({formatPercent(segment.ratio, 0)})</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  display?: string;
  title?: string;
}

export function BarList({
  items,
  max,
  formatValue,
}: {
  items: BarItem[];
  max?: number;
  formatValue?: (value: number) => string;
}) {
  const { formatNumber } = useI18n();
  const ceiling = max ?? Math.max(...items.map((item) => item.value), 0);

  return (
    <div className="bars">
      {items.map((item) => (
        <div className="bars__row" key={item.label} title={item.title ?? item.label}>
          <span className="bars__label">{item.label}</span>
          <span className="bars__track">
            <span
              className="bars__fill"
              style={{
                width: ceiling > 0 ? `${(item.value / ceiling) * 100}%` : '0%',
                background: item.color ?? 'var(--brand)',
              }}
            />
          </span>
          <span className="bars__value">
            {item.display ?? (formatValue ? formatValue(item.value) : formatNumber(item.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface SeriesConfig {
  key: string;
  label: string;
  color: string;
}

export function GroupedBarChart({
  data,
  series,
  height = 230,
}: {
  data: Record<string, number | string>[];
  series: SeriesConfig[];
  height?: number;
}) {
  const { formatNumber } = useI18n();

  const width = 720;
  const padding = { top: 14, right: 14, bottom: 34, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(
    ...data.flatMap((point) => series.map((config) => Number(point[config.key]) || 0)),
    1,
  );

  const step = Math.max(1, Math.ceil(maxValue / 4));
  const ceiling = step * 4;

  const groupWidth = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(4, Math.min(26, (groupWidth * 0.7) / series.length));

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: Math.max(320, data.length * 70) }}
        role="img"
      >
        {Array.from({ length: 5 }, (_, index) => {
          const value = (ceiling / 4) * index;
          const y = padding.top + plotHeight - (value / ceiling) * plotHeight;
          return (
            <g key={index}>
              <line
                className="chart__grid-line"
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
              <text className="chart__label" x={padding.left - 7} y={y + 3.5} textAnchor="end">
                {formatNumber(value)}
              </text>
            </g>
          );
        })}

        {data.map((point, groupIndex) => {
          const groupX = padding.left + groupIndex * groupWidth;
          const barsWidth = barWidth * series.length;
          const startX = groupX + (groupWidth - barsWidth) / 2;

          return (
            <g key={String(point.period ?? groupIndex)}>
              {series.map((config, seriesIndex) => {
                const value = Number(point[config.key]) || 0;
                const barHeight = (value / ceiling) * plotHeight;
                return (
                  <rect
                    key={config.key}
                    x={startX + seriesIndex * barWidth}
                    y={padding.top + plotHeight - barHeight}
                    width={Math.max(barWidth - 2, 2)}
                    height={barHeight}
                    fill={config.color}
                    rx={2}
                  >
                    <title>{`${String(point.period)} — ${config.label}: ${value}`}</title>
                  </rect>
                );
              })}
              <text
                className="chart__label"
                x={groupX + groupWidth / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
              >
                {String(point.period)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="chart__legend">
        {series.map((config) => (
          <span key={config.key} className="chart__legend-item">
            <span className="dot" style={{ background: config.color }} />
            {config.label}
          </span>
        ))}
      </div>
    </div>
  );
}
