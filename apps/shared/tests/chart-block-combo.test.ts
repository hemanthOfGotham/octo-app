import { describe, expect, it } from 'vitest';

import { buildStoryChartBlock } from '../src/chart-block';
import { parseChartBlock } from '../src/story-segments';
import { validateStoryCode } from '../src/story-validation';
import { InputSchema } from '../src/tools/display-chart';

function attrsOf(tag: string): string {
	return tag.match(/^<chart\s+([\s\S]*?)\s*\/?>$/)?.[1] ?? '';
}

describe('combo chart story round-trip', () => {
	const config = {
		query_id: 'q_1',
		chart_type: 'combo' as const,
		x_axis_key: 'month',
		x_axis_type: 'date' as const,
		series: [
			{ data_key: 'revenue', series_type: 'bar' as const, y_axis: 'left' as const },
			{ data_key: 'orders', series_type: 'line' as const, y_axis: 'right' as const },
		],
		y_axes: {
			left: { label: 'Revenue ($)' },
			right: { label: 'Orders', domain: { min: 0, max: 100 } as const },
		},
		title: 'Revenue vs orders',
	};

	it('is a valid display_chart input', () => {
		expect(InputSchema.safeParse(config).success).toBe(true);
	});

	it('serializes and parses back series_type, y_axis and y_axes', () => {
		const block = buildStoryChartBlock(config);
		const parsed = parseChartBlock(attrsOf(block));

		expect(parsed).not.toBeNull();
		expect(parsed?.chartType).toBe('combo');
		expect(parsed?.series).toEqual([
			{ data_key: 'revenue', series_type: 'bar', y_axis: 'left' },
			{ data_key: 'orders', series_type: 'line', y_axis: 'right' },
		]);
		expect(parsed?.yAxes).toEqual({
			left: { label: 'Revenue ($)' },
			right: { label: 'Orders', domain: { min: 0, max: 100 } },
		});
	});

	it('passes story validation for combo chart_type', () => {
		const block = buildStoryChartBlock(config);
		expect(validateStoryCode(block)).toEqual([]);
	});
});
