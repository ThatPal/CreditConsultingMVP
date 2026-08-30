import { z } from 'zod';

const schema = z.object({ VITE_API_URL: z.url().default('http://localhost:3001') });
export const webEnv = schema.parse(import.meta.env);
