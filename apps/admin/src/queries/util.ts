import { db } from '@nao/backend/db';
import { count, SQL } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number): Date {
	return new Date(Date.now() - days * DAY_MS);
}

export function startOfUtcDay(date: Date): Date {
	const copy = new Date(date);
	copy.setUTCHours(0, 0, 0, 0);
	return copy;
}

/** Count rows in a table with an optional filter, dialect-agnostic. */
export async function countRows(table: SQLiteTable, where?: SQL): Promise<number> {
	const [row] = await db.select({ value: count() }).from(table).where(where);
	return row?.value ?? 0;
}
