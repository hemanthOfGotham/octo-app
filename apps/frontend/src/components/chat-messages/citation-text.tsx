import { memo } from 'react';
import { Streamdown } from 'streamdown';

import { CITATION_TAG_REGEX } from '@nao/shared';

import { CitationPopover } from '@/components/citation-popover';
import { MarkdownTable } from '@/components/chat-messages/markdown-table';
import { HtmlArtifact } from '@/components/html-artifact';
import { markdownPlugins } from '@/lib/markdown';

function CodeRenderer({ className, children, inline }: any) {
	const lang = /language-(\w+)/.exec(className || '')?.[1];
	if (!inline && (lang === 'html' || lang === 'htm')) {
		return <HtmlArtifact html={String(children ?? '')} />;
	}
	return <code className={className}>{children}</code>;
}

const CLOBBER_PREFIX = 'user-content-';

function stripClobberPrefix(value: string): string {
	return value.startsWith(CLOBBER_PREFIX) ? value.slice(CLOBBER_PREFIX.length) : value;
}

export const AssistantTextWithCitation = memo(({ text, isStreaming }: { text: string; isStreaming: boolean }) => {
	if (isStreaming) {
		const strippedText = text.replace(CITATION_TAG_REGEX, '');
		return (
			<Streamdown
				isAnimating
				mode='streaming'
				plugins={markdownPlugins}
				components={{
					table: ({ node, className }: any) => <MarkdownTable node={node} className={className} />,
					code: CodeRenderer,
				}}
			>
				{strippedText}
			</Streamdown>
		);
	}

	return (
		<Streamdown
			plugins={markdownPlugins}
			allowedTags={{
				'citation-number': ['id', 'column'],
			}}
			literalTagContent={['citation-number']}
			components={{
				table: ({ node, className }: any) => <MarkdownTable node={node} className={className} />,
				code: CodeRenderer,
					'citation-number': ({ id, column, children }: any) => {
					return (
						<span className='inline-block align-baseline mx-1'>
							<CitationPopover
								value={String(children)}
								queryId={stripClobberPrefix(String(id))}
								column={String(column)}
							/>
						</span>
					);
				},
			}}
		>
			{text}
		</Streamdown>
	);
});
