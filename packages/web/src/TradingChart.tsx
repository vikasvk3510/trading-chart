import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { DEFAULT_COLORS } from 'tradingcandle-core';
import type { TradingChartApi, TradingChartHandle, TradingChartProps } from './types';

export const TradingChart = forwardRef<TradingChartHandle, TradingChartProps>(function TradingChart(
  props,
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TradingChartApi | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useImperativeHandle(
    ref,
    () => ({
      setData: (data) => apiRef.current?.setData(data),
      updateCandle: (candle) => apiRef.current?.updateCandle(candle),
      takeScreenshot: () => apiRef.current?.takeScreenshot() ?? '',
      setIndicators: (indicators) => apiRef.current?.setIndicators(indicators),
      clearDrawings: () => apiRef.current?.clearDrawings(),
      scrollToLatest: () => apiRef.current?.scrollToLatest(),
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    let api: TradingChartApi | null = null;
    const specifier = './engine.js';
    void import(/* @vite-ignore */ specifier).then((mod) => {
      const engine = mod as typeof import('./engine');
      if (dead || !hostRef.current) return;
      const current = propsRef.current;
      api = engine.createTradingChart(hostRef.current, {
        symbol: current.symbol ?? 'BTCUSDT',
        exchangeLabel: current.exchangeLabel ?? 'Bybit',
        marketType: current.marketType ?? 'Spot',
        interval: current.interval ?? '30m',
        data: current.data ?? [],
        indicators: current.indicators ?? ['VOL', 'SMA'],
        theme: current.theme ?? 'dark',
        colors: { ...DEFAULT_COLORS, ...current.colors },
        chartType: current.chartType ?? 'candle',
        scale: current.scale ?? 'auto',
        showToolbar: current.showToolbar ?? true,
        showTimeframeBar: current.showTimeframeBar ?? true,
        showVolume: current.showVolume ?? true,
        embedded: false,
        smaPeriod: current.smaPeriod ?? 9,
        volumeSmaPeriod: current.volumeSmaPeriod ?? 9,
        onIntervalChange: (interval) => propsRef.current.onIntervalChange?.(interval),
        onLoadMore: (oldest) => propsRef.current.onLoadMore?.(oldest),
        onCrosshairMove: (candle) => propsRef.current.onCrosshairMove?.(candle),
        onScreenshot: (dataUrl) => propsRef.current.onScreenshot?.(dataUrl),
        onFullscreen: (enabled) => propsRef.current.onFullscreen?.(enabled),
        onError: (message) => propsRef.current.onError?.(message),
      });
      apiRef.current = api;
    });
    return () => {
      dead = true;
      api?.destroy();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.setData(props.data ?? []);
  }, [props.data]);

  useEffect(() => {
    if (props.interval) apiRef.current?.setInterval(props.interval);
  }, [props.interval]);

  useEffect(() => {
    apiRef.current?.setIndicators(props.indicators ?? ['VOL', 'SMA']);
  }, [props.indicators?.join('|')]);

  useEffect(() => {
    if (props.showVolume != null) apiRef.current?.setShowVolume(props.showVolume);
  }, [props.showVolume]);

  useEffect(() => {
    if (props.theme) apiRef.current?.setTheme(props.theme);
  }, [props.theme]);

  useEffect(() => {
    if (props.symbol) {
      apiRef.current?.setSymbol(props.symbol, props.exchangeLabel, props.marketType);
    }
  }, [props.symbol, props.exchangeLabel, props.marketType]);

  useEffect(() => {
    if (props.chartType) apiRef.current?.setChartType(props.chartType);
  }, [props.chartType]);

  useEffect(() => {
    if (props.scale) apiRef.current?.setScale(props.scale);
  }, [props.scale]);

  const upColor = props.colors?.up;
  const downColor = props.colors?.down;
  useEffect(() => {
    if (!upColor && !downColor) return;
    apiRef.current?.setColors({
      up: upColor || DEFAULT_COLORS.up,
      down: downColor || DEFAULT_COLORS.down,
    });
  }, [upColor, downColor]);

  return (
    <div
      ref={hostRef}
      className={props.className}
      style={{ width: '100%', height: '100%', minHeight: 320, ...props.style }}
    />
  );
});
