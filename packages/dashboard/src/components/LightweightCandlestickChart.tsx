'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts';

export interface CandlePoint {
  time: number;   // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  data: CandlePoint[];
  height?: number;
}

export default function LightweightCandlestickChart({ data, height = 340 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data.length) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
        fontFamily: 'inherit',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        vertLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
        horzLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        textColor: '#64748b',
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Volume histogram (overlay at bottom 20%)
    const volSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(59,130,246,0.18)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    // Sort data by time (required by lightweight-charts)
    const sorted = [...data].sort((a, b) => a.time - b.time);

    candleSeries.setData(
      sorted.map(d => ({
        time: d.time as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    volSeries.setData(
      sorted.map(d => ({
        time: d.time as any,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
      }))
    );

    chart.timeScale().fitContent();

    // Resize handler
    const ro = new ResizeObserver(() => {
      if (container) chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data, height]);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}
