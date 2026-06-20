import { db } from '@nao/backend/db';
import s from '@nao/backend/schema';
import { and, countDistinct, eq, gte, isNotNull, lt } from 'drizzle-orm';

import { countRows, DAY_MS, daysAgo, startOfUtcDay } from './util';

export interface LiveStats {
	users: { total: number; verified: number; unverified: number };
	organizations: number;
	projects: number;
	chats: number;
	messages: { total: number; last24h: number; last7d: number };
	activeUsers24h: number;
	newUsers24h: number;
	errors24h: number;
	generatedAt: string;
}

export interface StatsTimeseriesPoint {
	date: string;
	messages: number;
	newUsers: number;
}

export interface StatsOverview extends LiveStats {
	series: StatsTimeseriesPoint[];
}

/** Lightweight counters refreshed in real time over SSE. */
export async function getLiveStats(): Promise<LiveStats> {
	const since24h = daysAgo(1);
	const since7d = daysAgo(7);

	const [totalUsers, verifiedUsers, organizations, projects, chats, totalMessages, messages24h, messages7d] =
		await Promise.all([
			countRows(s.user),
			countRows(s.user, eq(s.user.emailVerified, true)),
			countRows(s.organization),
			countRows(s.project),
			countRows(s.chat),
			countRows(s.chatMessage),
			countRows(s.chatMessage, gte(s.chatMessage.createdAt, since24h)),
			countRows(s.chatMessage, gte(s.chatMessage.createdAt, since7d)),
		]);

	const [errorMessages24h, errorLogs24h, activeUsers24h, newUsers24h] = await Promise.all([
		countRows(s.chatMessage, and(isNotNull(s.chatMessage.errorMessage), gte(s.chatMessage.createdAt, since24h))),
		countRows(s.log, and(eq(s.log.level, 'error'), gte(s.log.createdAt, since24h))),
		getActiveUserCount(since24h),
		countRows(s.user, gte(s.user.createdAt, since24h)),
	]);

	return {
		users: { total: totalUsers, verified: verifiedUsers, unverified: totalUsers - verifiedUsers },
		organizations,
		projects,
		chats,
		messages: { total: totalMessages, last24h: messages24h, last7d: messages7d },
		activeUsers24h,
		newUsers24h,
		errors24h: errorMessages24h + errorLogs24h,
		generatedAt: new Date().toISOString(),
	};
}

export async function getStatsOverview(): Promise<StatsOverview> {
	const [live, series] = await Promise.all([getLiveStats(), getMessageTimeseries(7)]);
	return { ...live, series };
}

async function getActiveUserCount(since: Date): Promise<number> {
	const [row] = await db
		.select({ value: countDistinct(s.chat.userId) })
		.from(s.chatMessage)
		.innerJoin(s.chat, eq(s.chatMessage.chatId, s.chat.id))
		.where(gte(s.chatMessage.createdAt, since));
	return row?.value ?? 0;
}

async function getMessageTimeseries(days: number): Promise<StatsTimeseriesPoint[]> {
	const points = await Promise.all(
		Array.from({ length: days }, (_, offset) => {
			const dayIndex = days - 1 - offset;
			const start = startOfUtcDay(daysAgo(dayIndex));
			const end = new Date(start.getTime() + DAY_MS);
			return getDayCounts(start, end);
		}),
	);
	return points;
}

async function getDayCounts(start: Date, end: Date): Promise<StatsTimeseriesPoint> {
	const [messages, newUsers] = await Promise.all([
		countRows(s.chatMessage, and(gte(s.chatMessage.createdAt, start), lt(s.chatMessage.createdAt, end))),
		countRows(s.user, and(gte(s.user.createdAt, start), lt(s.user.createdAt, end))),
	]);
	return { date: start.toISOString().slice(0, 10), messages, newUsers };
}
