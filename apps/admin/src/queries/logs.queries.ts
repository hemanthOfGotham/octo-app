import { db } from '@nao/backend/db';
import s from '@nao/backend/schema';
import { and, desc, eq, isNotNull, SQL } from 'drizzle-orm';

export interface AdminLog {
	id: string;
	level: string;
	message: string;
	source: string;
	context: Record<string, unknown> | null;
	projectId: string | null;
	projectName: string | null;
	orgId: string | null;
	orgName: string | null;
	createdAt: Date;
}

export interface LogQuery {
	level?: string;
	source?: string;
	projectId?: string;
	orgId?: string;
	limit: number;
}

export async function listLogs(query: LogQuery): Promise<AdminLog[]> {
	const conditions: SQL[] = [];
	if (query.level) {
		conditions.push(eq(s.log.level, query.level as (typeof s.log.level.enumValues)[number]));
	}
	if (query.source) {
		conditions.push(eq(s.log.source, query.source as (typeof s.log.source.enumValues)[number]));
	}
	if (query.projectId) {
		conditions.push(eq(s.log.projectId, query.projectId));
	}
	if (query.orgId) {
		conditions.push(eq(s.project.orgId, query.orgId));
	}

	return db
		.select({
			id: s.log.id,
			level: s.log.level,
			message: s.log.message,
			source: s.log.source,
			context: s.log.context,
			projectId: s.log.projectId,
			createdAt: s.log.createdAt,
			projectName: s.project.name,
			orgId: s.organization.id,
			orgName: s.organization.name,
		})
		.from(s.log)
		.leftJoin(s.project, eq(s.log.projectId, s.project.id))
		.leftJoin(s.organization, eq(s.project.orgId, s.organization.id))
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(s.log.createdAt))
		.limit(query.limit);
}

export type AdminErrorSource = 'message' | 'log' | 'activity' | 'job';

export interface AdminError {
	source: AdminErrorSource;
	level: string | null;
	message: string;
	projectId: string | null;
	projectName: string | null;
	orgId: string | null;
	orgName: string | null;
	userEmail: string | null;
	reference: string;
	createdAt: Date;
}

export interface ErrorQuery {
	projectId?: string;
	orgId?: string;
	limit: number;
}

/**
 * Errors live across several tables (failed messages/tools, error logs, failed
 * activities and scheduled jobs). This aggregates them into one timeline.
 */
export async function listErrors(query: ErrorQuery): Promise<AdminError[]> {
	const [messageErrors, logErrors, activityErrors, jobErrors] = await Promise.all([
		getMessageErrors(query),
		getLogErrors(query),
		getActivityErrors(query),
		getJobErrors(query),
	]);

	return [...messageErrors, ...logErrors, ...activityErrors, ...jobErrors]
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
		.slice(0, query.limit);
}

async function getMessageErrors(query: ErrorQuery): Promise<AdminError[]> {
	const conditions: SQL[] = [isNotNull(s.chatMessage.errorMessage)];
	if (query.projectId) {
		conditions.push(eq(s.project.id, query.projectId));
	}
	if (query.orgId) {
		conditions.push(eq(s.project.orgId, query.orgId));
	}

	const rows = await db
		.select({
			id: s.chatMessage.id,
			message: s.chatMessage.errorMessage,
			createdAt: s.chatMessage.createdAt,
			projectId: s.project.id,
			projectName: s.project.name,
			orgId: s.organization.id,
			orgName: s.organization.name,
			userEmail: s.user.email,
		})
		.from(s.chatMessage)
		.innerJoin(s.chat, eq(s.chatMessage.chatId, s.chat.id))
		.innerJoin(s.project, eq(s.chat.projectId, s.project.id))
		.leftJoin(s.organization, eq(s.project.orgId, s.organization.id))
		.leftJoin(s.user, eq(s.chat.userId, s.user.id))
		.where(and(...conditions))
		.orderBy(desc(s.chatMessage.createdAt))
		.limit(query.limit);

	return rows.map((row) => ({
		source: 'message' as const,
		level: 'error',
		message: row.message ?? '',
		projectId: row.projectId,
		projectName: row.projectName,
		orgId: row.orgId,
		orgName: row.orgName,
		userEmail: row.userEmail,
		reference: row.id,
		createdAt: row.createdAt,
	}));
}

