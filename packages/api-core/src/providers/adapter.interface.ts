export interface NormalizedPointMeta {
  source: string;
  raw?: Record<string, unknown>;
}

export interface NormalizedPoint {
  indicatorKey: string;
  ts: string;
  value: number;
  meta: NormalizedPointMeta;
}

export interface FetchParams {
  from?: string;
  to?: string;
  granularity?: string;
}

export interface ProviderAdapter {
  name: string;
  supports: string[];
  fetch(indicatorKey: string, params: FetchParams): Promise<NormalizedPoint[]>;
}
