'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 text-2xl">
                        ⚠️
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">System Offline</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                        We're having trouble connecting to the finance engine. This might be due to a secure connection timeout or temporary maintenance.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                    >
                        Retry Connection
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
