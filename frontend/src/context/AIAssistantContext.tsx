'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// PageData mirrors the backend contextEngine PageData shape.
// Pages push their live data here so Pragati AI answers in context.
export interface PageData {
  pageContext:
    | 'disease' | 'crop' | 'soil' | 'weather' | 'market'
    | 'government' | 'kvk' | 'farm_diary' | 'shop' | 'admin'
    | 'dashboard' | 'ui';
  diseaseResult?: {
    diseaseName?: string; cropName?: string; confidence?: number;
    severity?: string; causes?: string; organicSolution?: string;
    chemicalSolution?: string; prevention?: string;
  };
  schemeData?: {
    title?: string; department?: string; summary?: string;
    benefits?: string[]; eligibility?: string; applicationProcess?: string;
  };
  cropData?: {
    cropName?: string; variety?: string; stage?: string;
    dayAge?: number; soilType?: string; season?: string;
  };
  soilData?: {
    healthScore?: number; healthStatus?: string; nitrogen?: string;
    phosphorus?: string; potassium?: string; ph?: number; recommendations?: string;
  };
  weatherData?: {
    location?: string; condition?: string; temp?: number;
    humidity?: number; rainfall?: number; forecast?: string;
  };
  marketData?: {
    commodity?: string; market?: string; state?: string;
    modalPrice?: number; minPrice?: number; maxPrice?: number;
  };
  kvkData?: {
    name?: string; district?: string; state?: string;
    services?: string[]; distance?: number;
  };
  farmDiaryData?: {
    cropName?: string; stage?: string; dayAge?: number; todayTasks?: string[];
  };
  shopData?: { shopName?: string; shopType?: string; products?: string[] };
}

interface AIAssistantContextType {
  isOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sending: boolean;
  setSending: React.Dispatch<React.SetStateAction<boolean>>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  /** Live page data — set by each page so Pragati AI answers in context */
  pageData: PageData | null;
  setPageData: (data: PageData | null) => void;
}

export function getAssistantGreeting(): string {
  return '🌾 Namaste! Main Pragati AI hoon — aapka intelligent krishi sahayak.\n\nMain aapko platform ke har feature ke baare mein guide kar sakta hoon — crop advice, soil health, mandi prices, disease detection, government schemes, aur bahut kuch.\n\nAap kya jaanna chahte hain? 👇';
}

export function getAssistantBranding() {
  return {
    title: 'Pragati AI',
    subtitle: 'Agroudan Kisan Pragati',
  };
}

const GREETING: Message = {
  role: 'assistant',
  content: getAssistantGreeting(),
};

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [sending, setSending] = useState(false);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const openAssistant = useCallback(() => {
    setIsOpen(true);
    // Focus input after open animation
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  const closeAssistant = useCallback(() => setIsOpen(false), []);

  const toggleAssistant = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setTimeout(() => inputRef.current?.focus(), 150);
      return !prev;
    });
  }, []);

  return (
    <AIAssistantContext.Provider
      value={{ isOpen, openAssistant, closeAssistant, toggleAssistant, messages, setMessages, sending, setSending, inputRef, pageData, setPageData }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  const ctx = useContext(AIAssistantContext);
  if (!ctx) throw new Error('useAIAssistant must be used within AIAssistantProvider');
  return ctx;
}
