/**
 * PostgreSQL Database Connection Module
 * 
 * Provides a connection pool for the Solo Leveling System.
 * Uses node-postgres (pg) for direct database access.
 * 
 * Configuration via environment variables:
 *   - POSTGRES_HOST: Database host (e.g., 192.168.1.99)
 *   - POSTGRES_PORT: Database port (default: 5432)
 *   - POSTGRES_DATABASE: Database name (e.g., solo_leveling_system)
 *   - POSTGRES_USER: Database user
 *   - POSTGRES_PASSWORD: Database password
 */

import { Pool, QueryResult, PoolClient, QueryResultRow } from 'pg';

// Validate required environment variables at module load
const requiredEnvVars = ['POSTGRES_HOST', 'POSTGRES_DATABASE', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.warn(`[DB] Warning: ${envVar} is not set`);
    }
}

// Create connection pool with optimized settings
const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,

    // Connection pool settings optimized for Next.js serverless-like environment
    max: 20,                    // Maximum connections in pool
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Timeout for new connections
});

// Log pool errors
pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err);
});

/**
 * Database interface with query helper methods
 */
export const db = {
    /**
     * Execute a parameterized query
     * @param text SQL query string with $1, $2... placeholders
     * @param params Array of parameter values
     * @returns Query result with rows
     */
    query: <T extends QueryResultRow = any>(
        text: string,
        params?: any[]
    ): Promise<QueryResult<T>> => {
        return pool.query<T>(text, params);
    },

    /**
     * Get a client from the pool for transaction support
     * Remember to release the client after use!
     */
    getClient: (): Promise<PoolClient> => {
        return pool.connect();
    },

    /**
     * Execute multiple queries in a transaction
     * @param callback Function that receives a client and executes queries
     * @returns Result of the callback
     */
    transaction: async <T>(
        callback: (client: PoolClient) => Promise<T>
    ): Promise<T> => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get a single row or null
     * @param text SQL query
     * @param params Query parameters
     * @returns First row or null
     */
    queryOne: async <T extends QueryResultRow = any>(
        text: string,
        params?: (string | number | boolean | null | Date | undefined)[]
    ): Promise<T | null> => {
        const result = await pool.query<T>(text, params);
        return result.rows[0] || null;
    },

    /**
     * Check if the database connection is healthy
     */
    healthCheck: async (): Promise<boolean> => {
        try {
            await pool.query('SELECT 1');
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Close all connections (for graceful shutdown)
     */
    end: (): Promise<void> => {
        return pool.end();
    }
};

export default db;
