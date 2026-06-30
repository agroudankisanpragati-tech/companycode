'use client';

import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; }

export default class AIErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[AIErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center" role="alert">
          <p className="font-semibold text-red-700">Something went wrong. Please try again.</p>
          <p className="text-sm text-red-600 mt-1">कुछ गलत हो गया। कृपया पुनः प्रयास करें।</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
          >
            Retry / पुनः प्रयास
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