async function getLogErrors(query: ErrorQuery): Promise<AdminError[]> {
	const conditions: SQL[] = [eq(s.log.level, 'error')];
	if (query.projectId) {
		conditions.push(eq(s.log.projectId, query.projectId));
	}
	if (query.orgId) {
		conditions.push(eq(s.project.orgId, query.orgId));
	}

	const rows = await db
		.select({
			id: s.log.id,
			message: s.log.message,
			createdAt: s.log.createdAt,
			projectId: s.log.projectId,
			projectName: s.project.name,
			orgId: s.organization.id,
			orgName: s.organization.name,
		})
		.from(s.log)
		.leftJoin(s.project, eq(s.log.projectId, s.project.id))
		.leftJoin(s.organization, eq(s.project.orgId, s.organization.id))
		.where(and(...conditions))
		.orderBy(desc(s.log.createdAt))
		.limit(query.limit);

	return rows.map((row) => ({
		source: 'log' as const,
		level: 'error',
		message: row.message,
		projectId: row.projectId,
		projectName: row.projectName,
		orgId: row.orgId,
		orgName: row.orgName,
		userEmail: null,
		reference: row.id,
		createdAt: row.createdAt,
	}));
}

async function getActivityErrors(query: ErrorQuery): Promise<AdminError[]> {
	const conditions: SQL[] = [isNotNull(s.activity.errorMessage)];
	if (query.projectId) {
		conditions.push(eq(s.activity.projectId, query.projectId));
	}
	if (query.orgId) {
		conditions.push(eq(s.project.orgId, query.orgId));
	}

	const rows = await db
		.select({
			id: s.activity.id,
			message: s.activity.errorMessage,
			createdAt: s.activity.startedAt,
			projectId: s.activity.projectId,
			projectName: s.project.name,
			orgId: s.organization.id,
			orgName: s.organization.name,
			userEmail: s.user.email,
		})
		.from(s.activity)
		.innerJoin(s.project, eq(s.activity.projectId, s.project.id))
		.leftJoin(s.organization, eq(s.project.orgId, s.organization.id))
		.leftJoin(s.user, eq(s.activity.userId, s.user.id))
		.where(and(...conditions))
		.orderBy(desc(s.activity.startedAt))
		.limit(query.limit);

	return rows.map((row) => ({
		source: 'activity' as const,
		level: 'error',
		message: row.message ?? '',
		projectId: row.projectId,
		projectName: row.projectName,
		orgId: row.orgId,
		orgName: row.orgName,
		userEmail: row.userEmail,
		reference: row.id,
		createdAt: row.createdAt,
	}));
}

async function getJobErrors(query: ErrorQuery): Promise<AdminError[]> {
	// Scheduled jobs are not scoped to a project/org, so skip them when filtering.
	if (query.projectId || query.orgId) {
		return [];
	}

	const rows = await db
		.select({
			id: s.scheduledJob.id,
			name: s.scheduledJob.name,
			message: s.scheduledJob.lastError,
			createdAt: s.scheduledJob.updatedAt,
		})
		.from(s.scheduledJob)
		.where(isNotNull(s.scheduledJob.lastError))
		.orderBy(desc(s.scheduledJob.updatedAt))
		.limit(query.limit);

	return rows.map((row) => ({
		source: 'job' as const,
		level: 'error',
		message: `[${row.name}] ${row.message ?? ''}`,
		projectId: null,
		projectName: null,
		orgId: null,
		orgName: null,
		userEmail: null,
		reference: row.id,
		createdAt: row.createdAt,
	}));
}
