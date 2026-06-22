import type { FileTreeEntry } from '@nao/shared/types';
import fs from 'fs/promises';
import path from 'path';

import { shouldExcludeEntry } from '../utils/tools';

export async function getFileTree(projectFolder: string): Promise<FileTreeEntry[]> {
	return readDirectoryRecursive(projectFolder, projectFolder);
}

export async function readFileContent(filePath: string, projectFolder: string): Promise<string> {
	const realPath = resolveAndValidatePath(filePath, projectFolder);
	const stat = await fs.stat(realPath);

	const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
	if (stat.size > MAX_FILE_SIZE) {
		throw new Error('File is too large to display (max 1 MB)');
	}

	return fs.readFile(realPath, 'utf-8');
}

const MAX_WRITE_SIZE = 1024 * 1024; // 1 MB

/** Write (overwrite) a context file. Creates parent dirs as needed. */
export async function writeFileContent(filePath: string, projectFolder: string, content: string): Promise<void> {
	if (Buffer.byteLength(content, 'utf-8') > MAX_WRITE_SIZE) {
		throw new Error('File is too large to save (max 1 MB)');
	}
	const realPath = resolveAndValidatePath(filePath, projectFolder);
	await fs.mkdir(path.dirname(realPath), { recursive: true });
	await fs.writeFile(realPath, content, 'utf-8');
}

/** Create a new context file (fails if it already exists). */
export async function createFileEntry(filePath: string, projectFolder: string, content = ''): Promise<void> {
	const realPath = resolveAndValidatePath(filePath, projectFolder);
	await fs.mkdir(path.dirname(realPath), { recursive: true });
	await fs.writeFile(realPath, content, { encoding: 'utf-8', flag: 'wx' });
}

/** Delete a context file. */
export async function deleteFileEntry(filePath: string, projectFolder: string): Promise<void> {
	const realPath = resolveAndValidatePath(filePath, projectFolder);
	if (realPath === path.resolve(projectFolder)) {
		throw new Error('Refusing to delete the project root');
	}
	await fs.rm(realPath, { recursive: false });
}

async function readDirectoryRecursive(dirPath: string, projectFolder: string): Promise<FileTreeEntry[]> {
	const dirEntries = await fs.readdir(dirPath, { withFileTypes: true });

	const parentRelativePath = path.relative(projectFolder, dirPath);
	const filtered = dirEntries.filter((entry) => !shouldExcludeEntry(entry.name, parentRelativePath, projectFolder));

	const entries: FileTreeEntry[] = [];

	for (const entry of filtered) {
		const fullPath = path.join(dirPath, entry.name);
		const virtualPath = '/' + path.relative(projectFolder, fullPath);

		if (entry.isDirectory()) {
			const children = await readDirectoryRecursive(fullPath, projectFolder);
			entries.push({
				name: entry.name,
				path: virtualPath,
				type: 'directory',
				children,
			});
		} else if (entry.isFile()) {
			entries.push({
				name: entry.name,
				path: virtualPath,
				type: 'file',
			});
		}
	}

	entries.sort((a, b) => {
		if (a.type === b.type) {
			return a.name.localeCompare(b.name);
		}
		return a.type === 'directory' ? -1 : 1;
	});

	return entries;
}

function resolveAndValidatePath(virtualPath: string, projectFolder: string): string {
	const relativePath = virtualPath.startsWith('/') ? virtualPath.slice(1) : virtualPath;
	const resolvedPath = path.resolve(projectFolder, relativePath);

	const withinFolder = resolvedPath === projectFolder || resolvedPath.startsWith(projectFolder + path.sep);
	if (!withinFolder) {
		throw new Error(`Access denied: path is outside the project folder`);
	}

	return resolvedPath;
}
