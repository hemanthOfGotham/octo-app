import { readFileSync } from 'node:fs';
import path from 'node:path';

import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';

import { registerRoutes } from './routes';

function loadDashboardHtml(): string {
	const htmlPath = path.join(import.meta.dirname, '..', 'public', 'index.html');
	return readFileSync(htmlPath, 'utf-8');
}

export function buildServer(): FastifyInstance {
	const app = Fastify({ logger: true });

	const dashboardHtml = loadDashboardHtml();
	const serveDashboard = async (_request: unknown, reply: FastifyReply) =>
		reply.type('text/html').send(dashboardHtml);

	app.get('/', serveDashboard);
	app.get('/admin', serveDashboard);

	registerRoutes(app);

	return app;
}
