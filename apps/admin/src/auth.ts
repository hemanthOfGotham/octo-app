import { timingSafeEqual } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { adminConfig } from './env';

function extractToken(request: FastifyRequest): string | undefined {
	const header = request.headers['authorization'];
	if (typeof header === 'string' && header.startsWith('Bearer ')) {
		return header.slice('Bearer '.length).trim();
	}
	const queryToken = (request.query as { token?: unknown } | undefined)?.token;
	if (typeof queryToken === 'string' && queryToken.length > 0) {
		return queryToken;
	}
	return undefined;
}

function tokensMatch(provided: string, expected: string): boolean {
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	if (a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(a, b);
}

/** PreHandler guarding every admin endpoint with the configured bearer token. */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const expected = adminConfig.token;
	if (!expected) {
		reply.code(503).send({ error: 'Admin token is not configured.' });
		return;
	}

	const provided = extractToken(request);
	if (!provided || !tokensMatch(provided, expected)) {
		reply.code(401).send({ error: 'Unauthorized.' });
		return;
	}
}
