'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                gcTime: 1000 * 60 * 60 * 24, // 24 hours
                staleTime: 1000 * 60 * 5, // 5 minutes
            },
        },
    }));

    const persister = typeof window !== 'undefined'
        ? createSyncStoragePersister({ storage: window.localStorage })
        : undefined;

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: persister as any }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
