import type { OledWidgetDef } from './types';
import {
	recessedBar,
	gradientBar,
	chunkyRetroBar,
	notchedBar,
	cellSignal,
	ledStrip,
	diagnosticBar,
	biDiagnosticBar,
	equalizerBar,
} from './bars';

const ALL_WIDGETS: OledWidgetDef[] = [
	recessedBar,
	gradientBar,
	chunkyRetroBar,
	notchedBar,
	cellSignal,
	ledStrip,
	diagnosticBar,
	biDiagnosticBar,
	equalizerBar,
];

const widgetMap = new Map<string, OledWidgetDef>(ALL_WIDGETS.map((w) => [w.id, w]));

export function getWidget(id: string): OledWidgetDef | undefined {
	return widgetMap.get(id);
}

export function listWidgets(category?: OledWidgetDef['category']): OledWidgetDef[] {
	if (!category) return ALL_WIDGETS;
	return ALL_WIDGETS.filter((w) => w.category === category);
}

export function listCategories(): OledWidgetDef['category'][] {
	return [...new Set(ALL_WIDGETS.map((w) => w.category))];
}

export const CATEGORY_LABELS: Record<OledWidgetDef['category'], string> = {
	bar: 'Bars & Sliders',
	indicator: 'Indicators',
	diagnostic: 'Diagnostics',
	decorative: 'Decorative',
};
