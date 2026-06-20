import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import type { Provider } from '../types/messaging-provider';

/** Folder in the project context repo that holds per-surface system prompt overrides. */
const PROMPTS_FOLDER = ['agent', 'prompts'];

/** Filename used to override every surface (including the nao web Bot). */
const DEFAULT_PROMPT_FILE = 'system.md';

/**
 * Resolves the filename that overrides a given bot surface. The nao web Bot (no
 * messaging provider) is driven by `system.md`; messaging surfaces use their own
 * file (e.g. `slack.md`) and otherwise fall back to `system.md`.
 */
function getPromptFileCandidates(provider?: Provider): string[] {
	if (!provider) {
		return [DEFAULT_PROMPT_FILE];
	}
	return [`${provider}.md`, DEFAULT_PROMPT_FILE];
}

/**
 * Reads a user-defined system prompt override from `agent/prompts/` for the given
 * surface, or returns `undefined` when none is configured.
 *
 * When present, the file fully replaces the bundled product prompt for that surface,
 * letting data teams version and review bot behavior alongside the rest of the context.
 * `system.md` acts as a global override applied to every surface; a surface-specific
 * file (e.g. `slack.md`) takes precedence over it.
 */
export function getSystemPromptOverride(projectFolder: string, provider?: Provider): string | undefined {
	for (const filename of getPromptFileCandidates(provider)) {
		const content = readPromptFile(projectFolder, filename);
		if (content) {
			return content;
		}
	}
	return undefined;
}

function readPromptFile(projectFolder: string, filename: string): string | undefined {
	const filePath = join(projectFolder, ...PROMPTS_FOLDER, filename);
	if (!existsSync(filePath)) {
		return undefined;
	}

	try {
		const content = readFileSync(filePath, 'utf-8').trim();
		return content.length > 0 ? content : undefined;
	} catch (error) {
		console.error(`Error reading system prompt override ${filename}:`, error);
		return undefined;
	}
}
