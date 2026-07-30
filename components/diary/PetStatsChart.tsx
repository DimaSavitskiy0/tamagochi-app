import { Fragment } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Text, View } from '@/components/Themed';

export type ChartPoint = {
  date: string;
  value: number;
};

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  unit: string;
  points: ChartPoint[];
};

type PetStatsChartProps = {
  series: ChartSeries[];
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;
const PADDING = 16;

function projectSeries(points: ChartPoint[], windowStart: number, windowEnd: number) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = CHART_WIDTH - PADDING * 2;
  const innerHeight = CHART_HEIGHT - PADDING * 2;
  const timeRange = windowEnd - windowStart || 1;

  return points.map((point) => {
    const t = (new Date(point.date).getTime() - windowStart) / timeRange;
    const x = PADDING + Math.max(0, Math.min(1, t)) * innerWidth;
    const y = PADDING + innerHeight - ((point.value - min) / range) * innerHeight;
    return { x, y };
  });
}

// Each line is normalized to its own min/max (a kg-scale weight line and 0-100 percentage
// lines can't share one literal y-axis) — the legend spells out the real value range per
// line so the shape is still meaningful, not just decorative.
export function PetStatsChart({ series }: PetStatsChartProps) {
  const plottable = series.filter((item) => item.points.length >= 2);
  if (plottable.length === 0) return null;

  const allTimes = plottable.flatMap((item) => item.points.map((point) => new Date(point.date).getTime()));
  const windowStart = Math.min(...allTimes);
  const windowEnd = Math.max(...allTimes);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Динамика за 30 дней</Text>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        {plottable.map((item) => {
          const coords = projectSeries(item.points, windowStart, windowEnd);
          const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
          return (
            <Fragment key={item.key}>
              <Polyline points={polylinePoints} fill="none" stroke={item.color} strokeWidth={2.5} />
              {coords.map((c, index) => (
                <Circle key={index} cx={c.x} cy={c.y} r={3} fill={item.color} />
              ))}
            </Fragment>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        {plottable.map((item) => {
          const values = item.points.map((point) => point.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          return (
            <View key={item.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>
                {item.label}: {min}–{max} {item.unit}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(120,120,120,0.08)',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  legend: {
    marginTop: 10,
    gap: 6,
    backgroundColor: 'transparent',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    opacity: 0.75,
  },
});
