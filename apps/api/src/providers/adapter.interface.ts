export interface NormalizedPointMeta {
  source: string;
  raw?: Record<string, unknown>;
}

export interface NormalizedPoint {
  indicatorKey: string;
  ts: string; // ISO UTC
  value: number;
  meta: NormalizedPointMeta;
}

export interface FetchParams {
  from?: string; // ISO date
  to?: string;
  granularity?: string;
}

export interface ProviderAdapter {
  name: string;
  supports: string[];
  fetch(indicatorKey: string, params: FetchParams): Promise<NormalizedPoint[]>;
}
