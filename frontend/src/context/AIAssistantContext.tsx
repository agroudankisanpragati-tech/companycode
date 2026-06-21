'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
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
}

const GREETING: Message = {
  role: 'assistant',
  content:
    '🌾 Namaste! Main Agrodan Kisan Pragati ka AI Copilot hoon.\n\nMain aapko platform ke har feature ke baare mein guide kar sakta hoon — crop advice, soil health, mandi prices, disease detection, government schemes, aur bahut kuch.\n\nAap kya jaanna chahte hain? 👇',
};

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [sending, setSending] = useState(false);
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
      value={{ isOpen, openAssistant, closeAssistant, toggleAssistant, messages, setMessages, sending, setSending, inputRef }}
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
