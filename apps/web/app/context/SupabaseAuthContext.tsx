'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseBrowser, initSupabaseBrowserFromConfig } from '@/lib/supabase';

type SupabaseAuthContextValue = { clientReady: boolean };

const SupabaseAuthContext = createContext<SupabaseAuthContextValue>({ clientReady: false });

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    if (getSupabaseBrowser()) {
      setClientReady(true);
      return;
    }
    initSupabaseBrowserFromConfig().then(() => setClientReady(true));
  }, []);

  return (
    <SupabaseAuthContext.Provider value={{ clientReady }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuthReady(): boolean {
  return useContext(SupabaseAuthContext).clientReady;
}
