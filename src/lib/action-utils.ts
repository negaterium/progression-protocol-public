import { ZodSchema } from "zod";
import db from "./db";

export type ActionResponse<T = void> = {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
};

export async function safeAction<TInput, TOutput>(
    schema: ZodSchema<TInput>,
    data: TInput,
    action: (parsed: TInput) => Promise<TOutput>
): Promise<ActionResponse<TOutput>> {
    const result = schema.safeParse(data);
    if (!result.success) {
        console.error('SafeAction Validation Failed:', {
            count: result.error.issues.length,
            codes: result.error.issues.slice(0, 5).map(issue => issue.code),
        });
        return { success: false, error: 'Validation Error: ' + result.error.issues
            .slice(0, 5).map(issue => issue.message.slice(0, 180)).join(', ') };
    }

    try {
        const output = await action(result.data);
        return { success: true, data: output };
    } catch (e: any) {
        console.error("Action Error:", e);
        try {
            await db.query(`INSERT INTO debug_logs (message) VALUES ($1)`, [`[SafeAction Error] ${e.message} \nStack: ${e.stack}`]);
        } catch (logErr) {
            console.error("Failed to log error to DB", logErr);
        }
        const databaseError = typeof e?.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code);
        return { success: false, error: databaseError || e instanceof SyntaxError
            ? 'An unexpected error occurred.'
            : e.message || "An unexpected error occurred." };
    }
}

export function successResponse<T>(data?: T, message?: string): ActionResponse<T> {
    return { success: true, data, message };
}

export function errorResponse<T>(error: string): ActionResponse<T> {
    return { success: false, error };
}
