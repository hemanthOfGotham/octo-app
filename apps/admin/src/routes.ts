import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { authenticate } from './auth';
import { adminConfig } from './env';
import { listErrors, listLogs } from './queries/logs.queries';
import { listOrgs } from './queries/orgs.queries';
import { getLiveStats, getStatsOverview } from './queries/stats.queries';
import { listUsers, setEmailVerified } from './queries/users.queries';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function parseLimit(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_LIMIT;
	}
	return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function registerRoutes(app: FastifyInstance): void {
	app.get('/api/health', async () => ({ ok: true, mode: adminConfig.naoMode, version: adminConfig.appVersion }));

	app.get('/api/stats', { preHandler: authenticate }, async () => getStatsOverview());

	app.get('/api/stats/stream', { preHandler: authenticate }, streamStats);

	app.get('/api/users', { preHandler: authenticate }, async (request) => {
		const query = request.query as Record<string, unknown>;
		return listUsers({ search: asString(query.search), limit: parseLimit(query.limit) });
	});

	app.post('/api/users/:id/email-verification', { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string };
		const body = (request.body ?? {}) as { verified?: unknown };
		const verified = body.verified !== false;

		const user = await setEmailVerified(id, verified);
		if (!user) {
			return reply.code(404).send({ error: 'User not found.' });
		}
		return user;
	});

	app.get('/api/orgs', { preHandler: authenticate }, async (request) => {
		const query = request.query as Record<string, unknown>;
		return listOrgs(parseLimit(query.limit));
	});

	app.get('/api/logs', { preHandler: authenticate }, async (request) => {
		const query = request.query as Record<string, unknown>;
		return listLogs({
			level: asString(query.level),
			source: asString(query.source),
			projectId: asString(query.projectId),
			orgId: asString(query.orgId),
			limit: parseLimit(query.limit),
		});
	});

	app.get('/api/errors', { preHandler: authenticate }, async (request) => {
		const query = request.query as Record<string, unknown>;
		return listErrors({
			projectId: asString(query.projectId),
			orgId: asString(query.orgId),
			limit: parseLimit(query.limit),
		});
	});
}

async function streamStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	reply.raw.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
	});
	reply.hijack();

	let closed = false;
	const send = async () => {
		if (closed) {
			return;
		}
		try {
			const stats = await getLiveStats();
			reply.raw.write(`data: ${JSON.stringify(stats)}\n\n`);
		} catch (error) {
			request.log.error(error, 'Failed to stream stats');
		}
	};

	await send();
	const interval = setInterval(send, 5000);

	request.raw.on('close', () => {
		closed = true;
		clearInterval(interval);
	});
}
