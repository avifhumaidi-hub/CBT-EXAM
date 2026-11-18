import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: raw };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let parsedDetail: { error?: string; operationType?: string; path?: string } | null = null;
    try {
      parsedDetail = JSON.parse(this.state.errorMessage);
    } catch {
      parsedDetail = null;
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3 text-rose-400">
            <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Terjadi Kendala Koneksi atau Izin Firebase
              </h2>
              <p className="text-xs text-slate-400">
                Sistem melindungi data dengan aturan keamanan Firestore.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-rose-300 overflow-x-auto max-h-40 overflow-y-auto">
            {parsedDetail
              ? `${parsedDetail.operationType?.toUpperCase() || 'OP'} ${parsedDetail.path || ''}: ${parsedDetail.error || ''}`
              : this.state.errorMessage}
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Muat Ulang Aplikasi
          </button>
        </div>
      </div>
    );
  }
}
