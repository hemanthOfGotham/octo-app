import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus } from 'lucide-react';

import { FileTree } from '@/components/settings/file-tree';
import { FileViewer } from '@/components/settings/file-viewer';
import { Button } from '@/components/ui/button';
import { ResizablePanel, ResizablePanelGroup, ResizableSeparator } from '@/components/ui/resizable';
import { Spinner } from '@/components/ui/spinner';
import { requireAdmin } from '@/lib/require-admin';
import { trpc } from '@/main';

export const Route = createFileRoute('/_sidebar-layout/settings/context-explorer')({
	beforeLoad: requireAdmin,
	component: ContextExplorerPage,
});

function ContextExplorerPage() {
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const createMutation = useMutation(
		trpc.contextExplorer.createFile.mutationOptions({
			onSuccess: async (_d, vars) => {
				await queryClient.invalidateQueries(trpc.contextExplorer.getFileTree.queryOptions());
				setSelectedPath(vars.path);
			},
			onError: (e) => alert(`Create failed: ${e.message}`),
		}),
	);

	const newFile = () => {
		const input = prompt(
			'New file path (relative to context root).\nExamples:\n  agent/skills/my-skill.md\n  databases/notes.md',
		);
		if (!input) return;
		const path = input.startsWith('/') ? input : '/' + input;
		createMutation.mutate({ path, content: '' });
	};

	const fileTree = useQuery(trpc.contextExplorer.getFileTree.queryOptions());
	const fileContent = useQuery({
		...trpc.contextExplorer.readFile.queryOptions({ path: selectedPath! }),
		enabled: !!selectedPath,
	});

	return (
		<div className='flex flex-col flex-1 overflow-hidden'>
			<ResizablePanelGroup
				orientation='horizontal'
				className='flex-1 min-h-0'
				defaultLayout={{ tree: 1, viewer: 5 }}
			>
				<ResizablePanel id='tree' minSize={180}>
					<div className='h-full overflow-hidden bg-card flex flex-col'>
						<div className='flex items-center justify-between px-3 py-2 border-b border-border shrink-0'>
							<span className='text-xs font-medium text-muted-foreground'>Context files</span>
							<Button variant='ghost' size='sm' onClick={newFile} title='New file'>
								<FilePlus className='size-4' />
							</Button>
						</div>
						{fileTree.isLoading ? (
							<div className='flex items-center justify-center h-32'>
								<Spinner />
							</div>
						) : fileTree.isError ? (
							<div className='flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2'>
								<p>Failed to load files</p>
								<Button variant='outline' size='sm' onClick={() => fileTree.refetch()}>
									Retry
								</Button>
							</div>
						) : (
							<FileTree
								entries={fileTree.data ?? []}
								selectedPath={selectedPath}
								onSelectFile={setSelectedPath}
							/>
						)}
					</div>
				</ResizablePanel>

				<ResizableSeparator />

				<ResizablePanel id='viewer' minSize={300}>
					<div className='h-full bg-background'>
						<FileViewer
							filePath={selectedPath}
							content={fileContent.data?.content}
							isLoading={fileContent.isLoading && fileContent.fetchStatus !== 'idle'}
							isError={fileContent.isError}
							onDeleted={() => setSelectedPath(null)}
						/>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
