'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { searchSymbols, type SymbolResult } from '@/lib/api';

const TYPE_COLORS: Record<string, string> = {
  stock: 'bg-blue-100 text-blue-700',
  etf: 'bg-green-100 text-green-700',
  commodity: 'bg-amber-100 text-amber-700',
  crypto: 'bg-purple-100 text-purple-700',
};

const TYPE_LABELS: Record<string, string> = {
  stock: 'Stock',
  etf: 'ETF',
  commodity: 'Commodity',
  crypto: 'Crypto',
};

interface AssetSearchProps {
  onSelect: (symbol: string, assetType: string, displayName: string) => void;
  loading: boolean;
  t: (key: string) => string;
  existingAssets: Array<{ symbol: string; asset_type: string }>;
}

export function AssetSearch({ onSelect, loading, t, existingAssets }: AssetSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const { results: r } = await searchSymbols(q);
      setResults(r);
      setShowDropdown(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val.trim()), 300);
  };

  const handleSelect = (r: SymbolResult) => {
    onSelect(r.symbol, r.asset_type, r.name);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdded = (r: SymbolResult) =>
    existingAssets.some(
      (a) => a.symbol.toUpperCase() === r.symbol.toUpperCase() && a.asset_type === r.asset_type,
    );

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <label htmlFor="asset-search" className="block text-xs font-medium text-gray-600 mb-1">
        {t('dashboard.searchAssetLabel')}
      </label>
      <input
        id="asset-search"
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder={t('dashboard.searchAssetPlaceholder')}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={loading}
        autoComplete="off"
      />
      {searching && (
        <div className="absolute right-3 top-8 text-xs text-gray-400">{t('common.loading')}</div>
      )}
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((r) => {
            const added = isAdded(r);
            return (
              <li key={r.symbol + ':' + r.asset_type}>
                <button
                  type="button"
                  disabled={added || loading}
                  onClick={() => handleSelect(r)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2 ${added ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{r.symbol}</span>
                    <span className="text-xs text-gray-500 truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.exchange && (
                      <span className="text-[10px] text-gray-400">{r.exchange}</span>
                    )}
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[r.asset_type] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {TYPE_LABELS[r.asset_type] || r.asset_type}
                    </span>
                    {added && (
                      <span className="text-[10px] text-gray-400">{t('dashboard.alreadyAdded')}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {showDropdown && !searching && query.length >= 1 && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-3 text-sm text-gray-500">
          <p>{t('dashboard.noSymbolsFound')}</p>
          <p className="text-xs mt-1">{t('dashboard.populateHint')}</p>
        </div>
      )}
    </div>
  );
}
