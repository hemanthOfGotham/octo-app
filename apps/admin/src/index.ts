import { randomBytes } from 'node:crypto';

import { adminConfig, isCloud } from './env';
import { buildServer } from './server';

async function main(): Promise<void> {
	// The back office is a nao cloud feature. Refuse to start in any other
	// deploy mode so it can never leak in self-hosted/local deployments.
	if (!isCloud) {
		console.log(
			`[admin] nao back office is disabled (NAO_MODE=${adminConfig.naoMode}). It only runs when NAO_MODE=cloud.`,
		);
		return;
	}

	if (!adminConfig.token) {
		adminConfig.token = randomBytes(24).toString('hex');
		console.warn('[admin] ADMIN_TOKEN is not set — generated an ephemeral token for this session:');
		console.warn(`[admin]   ADMIN_TOKEN=${adminConfig.token}`);
		console.warn('[admin] Set ADMIN_TOKEN in the environment for a stable login.');
	}

	const app = buildServer();
	await app.listen({ host: adminConfig.host, port: adminConfig.port });
}

main().catch((error) => {
	console.error('[admin] Failed to start nao back office:', error);
	process.exit(1);
});
