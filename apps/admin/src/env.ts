import path from 'node:path';

import dotenv from 'dotenv';

// Mirror the backend: load the repo-root .env so the admin app picks up the
// same configuration when run as a workspace (cwd = apps/admin). In Docker the
// variables are injected directly into the environment and this is a no-op.
dotenv.config({
	path: path.join(process.cwd(), '..', '..', '.env'),
});

const naoMode = process.env.NAO_MODE === 'cloud' ? 'cloud' : 'self-hosted';

/** The back office is a nao cloud feature and must never run in other modes. */
export const isCloud = naoMode === 'cloud';

export const adminConfig = {
	naoMode,
	host: process.env.ADMIN_HOST ?? '0.0.0.0',
	port: Number(process.env.ADMIN_PORT ?? 5006),
	/**
	 * Bearer token guarding every admin endpoint. When unset the server
	 * generates an ephemeral one at startup and logs it, so the dashboard is
	 * never left publicly accessible.
	 */
	token: process.env.ADMIN_TOKEN?.trim() || undefined,
	appVersion: process.env.APP_VERSION ?? 'dev',
};
