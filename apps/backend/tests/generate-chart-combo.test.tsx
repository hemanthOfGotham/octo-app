import { describe, expect, it } from 'vitest';

import type { RenderChartInput } from '../src/components/generate-chart';
import { renderChartToSvg } from '../src/components/generate-chart';

const data = [
	{ month: '2024-01-01', revenue: 1000, orders: 12 },
	{ month: '2024-02-01', revenue: 1500, orders: 18 },
	{ month: '2024-03-01', revenue: 1200, orders: 9 },
];

function comboConfig(overrides: Partial<RenderChartInput['config']> = {}): RenderChartInput['config'] {
	return {
		chart_type: 'combo',
		x_axis_key: 'month',
		x_axis_type: 'date',
		title: 'Revenue vs orders',
		series: [
			{ data_key: 'revenue', series_type: 'bar', y_axis: 'left' },
			{ data_key: 'orders', series_type: 'line', y_axis: 'right' },
		],
		...overrides,
	};
}

describe('renderChartToSvg (combo)', () => {
	it('renders mixed bar + line series', () => {
		const svg = renderChartToSvg({ config: comboConfig(), data });

		expect(svg).toContain('recharts-bar');
		expect(svg).toContain('recharts-line');
	});

	it('renders a second Y-axis when a series uses the right axis', () => {
		const svg = renderChartToSvg({ config: comboConfig(), data });
		const yAxes = svg.match(/recharts-yAxis/g) ?? [];
		expect(yAxes.length).toBeGreaterThanOrEqual(2);
	});

	it('renders a single Y-axis when all series use the left axis', () => {
		const svg = renderChartToSvg({
			config: comboConfig({
				series: [
					{ data_key: 'revenue', series_type: 'bar', y_axis: 'left' },
					{ data_key: 'orders', series_type: 'line', y_axis: 'left' },
				],
			}),
			data,
		});
		const yAxes = svg.match(/recharts-yAxis/g) ?? [];
		expect(yAxes.length).toBe(1);
	});

	it('renders axis labels from y_axes config', () => {
		const svg = renderChartToSvg({
			config: comboConfig({
				y_axes: {
					left: { label: 'Revenue USD' },
					right: { label: 'Order count' },
				},
			}),
			data,
		});

		expect(svg).toContain('Revenue USD');
		expect(svg).toContain('Order count');
	});

	it('renders an area series in a combo chart', () => {
		const svg = renderChartToSvg({
			config: comboConfig({
				series: [
					{ data_key: 'revenue', series_type: 'bar', y_axis: 'left' },
					{ data_key: 'orders', series_type: 'area', y_axis: 'right' },
				],
			}),
			data,
		});

		expect(svg).toContain('recharts-bar');
		expect(svg).toContain('recharts-area');
	});
});
