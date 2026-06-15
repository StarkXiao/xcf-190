export { ChartEditor } from './ChartEditor';
export { EditorStateManager } from './EditorState';
export { Timeline } from './components/Timeline';
export { Preview } from './components/Preview';
export { PropertyPanel } from './components/PropertyPanel';
export * from './types';
export * from './utils/chartUtils';

import { ChartEditor } from './ChartEditor';
import { sampleChart } from '../data/sampleChart';

declare global {
  interface Window {
    __editorTimeline?: any;
  }
}

let chartEditorInstance: ChartEditor | null = null;

export const createChartEditor = (
  container: HTMLElement,
  options?: { width?: number; height?: number; initialChart?: any }
): ChartEditor => {
  if (chartEditorInstance) {
    chartEditorInstance.destroy();
  }
  
  chartEditorInstance = new ChartEditor(container, {
    width: options?.width || 1400,
    height: options?.height || 700,
    initialChart: options?.initialChart || sampleChart
  });
  
  return chartEditorInstance;
};

export const destroyChartEditor = (): void => {
  if (chartEditorInstance) {
    chartEditorInstance.destroy();
    chartEditorInstance = null;
  }
};

export const getChartEditorInstance = (): ChartEditor | null => {
  return chartEditorInstance;
};
