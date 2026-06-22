import { useEffect, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { File, Save, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useEditorTheme } from '@/hooks/use-editor-theme';
import { trpc } from '@/main';

interface FileViewerProps {
	filePath: string | null;
	content: string | undefined;
	isLoading: boolean;
	isError: boolean;
	onDeleted?: (path: string) => void;
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
	'.ts': 'typescript',
	'.tsx': 'typescript',
	'.js': 'javascript',
	'.jsx': 'javascript',
	'.json': 'json',
	'.md': 'markdown',
	'.yaml': 'yaml',
	'.yml': 'yaml',
	'.sql': 'sql',
	'.py': 'python',
	'.html': 'html',
	'.css': 'css',
	'.xml': 'xml',
	'.sh': 'shell',
	'.bash': 'shell',
	'.toml': 'ini',
	'.ini': 'ini',
	'.env': 'dotenv',
	'.txt': 'plaintext',
	'.csv': 'plaintext',
};

function getLanguageFromPath(filePath: string): string {
	const dotIndex = filePath.lastIndexOf('.');
	if (dotIndex === -1) {
		return 'plaintext';
	}
	const ext = filePath.slice(dotIndex).toLowerCase();
	return EXTENSION_LANGUAGE_MAP[ext] ?? 'plaintext';
}

function getFileName(filePath: string): string {
	return filePath.split('/').pop() ?? filePath;
}

function defineCustomThemes(monaco: Monaco) {
	monaco.editor.defineTheme('nao-light', {
		base: 'vs',
		inherit: true,
		rules: [],
		colors: {
			'editor.lineHighlightBackground': '#00000008',
			'editor.lineHighlightBorder': '#00000000',
		},
	});
	monaco.editor.defineTheme('nao-dark', {
		base: 'vs-dark',
		inherit: true,
		rules: [],
		colors: {
			'editor.lineHighlightBackground': '#ffffff06',
			'editor.lineHighlightBorder': '#00000000',
		},
	});
}

export function FileViewer({ filePath, content, isLoading, isError, onDeleted }: FileViewerProps) {
	const editorTheme = useEditorTheme();
	const themeName = editorTheme === 'vs-dark' ? 'nao-dark' : 'nao-light';
	const queryClient = useQueryClient();

	// Local editable draft; reset whenever the loaded file/content changes.
	const [draft, setDraft] = useState<string>(content ?? '');
	useEffect(() => {
		setDraft(content ?? '');
	}, [content, filePath]);
	const dirty = filePath != null && draft !== (content ?? '');

	const [error, setError] = useState<string | null>(null);

	const writeMutation = useMutation(
		trpc.contextExplorer.writeFile.mutationOptions({
			onSuccess: async () => {
				setError(null);
				if (filePath) {
					await queryClient.invalidateQueries(trpc.contextExplorer.readFile.queryOptions({ path: filePath }));
				}
			},
			onError: (e) => setError(`Save failed: ${e.message}`),
		}),
	);
	const deleteMutation = useMutation(
		trpc.contextExplorer.deleteFile.mutationOptions({
			onSuccess: async () => {
				setError(null);
				await queryClient.invalidateQueries(trpc.contextExplorer.getFileTree.queryOptions());
				if (filePath) onDeleted?.(filePath);
			},
			onError: (e) => setError(`Delete failed: ${e.message}`),
		}),
	);

	const save = () => {
		if (filePath && dirty) writeMutation.mutate({ path: filePath, content: draft });
	};

	const handleBeforeMount = (monaco: Monaco) => {
		defineCustomThemes(monaco);
	};

	const handleMount = (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
		editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save());
	};

	if (!filePath) {
		return (
			<div className='flex flex-col items-center justify-center h-full text-muted-foreground gap-2'>
				<File className='size-10 opacity-20' />
				<p className='text-sm'>Select a file to edit, or create a new one</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className='flex items-center justify-center h-full'>
				<Spinner />
			</div>
		);
	}

	if (isError) {
		return (
			<div className='flex flex-col items-center justify-center h-full text-muted-foreground gap-2'>
				<p className='text-sm'>Failed to load file</p>
			</div>
		);
	}

	const language = getLanguageFromPath(filePath);
	const fileName = getFileName(filePath);

	return (
		<div className='flex flex-col h-full'>
			<div className='flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 text-sm text-muted-foreground shrink-0'>
				<File className='size-3.5' />
				<span className='font-mono truncate'>{fileName}</span>
				{dirty && <span className='text-xs text-amber-500'>● unsaved</span>}
				{error && <span className='text-xs text-red-500 truncate max-w-xs'>{error}</span>}
				<span className='text-xs opacity-60 ml-2 truncate hidden md:inline'>{filePath}</span>
				<div className='ml-auto flex items-center gap-2'>
					<Button
						size='sm'
						onClick={save}
						disabled={!dirty || writeMutation.isPending}
					>
						<Save className='size-3.5 mr-1' />
						{writeMutation.isPending ? 'Saving…' : 'Save'}
					</Button>
					<Button
						size='sm'
						variant='outline'
						onClick={() => {
							if (filePath && confirm(`Delete ${fileName}?`)) deleteMutation.mutate({ path: filePath });
						}}
						disabled={deleteMutation.isPending}
					>
						<Trash2 className='size-3.5' />
					</Button>
				</div>
			</div>
			<div className='flex-1 min-h-0'>
				<Editor
					path={filePath}
					value={draft}
					onChange={(v) => setDraft(v ?? '')}
					language={language}
					theme={themeName}
					beforeMount={handleBeforeMount}
					onMount={handleMount}
					options={{
						readOnly: false,
						minimap: { enabled: false },
						scrollBeyondLastLine: false,
						fontSize: 13,
						lineNumbers: 'on',
						renderLineHighlight: 'line',
						padding: { top: 8, bottom: 8 },
						wordWrap: 'on',
					}}
				/>
			</div>
		</div>
	);
}
