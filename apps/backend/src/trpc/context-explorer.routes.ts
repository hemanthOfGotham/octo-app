import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
	createFileEntry,
	deleteFileEntry,
	getFileTree,
	readFileContent,
	writeFileContent,
} from '../services/context-explorer.service';
import { adminProtectedProcedure } from './trpc';

function requireProjectPath(path: string | null): string {
	if (!path) {
		throw new TRPCError({ code: 'BAD_REQUEST', message: 'No project path configured' });
	}
	return path;
}

export const contextExplorerRoutes = {
	getFileTree: adminProtectedProcedure.query(async ({ ctx }) => {
		const projectPath = requireProjectPath(ctx.project.path);
		return getFileTree(projectPath);
	}),

	readFile: adminProtectedProcedure.input(z.object({ path: z.string() })).query(async ({ ctx, input }) => {
		const projectPath = requireProjectPath(ctx.project.path);
		const content = await readFileContent(input.path, projectPath);
		return { content };
	}),

	// ── Live editing (writes to the context dir; needs a writable context, e.g. a
	//    mounted volume in local mode) ─────────────────────────────────────────
	writeFile: adminProtectedProcedure
		.input(z.object({ path: z.string(), content: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const projectPath = requireProjectPath(ctx.project.path);
			await writeFileContent(input.path, projectPath, input.content);
			return { ok: true };
		}),

	createFile: adminProtectedProcedure
		.input(z.object({ path: z.string(), content: z.string().default('') }))
		.mutation(async ({ ctx, input }) => {
			const projectPath = requireProjectPath(ctx.project.path);
			await createFileEntry(input.path, projectPath, input.content);
			return { ok: true };
		}),

	deleteFile: adminProtectedProcedure
		.input(z.object({ path: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const projectPath = requireProjectPath(ctx.project.path);
			await deleteFileEntry(input.path, projectPath);
			return { ok: true };
		}),
};
