import { z } from 'zod';

export const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    PORT: z.string().default('3001').transform(Number),
    FRONTEND_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    GOOGLE_DRIVE_MASTER_TEMPLATE_ID: z.string().optional(),
    GOOGLE_DRIVE_MASTER_FOLDER_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv() {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
        process.exit(1);
    }

    return parsed.data;
}
