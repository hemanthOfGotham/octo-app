import z from 'zod/v3';

export const ChartTypeEnum = z.enum([
	'bar',
	'stacked_bar',
	'line',
	'area',
	'stacked_area',
	'pie',
	'kpi_card',
	'scatter',
	'radar',
	'combo',
]);

export const XAxisTypeEnum = z.enum(['date', 'number', 'category']);

export const SeriesTypeEnum = z.enum(['bar', 'line', 'area']);

export const YAxisSideEnum = z.enum(['left', 'right']);

export const SeriesConfigSchema = z.object({
	data_key: z.string().describe('Column name from SQL result to plot.'),
	color: z.string().describe('CSS color (defaults to theme colors).').optional(),
	label: z.string().describe('Label to display in the legend.').optional(),
	series_type: SeriesTypeEnum.describe(
		'For "combo" charts only: how to render this series ("bar", "line", or "area"). Defaults to "bar".',
	).optional(),
	y_axis: YAxisSideEnum.describe(
		'Which Y-axis this series is plotted against ("left" or "right"). Defaults to "left". A right axis is drawn whenever any series uses "right".',
	).optional(),
});

export const YAxisDomainSchema = z
	.union([
		z.literal('auto'),
		z.object({
			min: z.number().describe('Minimum value of the axis scale.'),
			max: z.number().describe('Maximum value of the axis scale.'),
		}),
	])
	.describe('Axis scale: "auto" to fit the data, or an explicit { min, max } range.');

export const YAxisConfigSchema = z.object({
	label: z.string().describe('Label displayed alongside this Y-axis.').optional(),
	domain: YAxisDomainSchema.optional(),
});

export const YAxesConfigSchema = z
	.object({
		left: YAxisConfigSchema.optional(),
		right: YAxisConfigSchema.optional(),
	})
	.describe('Optional independent configuration (label, scale) for the left and right Y-axes.');

export const InputSchema = z.object({
	query_id: z.string().describe("The id of a previous `execute_sql` tool call's output to get data from."),
	chart_type: ChartTypeEnum.describe('Type of chart to display.'),
	x_axis_key: z.string().describe('Column name for X-axis/category labels.'),
	x_axis_type: XAxisTypeEnum.nullable().describe(
		'Use "date" only when x-axis values parse as JS Date (YYYY-MM-DD). Use "category" for quarter_ending, fiscal periods, or labels. Use "number" for numeric x-axis.',
	),
	series: z
		.array(SeriesConfigSchema)
		.min(1)
		.describe('Columns to plot as data series (at least one series required).'),
	y_axes: YAxesConfigSchema.optional(),
	title: z
		.string()
		.describe(
			'A concise and descriptive title of what the chart shows. Do not include the type of chart in the title or other chart configurations.',
		),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.boolean(),
	error: z.string().optional(),
});

export type ChartType = z.infer<typeof ChartTypeEnum>;
export type XAxisType = z.infer<typeof XAxisTypeEnum>;
export type SeriesType = z.infer<typeof SeriesTypeEnum>;
export type YAxisSide = z.infer<typeof YAxisSideEnum>;
export type SeriesConfig = z.infer<typeof SeriesConfigSchema>;
export type YAxisDomain = z.infer<typeof YAxisDomainSchema>;
export type YAxisConfig = z.infer<typeof YAxisConfigSchema>;
export type YAxesConfig = z.infer<typeof YAxesConfigSchema>;
export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
