'use client';

import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

export function AdminClock() {
    const [currentTime, setCurrentTime] = useState<string>('');

    useEffect(() => {
        setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="text-3xl font-mono font-medium text-slate-900 flex items-center gap-2 text-right">
            <Globe className="text-secondary" size={28} />
            {currentTime}
        </div>
    );
}
