import { cookies } from 'next/headers';
import { env } from './env';

export async function serverClient(path: string, options: RequestInit = {}) {
    const cookieStore = await cookies();
    const cookiesHeader = cookieStore.toString();

    const url = `${env.NEXT_PUBLIC_API_URL}${path.startsWith('/') ? path : `/${path}`}`;

    const defaultOptions: RequestInit = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Cookie: cookiesHeader,
            ...options.headers,
        },
    };

    return fetch(url, defaultOptions);
}
