import { createContext, useContext, useState, ReactNode } from 'react';
import { Citation } from '../lib/types';

interface CitationContextType {
  activeCitation: Citation | null;
  setActiveCitation: (citation: Citation | null) => void;
}

const CitationContext = createContext<CitationContextType | undefined>(undefined);

interface CitationProviderProps {
  children: ReactNode;
}

/**
 * Provider component for managing active citation state.
 * Allows components to access and update the current highlighted citation.
 */
export function CitationProvider({ children }: CitationProviderProps) {
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  return (
    <CitationContext.Provider value={{ activeCitation, setActiveCitation }}>
      {children}
    </CitationContext.Provider>
  );
}

/**
 * Hook to access citation context.
 * Must be used within a CitationProvider.
 */
export function useCitationContext() {
  const context = useContext(CitationContext);
  if (!context) {
    throw new Error('useCitationContext must be used within CitationProvider');
  }
  return context;
}
