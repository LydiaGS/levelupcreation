import React, { useState, useRef, useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// ========== TYPES ==========
type Tool = 'select' | 'postit' | 'text' | 'shape' | 'arrow' | 'line' | 'image' | 'icon' | 'code' | 'pan';
type ShapeType = 'rectangle' | 'square' | 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'star' | 'rounded-rect';
type IconType = 'idea' | 'warning' | 'success' | 'error' | 'info' | 'question' | 'star' | 'heart' | 'flag' | 'bookmark' | 'clock' | 'user' | 'check' | 'x' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'rocket' | 'target' | 'trophy' | 'fire' | 'bolt' | 'thumbs-up' | 'thumbs-down';
type LineStyle = 'solid' | 'dashed' | 'dotted';
type ArrowHead = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond';
type CodeLanguage = 'javascript' | 'typescript' | 'html' | 'css' | 'react' | 'python' | 'java' | 'csharp' | 'php' | 'ruby' | 'go' | 'rust' | 'sql' | 'json' | 'bash';

interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  groupId?: string;
}

interface PostItElement extends BaseElement {
  type: 'postit';
  content: string;
  color: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}

interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}

interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

interface ArrowElement extends BaseElement {
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  startHead: ArrowHead;
  endHead: ArrowHead;
}

interface LineElement extends BaseElement {
  type: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  strokeWidth: number;
  lineStyle: LineStyle;
}

interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
}

interface IconElement extends BaseElement {
  type: 'icon';
  iconType: IconType;
  color: string;
  size: number;
}

interface CodeElement extends BaseElement {
  type: 'code';
  content: string;
  language: CodeLanguage;
  fontSize: number;
}

interface GroupElement extends BaseElement {
  type: 'group';
  childIds: string[];
}

type CanvasElement = PostItElement | TextElement | ShapeElement | ArrowElement | LineElement | ImageElement | IconElement | CodeElement | GroupElement;

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// ========== STORE ==========
interface HistoryState {
  elements: CanvasElement[];
}

interface Store {
  elements: CanvasElement[];
  selectedIds: string[];
  tool: Tool;
  zoom: number;
  panX: number;
  panY: number;
  gridEnabled: boolean;
  clipboard: CanvasElement[];
  selectionBox: SelectionBox | null;
  shapeType: ShapeType;
  lineStyle: LineStyle;
  arrowHead: ArrowHead;
  codeLanguage: CodeLanguage;
  iconType: IconType;
  
  // History for undo/redo
  history: HistoryState[];
  historyIndex: number;
  
  setTool: (tool: Tool) => void;
  setShapeType: (type: ShapeType) => void;
  setLineStyle: (style: LineStyle) => void;
  setArrowHead: (head: ArrowHead) => void;
  setCodeLanguage: (lang: CodeLanguage) => void;
  setIconType: (type: IconType) => void;
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteSelected: () => void;
  setSelectedIds: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  saveProject: () => void;
  loadProject: (json: string) => void;
  newProject: () => void;
  setSelectionBox: (box: SelectionBox | null) => void;
  selectElementsInBox: () => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushHistory: () => void;
}

const useStore = create<Store>((set, get) => ({
  elements: [],
  selectedIds: [],
  tool: 'select',
  zoom: 1,
  panX: 0,
  panY: 0,
  gridEnabled: true,
  clipboard: [],
  selectionBox: null,
  shapeType: 'rectangle',
  lineStyle: 'solid',
  arrowHead: 'arrow',
  codeLanguage: 'javascript',
  iconType: 'idea',
  
  // History
  history: [{ elements: [] }],
  historyIndex: 0,

  setTool: (tool) => set({ tool }),
  setShapeType: (shapeType) => set({ shapeType }),
  setLineStyle: (lineStyle) => set({ lineStyle }),
  setArrowHead: (arrowHead) => set({ arrowHead }),
  setCodeLanguage: (codeLanguage) => set({ codeLanguage }),
  setIconType: (iconType) => set({ iconType }),
  
  pushHistory: () => {
    const { elements, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ elements: JSON.parse(JSON.stringify(elements)) });
    // Limit history to 50 states
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },
  
  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({ 
        elements: JSON.parse(JSON.stringify(history[newIndex].elements)),
        historyIndex: newIndex,
        selectedIds: []
      });
    }
  },
  
  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({ 
        elements: JSON.parse(JSON.stringify(history[newIndex].elements)),
        historyIndex: newIndex,
        selectedIds: []
      });
    }
  },
  
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  addElement: (element) => {
    set((state) => ({ elements: [...state.elements, element] }));
    get().pushHistory();
  },

  updateElement: (id, updates) => set((state) => ({
    elements: state.elements.map((el) => el.id === id ? { ...el, ...updates } as CanvasElement : el),
  })),

  deleteSelected: () => {
    set((state) => ({
      elements: state.elements.filter((el) => !state.selectedIds.includes(el.id)),
      selectedIds: [],
    }));
    get().pushHistory();
  },

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  
  addToSelection: (id) => set((state) => ({
    selectedIds: state.selectedIds.includes(id) ? state.selectedIds : [...state.selectedIds, id],
  })),
  
  removeFromSelection: (id) => set((state) => ({
    selectedIds: state.selectedIds.filter((sid) => sid !== id),
  })),

  clearSelection: () => set({ selectedIds: [] }),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),

  setPan: (panX, panY) => set({ panX, panY }),

  groupSelected: () => {
    const { selectedIds, elements } = get();
    if (selectedIds.length < 2) return;

    const selectedEls = elements.filter((el) => selectedIds.includes(el.id));
    const minX = Math.min(...selectedEls.map((el) => el.x));
    const minY = Math.min(...selectedEls.map((el) => el.y));
    const maxX = Math.max(...selectedEls.map((el) => el.x + el.width));
    const maxY = Math.max(...selectedEls.map((el) => el.y + el.height));

    const groupId = uuidv4();
    const group: GroupElement = {
      id: groupId,
      type: 'group',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      zIndex: Math.max(...selectedEls.map((el) => el.zIndex)) + 1,
      childIds: selectedIds,
    };

    set((state) => ({
      elements: [
        ...state.elements.map((el) => selectedIds.includes(el.id) ? { ...el, groupId } as CanvasElement : el),
        group,
      ],
      selectedIds: [groupId],
    }));
    get().pushHistory();
  },

  ungroupSelected: () => {
    const { selectedIds, elements } = get();
    const groups = elements.filter((el) => el.type === 'group' && selectedIds.includes(el.id)) as GroupElement[];
    if (groups.length === 0) return;

    const childIds = groups.flatMap((g) => g.childIds);
    const groupIds = groups.map((g) => g.id);

    set((state) => ({
      elements: state.elements.filter((el) => !groupIds.includes(el.id)).map((el) =>
        childIds.includes(el.id) ? { ...el, groupId: undefined } as CanvasElement : el
      ),
      selectedIds: childIds,
    }));
    get().pushHistory();
  },

  copy: () => {
    const { selectedIds, elements } = get();
    const copied = elements.filter((el) => selectedIds.includes(el.id));
    set({ clipboard: copied });
  },

  paste: () => {
    const { clipboard, elements } = get();
    if (clipboard.length === 0) return;
    const newElements = clipboard.map((el) => ({
      ...el,
      id: uuidv4(),
      x: el.x + 30,
      y: el.y + 30,
      zIndex: elements.length,
    })) as CanvasElement[];
    set((state) => ({
      elements: [...state.elements, ...newElements],
      selectedIds: newElements.map((el) => el.id),
    }));
  },

  duplicate: () => {
    get().copy();
    get().paste();
  },

  bringToFront: () => {
    const { selectedIds, elements } = get();
    const maxZ = Math.max(...elements.map((el) => el.zIndex), 0);
    set((state) => ({
      elements: state.elements.map((el, i) =>
        selectedIds.includes(el.id) ? { ...el, zIndex: maxZ + i + 1 } as CanvasElement : el
      ),
    }));
  },

  sendToBack: () => {
    const { selectedIds } = get();
    set((state) => ({
      elements: state.elements.map((el) =>
        selectedIds.includes(el.id) ? { ...el, zIndex: 0 } as CanvasElement : { ...el, zIndex: el.zIndex + 1 } as CanvasElement
      ),
    }));
  },

  saveProject: () => {
    const { elements, zoom, panX, panY } = get();
    const project = {
      name: 'LevelUpCreationApp Project',
      version: '2.0',
      createdAt: new Date().toISOString(),
      elements,
      zoom,
      panX,
      panY,
    };
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `levelup-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  loadProject: (json) => {
    try {
      const project = JSON.parse(json);
      set({
        elements: project.elements || [],
        zoom: project.zoom || 1,
        panX: project.panX || 0,
        panY: project.panY || 0,
        selectedIds: [],
      });
    } catch (e) {
      console.error('Failed to load project:', e);
    }
  },

  newProject: () => set({
    elements: [],
    selectedIds: [],
    zoom: 1,
    panX: 0,
    panY: 0,
  }),

  setSelectionBox: (box) => set({ selectionBox: box }),

  selectElementsInBox: () => {
    const { selectionBox, elements } = get();
    if (!selectionBox) return;
    const { startX, startY, endX, endY } = selectionBox;
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    const selectedIds = elements.filter((el) => {
      return el.x < maxX && el.x + el.width > minX && el.y < maxY && el.y + el.height > minY;
    }).map((el) => el.id);

    set({ selectedIds, selectionBox: null });
  },
}));

// ========== ICONS SVG ==========
const Icons: Record<IconType, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  idea: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 017 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>,
  warning: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>,
  success: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>,
  error: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>,
  info: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>,
  question: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>,
  star: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
  heart: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>,
  flag: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>,
  bookmark: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>,
  clock: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>,
  user: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
  check: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>,
  x: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>,
  'arrow-up': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>,
  'arrow-down': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>,
  'arrow-left': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>,
  'arrow-right': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>,
  rocket: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c-3.26 0-6.1 1.76-7.64 4.38L2 10l3.09 2.5L2 15l2.36 3.12C5.9 20.74 8.74 22.5 12 22.5c5.52 0 10-4.48 10-10S17.52 2.5 12 2.5zm0 17c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm-1.5-3h3v-3h3v-3h-3v-3h-3v3h-3v3h3z"/></svg>,
  target: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/></svg>,
  trophy: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>,
  fire: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>,
  bolt: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>,
  'thumbs-up': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>,
  'thumbs-down': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>,
};

// ========== SHAPE PATHS ==========
const getShapePath = (type: ShapeType, width: number, height: number): string => {
  switch (type) {
    case 'rectangle':
    case 'square':
      return `M 0 0 H ${width} V ${height} H 0 Z`;
    case 'rounded-rect':
      const r = Math.min(width, height) * 0.15;
      return `M ${r} 0 H ${width - r} Q ${width} 0 ${width} ${r} V ${height - r} Q ${width} ${height} ${width - r} ${height} H ${r} Q 0 ${height} 0 ${height - r} V ${r} Q 0 0 ${r} 0`;
    case 'circle':
      const cx = width / 2;
      const cy = height / 2;
      const rx = width / 2;
      const ry = height / 2;
      return `M ${cx} ${cy - ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy + ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy - ry}`;
    case 'triangle':
      return `M ${width / 2} 0 L ${width} ${height} L 0 ${height} Z`;
    case 'diamond':
      return `M ${width / 2} 0 L ${width} ${height / 2} L ${width / 2} ${height} L 0 ${height / 2} Z`;
    case 'hexagon':
      const hw = width / 4;
      return `M ${hw} 0 L ${width - hw} 0 L ${width} ${height / 2} L ${width - hw} ${height} L ${hw} ${height} L 0 ${height / 2} Z`;
    case 'star':
      const points = 5;
      const outerR = Math.min(width, height) / 2;
      const innerR = outerR * 0.4;
      const centerX = width / 2;
      const centerY = height / 2;
      let path = '';
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / points) * i - Math.PI / 2;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        path += (i === 0 ? 'M' : 'L') + ` ${x} ${y} `;
      }
      return path + 'Z';
    default:
      return `M 0 0 H ${width} V ${height} H 0 Z`;
  }
};

// ========== COLORS ==========
const COLORS = [
  '#fef08a', '#fde047', '#facc15', '#fbbf24', '#f59e0b',
  '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c',
  '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626',
  '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777',
  '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea',
  '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5',
  '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb',
  '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669',
  '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151',
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#1e293b',
];

const FONTS = ['Inter', 'Poppins', 'JetBrains Mono', 'Georgia', 'Arial', 'Verdana', 'Times New Roman', 'Courier New'];

// ========== TOOLBAR ==========
const Toolbar: React.FC = () => {
  const { 
    tool, setTool, shapeType, setShapeType, lineStyle, setLineStyle, 
    arrowHead, setArrowHead, codeLanguage, setCodeLanguage, iconType, setIconType,
    saveProject, loadProject, newProject, selectedIds, elements,
    groupSelected, ungroupSelected, bringToFront, sendToBack, duplicate, deleteSelected, copy, paste,
    undo, redo, canUndo, canRedo
  } = useStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showShapes, setShowShapes] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showLine, setShowLine] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  
  // Check if selection contains groups
  const hasGroups = selectedIds.some(id => elements.find(el => el.id === id)?.type === 'group');

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: 'select', icon: '🖱️', label: 'Sélection (V)' },
    { id: 'postit', icon: '📌', label: 'Post-it (P)' },
    { id: 'text', icon: '✏️', label: 'Texte (T)' },
    { id: 'shape', icon: '⬛', label: 'Formes (S)' },
    { id: 'arrow', icon: '➡️', label: 'Flèche (A)' },
    { id: 'line', icon: '📏', label: 'Ligne (L)' },
    { id: 'image', icon: '🖼️', label: 'Image (I)' },
    { id: 'icon', icon: '⭐', label: 'Icône (O)' },
    { id: 'code', icon: '💻', label: 'Code (C)' },
    { id: 'pan', icon: '✋', label: 'Déplacer (H)' },
  ];

  const shapes: { type: ShapeType; icon: string }[] = [
    { type: 'rectangle', icon: '▬' },
    { type: 'square', icon: '⬜' },
    { type: 'rounded-rect', icon: '▢' },
    { type: 'circle', icon: '⚪' },
    { type: 'triangle', icon: '△' },
    { type: 'diamond', icon: '◇' },
    { type: 'hexagon', icon: '⬡' },
    { type: 'star', icon: '☆' },
  ];

  const iconTypes: IconType[] = ['idea', 'warning', 'success', 'error', 'info', 'check', 'x', 'star', 'heart', 'flag', 'rocket', 'target', 'trophy', 'fire', 'bolt', 'thumbs-up', 'thumbs-down', 'user', 'clock', 'bookmark'];

  const languages: CodeLanguage[] = ['javascript', 'typescript', 'html', 'css', 'react', 'python', 'java', 'csharp', 'php', 'go', 'rust', 'sql', 'json', 'bash'];

  const lineStyles: { style: LineStyle; label: string }[] = [
    { style: 'solid', label: '━━━' },
    { style: 'dashed', label: '┅┅┅' },
    { style: 'dotted', label: '┈┈┈' },
  ];

  const arrowHeads: { head: ArrowHead; label: string }[] = [
    { head: 'none', label: '━' },
    { head: 'arrow', label: '→' },
    { head: 'triangle', label: '▶' },
    { head: 'circle', label: '●' },
    { head: 'diamond', label: '◆' },
  ];

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      loadProject(json);
    };
    reader.readAsText(file);
  };

  return (
    <>
      {/* Main Toolbar */}
      <div className="fixed top-0 left-0 right-0 z-toolbar glass border-b border-white/10">
        <div className="flex items-center justify-between px-2 sm:px-4 h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 gradient-primary rounded-xl flex items-center justify-center shadow-lg glow-primary">
              <span className="text-lg sm:text-xl">🚀</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm sm:text-base font-bold text-white">LevelUpCreation</h1>
              <p className="text-[10px] sm:text-xs text-slate-400">Pro Canvas</p>
            </div>
          </div>

          {/* Desktop Tools */}
          <div className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-xl p-1">
            {tools.map(({ id, icon, label }) => (
              <div key={id} className="relative">
                <button
                  onClick={() => {
                    setTool(id);
                    if (id === 'shape') setShowShapes(!showShapes);
                    else setShowShapes(false);
                    if (id === 'icon') setShowIcons(!showIcons);
                    else setShowIcons(false);
                    if (id === 'code') setShowCode(!showCode);
                    else setShowCode(false);
                    if (id === 'line' || id === 'arrow') setShowLine(!showLine);
                    else setShowLine(false);
                  }}
                  className={`relative px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    tool === id
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={label}
                >
                  <span className="text-lg">{icon}</span>
                  <span className="text-xs hidden lg:inline">{label.split(' ')[0]}</span>
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Undo/Redo */}
            <div className="hidden sm:flex items-center gap-1 mr-2 border-r border-white/10 pr-2">
              <button 
                onClick={undo} 
                disabled={!canUndo()}
                className={`btn-icon transition-all ${canUndo() ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'}`} 
                title="Annuler (Ctrl+Z)"
              >
                <span className="text-lg">↩️</span>
              </button>
              <button 
                onClick={redo}
                disabled={!canRedo()}
                className={`btn-icon transition-all ${canRedo() ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'}`} 
                title="Rétablir (Ctrl+Y)"
              >
                <span className="text-lg">↪️</span>
              </button>
            </div>
            
            <button onClick={newProject} className="btn-icon text-slate-400 hover:text-white" title="Nouveau">
              <span className="text-lg">📄</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="btn-icon text-slate-400 hover:text-white" title="Ouvrir">
              <span className="text-lg">📂</span>
            </button>
            <button onClick={saveProject} className="btn-icon text-slate-400 hover:text-white" title="Sauvegarder">
              <span className="text-lg">💾</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadProject} className="hidden" />
            
            {/* Mobile menu button */}
            <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden btn-icon text-slate-400 hover:text-white">
              <span className="text-lg">☰</span>
            </button>
          </div>
        </div>

        {/* Submenus */}
        {showShapes && tool === 'shape' && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 glass rounded-xl p-2 animate-fadeIn">
            <div className="flex gap-1 flex-wrap max-w-xs justify-center">
              {shapes.map(({ type, icon }) => (
                <button
                  key={type}
                  onClick={() => { setShapeType(type); setShowShapes(false); }}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                    shapeType === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        )}

        {showIcons && tool === 'icon' && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 glass rounded-xl p-3 animate-fadeIn max-h-64 overflow-y-auto">
            <div className="grid grid-cols-5 gap-2">
              {iconTypes.map((type) => {
                const IconComponent = Icons[type];
                return (
                  <button
                    key={type}
                    onClick={() => { setIconType(type); setShowIcons(false); }}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                      iconType === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showCode && tool === 'code' && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 glass rounded-xl p-3 animate-fadeIn">
            <div className="grid grid-cols-4 gap-2">
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => { setCodeLanguage(lang); setShowCode(false); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    codeLanguage === lang ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        {showLine && (tool === 'line' || tool === 'arrow') && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 glass rounded-xl p-3 animate-fadeIn">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <span className="text-xs text-slate-400 w-16">Style:</span>
                <div className="flex gap-1">
                  {lineStyles.map(({ style, label }) => (
                    <button
                      key={style}
                      onClick={() => setLineStyle(style)}
                      className={`px-3 py-1 rounded text-sm ${
                        lineStyle === style ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {tool === 'arrow' && (
                <div className="flex gap-2">
                  <span className="text-xs text-slate-400 w-16">Tête:</span>
                  <div className="flex gap-1">
                    {arrowHeads.map(({ head, label }) => (
                      <button
                        key={head}
                        onClick={() => setArrowHead(head)}
                        className={`px-3 py-1 rounded text-sm ${
                          arrowHead === head ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Tools Menu */}
      {mobileMenu && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileMenu(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute top-14 left-0 right-0 glass p-4 animate-slideIn max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Undo/Redo Mobile */}
            <div className="flex gap-2 mb-4 pb-4 border-b border-white/10">
              <button 
                onClick={() => { undo(); }}
                disabled={!canUndo()}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 ${canUndo() ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-600'}`}
              >
                <span>↩️</span>
                <span className="text-sm">Annuler</span>
              </button>
              <button 
                onClick={() => { redo(); }}
                disabled={!canRedo()}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 ${canRedo() ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-600'}`}
              >
                <span>↪️</span>
                <span className="text-sm">Rétablir</span>
              </button>
            </div>
            
            <p className="text-xs text-slate-400 mb-2">Outils</p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {tools.map(({ id, icon, label }) => (
                <button
                  key={id}
                  onClick={() => { setTool(id); setMobileMenu(false); }}
                  className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                    tool === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <span className="text-xl">{icon}</span>
                  <span className="text-[10px]">{label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            {tool === 'shape' && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-slate-400 mb-2">Formes</p>
                <div className="flex gap-2 flex-wrap">
                  {shapes.map(({ type, icon }) => (
                    <button
                      key={type}
                      onClick={() => { setShapeType(type); setMobileMenu(false); }}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                        shapeType === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tool === 'icon' && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-slate-400 mb-2">Icônes</p>
                <div className="grid grid-cols-6 gap-2">
                  {iconTypes.map((type) => {
                    const IconComponent = Icons[type];
                    return (
                      <button
                        key={type}
                        onClick={() => { setIconType(type); setMobileMenu(false); }}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                          iconType === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {tool === 'code' && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-slate-400 mb-2">Langage</p>
                <div className="grid grid-cols-3 gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { setCodeLanguage(lang); setMobileMenu(false); }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        codeLanguage === lang ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection Toolbar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-toolbar glass rounded-2xl px-3 sm:px-4 py-2 sm:py-3 animate-fadeIn max-w-[95vw] overflow-x-auto">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-[10px] sm:text-xs text-slate-400 mr-1 sm:mr-2 whitespace-nowrap">{selectedIds.length} sélectionné(s)</span>
            
            <div className="w-px h-6 bg-white/20 mx-1" />
            
            {/* Group/Ungroup buttons - always visible */}
            {selectedIds.length >= 2 && (
              <button 
                onClick={groupSelected} 
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-medium transition-all" 
                title="Grouper (Ctrl+G)"
              >
                <span>📦</span>
                <span className="hidden sm:inline">Grouper</span>
              </button>
            )}
            {hasGroups && (
              <button 
                onClick={ungroupSelected} 
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-medium transition-all" 
                title="Dégrouper (Ctrl+Shift+G)"
              >
                <span>📤</span>
                <span className="hidden sm:inline">Dégrouper</span>
              </button>
            )}
            
            <div className="w-px h-6 bg-white/20 mx-1" />
            
            <button onClick={duplicate} className="btn-icon text-slate-400 hover:text-white hover:bg-white/10" title="Dupliquer (Ctrl+D)">
              <span>📋</span>
            </button>
            <button onClick={copy} className="btn-icon text-slate-400 hover:text-white hover:bg-white/10" title="Copier (Ctrl+C)">
              <span>📄</span>
            </button>
            <button onClick={paste} className="btn-icon text-slate-400 hover:text-white hover:bg-white/10" title="Coller (Ctrl+V)">
              <span>📥</span>
            </button>
            
            <div className="w-px h-6 bg-white/20 mx-1" />
            
            <button onClick={bringToFront} className="btn-icon text-slate-400 hover:text-white hover:bg-white/10" title="Premier plan">
              <span>⬆️</span>
            </button>
            <button onClick={sendToBack} className="btn-icon text-slate-400 hover:text-white hover:bg-white/10" title="Arrière plan">
              <span>⬇️</span>
            </button>
            
            <div className="w-px h-6 bg-white/20 mx-1" />
            
            <button onClick={deleteSelected} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-medium transition-all" title="Supprimer (Suppr)">
              <span>🗑️</span>
              <span className="hidden sm:inline">Supprimer</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ========== PROPERTIES PANEL ==========
const PropertiesPanel: React.FC = () => {
  const { elements, selectedIds, updateElement } = useStore();
  
  if (selectedIds.length !== 1) return null;
  
  const element = elements.find((el) => el.id === selectedIds[0]);
  if (!element) return null;

  const renderProperties = () => {
    switch (element.type) {
      case 'postit':
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Couleur</label>
              <div className="grid grid-cols-5 gap-1">
                {COLORS.slice(0, 20).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateElement(element.id, { color })}
                    className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                      element.color === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Police</label>
              <select
                value={element.fontFamily}
                onChange={(e) => updateElement(element.id, { fontFamily: e.target.value })}
                className="input input-sm"
              >
                {FONTS.map((font) => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <label className="text-xs text-slate-400">Taille</label>
                <input
                  type="number"
                  value={element.fontSize}
                  onChange={(e) => updateElement(element.id, { fontSize: Number(e.target.value) })}
                  className="input input-sm"
                  min={8}
                  max={72}
                />
              </div>
              <div className="flex items-end gap-1">
                <button
                  onClick={() => updateElement(element.id, { bold: !element.bold })}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    element.bold ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  B
                </button>
                <button
                  onClick={() => updateElement(element.id, { italic: !element.italic })}
                  className={`px-3 py-1.5 rounded-lg italic transition-all ${
                    element.italic ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  I
                </button>
              </div>
            </div>
          </>
        );

      case 'text':
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Couleur du texte</label>
              <div className="grid grid-cols-5 gap-1">
                {COLORS.slice(0, 20).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateElement(element.id, { color })}
                    className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                      element.color === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Police</label>
              <select
                value={element.fontFamily}
                onChange={(e) => updateElement(element.id, { fontFamily: e.target.value })}
                className="input input-sm"
              >
                {FONTS.map((font) => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <label className="text-xs text-slate-400">Taille</label>
                <input
                  type="number"
                  value={element.fontSize}
                  onChange={(e) => updateElement(element.id, { fontSize: Number(e.target.value) })}
                  className="input input-sm"
                  min={8}
                  max={72}
                />
              </div>
              <div className="flex items-end gap-1">
                <button
                  onClick={() => updateElement(element.id, { bold: !element.bold })}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    element.bold ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  B
                </button>
                <button
                  onClick={() => updateElement(element.id, { italic: !element.italic })}
                  className={`px-3 py-1.5 rounded-lg italic transition-all ${
                    element.italic ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  I
                </button>
              </div>
            </div>
          </>
        );

      case 'shape':
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Remplissage</label>
              <div className="grid grid-cols-5 gap-1">
                {COLORS.slice(0, 25).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateElement(element.id, { fillColor: color })}
                    className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                      element.fillColor === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Bordure</label>
              <div className="grid grid-cols-5 gap-1">
                {COLORS.slice(0, 20).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateElement(element.id, { strokeColor: color })}
                    className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                      element.strokeColor === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Épaisseur bordure: {element.strokeWidth}px</label>
              <input
                type="range"
                value={element.strokeWidth}
                onChange={(e) => updateElement(element.id, { strokeWidth: Number(e.target.value) })}
                className="w-full"
                min={0}
                max={20}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Opacité: {Math.round(element.opacity * 100)}%</label>
              <input
                type="range"
                value={element.opacity * 100}
                onChange={(e) => updateElement(element.id, { opacity: Number(e.target.value) / 100 })}
                className="w-full"
                min={0}
                max={100}
              />
            </div>
          </>
        );

      case 'arrow':
      case 'line':
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Couleur</label>
              <div className="grid grid-cols-5 gap-1">
                {COLORS.slice(0, 20).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateElement(element.id, { color })}
                    className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                      element.color === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Épaisseur: {element.strokeWidth}px</label>
              <input
                type="range"
                value={element.strokeWidth}
                onChange={(e) => updateElement(element.id, { strokeWidth: Number(e.target.value) })}
                className="w-full"
                min={1}
                max={20}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Style</label>
              <div className="flex gap-2">
                {(['solid', 'dashed', 'dotted'] as LineStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => updateElement(element.id, { lineStyle: style })}
                    className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                      element.lineStyle === style ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {style === 'solid' ? '━━' : style === 'dashed' ? '┅┅' : '┈┈'}
                  </button>
                ))}
              </div>
            </div>
          </>
        );

      case 'icon':
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Couleur</label>
              <div className="grid grid-cols-5 gap-1">
                {COLORS.slice(0, 20).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateElement(element.id, { color })}
                    className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                      element.color === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Taille: {element.size}px</label>
              <input
                type="range"
                value={element.size}
                onChange={(e) => updateElement(element.id, { size: Number(e.target.value) })}
                className="w-full"
                min={20}
                max={120}
              />
            </div>
          </>
        );

      case 'code':
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Langage</label>
              <select
                value={element.language}
                onChange={(e) => updateElement(element.id, { language: e.target.value as CodeLanguage })}
                className="input input-sm"
              >
                {['javascript', 'typescript', 'html', 'css', 'react', 'python', 'java', 'csharp', 'php', 'go', 'rust', 'sql', 'json', 'bash'].map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Taille police: {element.fontSize}px</label>
              <input
                type="range"
                value={element.fontSize}
                onChange={(e) => updateElement(element.id, { fontSize: Number(e.target.value) })}
                className="w-full"
                min={10}
                max={24}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed right-4 top-20 w-64 glass rounded-2xl p-4 z-panel animate-slideIn hidden lg:block">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <span>⚙️</span> Propriétés
      </h3>
      <div className="space-y-4">
        {renderProperties()}
      </div>
    </div>
  );
};

// ========== MINI MAP ==========
const MiniMap: React.FC = () => {
  const { elements, zoom, panX, panY } = useStore();
  const mapSize = 150;
  const scale = 0.05;

  return (
    <div className="fixed bottom-4 right-4 w-36 h-28 glass rounded-xl overflow-hidden z-panel hidden sm:block">
      <div className="relative w-full h-full">
        {elements.map((el) => (
          <div
            key={el.id}
            className="absolute bg-indigo-500/50 rounded-sm"
            style={{
              left: (el.x * scale + mapSize / 2) + '%',
              top: (el.y * scale + mapSize / 2) + '%',
              width: Math.max(el.width * scale, 2),
              height: Math.max(el.height * scale, 2),
            }}
          />
        ))}
        <div
          className="absolute border-2 border-white/50 rounded"
          style={{
            left: `${50 - panX * scale / zoom}%`,
            top: `${50 - panY * scale / zoom}%`,
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
};

// ========== ZOOM CONTROLS ==========
const ZoomControls: React.FC = () => {
  const { zoom, setZoom, undo, redo, canUndo, canRedo } = useStore();

  return (
    <div className="fixed bottom-4 left-4 flex items-center gap-1 sm:gap-2 glass rounded-xl px-2 sm:px-3 py-2 z-panel">
      {/* Mobile Undo/Redo */}
      <div className="flex items-center gap-1 sm:hidden border-r border-white/20 pr-2 mr-1">
        <button 
          onClick={undo}
          disabled={!canUndo()}
          className={`btn-icon ${canUndo() ? 'text-slate-400 hover:text-white' : 'text-slate-600'}`}
        >
          <span>↩️</span>
        </button>
        <button 
          onClick={redo}
          disabled={!canRedo()}
          className={`btn-icon ${canRedo() ? 'text-slate-400 hover:text-white' : 'text-slate-600'}`}
        >
          <span>↪️</span>
        </button>
      </div>
      
      <button onClick={() => setZoom(zoom - 0.1)} className="btn-icon text-slate-400 hover:text-white">
        <span>➖</span>
      </button>
      <span className="text-xs sm:text-sm text-white font-medium w-10 sm:w-14 text-center">{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom(zoom + 0.1)} className="btn-icon text-slate-400 hover:text-white">
        <span>➕</span>
      </button>
      <button onClick={() => setZoom(1)} className="btn-icon text-slate-400 hover:text-white ml-1">
        <span>🔄</span>
      </button>
    </div>
  );
};

// ========== CANVAS ==========
const Canvas: React.FC = () => {
  const {
    elements, selectedIds, tool, zoom, panX, panY,
    shapeType, lineStyle, arrowHead, codeLanguage, iconType,
    addElement, updateElement, setSelectedIds, addToSelection, clearSelection,
    setPan, selectionBox, setSelectionBox, selectElementsInBox
  } = useStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; handle: string } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - rect.width / 2) / zoom - panX,
      y: (clientY - rect.top - rect.height / 2) / zoom - panY,
    };
  }, [zoom, panX, panY]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    
    const point = getCanvasPoint(e.clientX, e.clientY);

    if (tool === 'pan') {
      setIsPanning(true);
      setDragStart({ x: e.clientX - panX * zoom, y: e.clientY - panY * zoom });
      return;
    }

    if (tool === 'select') {
      clearSelection();
      setSelectionBox({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
      return;
    }

    if (tool === 'arrow' || tool === 'line') {
      setIsDrawing(true);
      setDrawStart(point);
      return;
    }

    // Create elements
    if (tool === 'postit') {
      const newElement: PostItElement = {
        id: uuidv4(),
        type: 'postit',
        x: point.x - 100,
        y: point.y - 100,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: elements.length,
        content: '',
        color: '#fef08a',
        textColor: '#1f2937',
        fontSize: 14,
        fontFamily: 'Inter',
        bold: false,
        italic: false,
      };
      addElement(newElement);
      setSelectedIds([newElement.id]);
      setEditingId(newElement.id);
    }

    if (tool === 'text') {
      const newElement: TextElement = {
        id: uuidv4(),
        type: 'text',
        x: point.x - 100,
        y: point.y - 20,
        width: 200,
        height: 40,
        rotation: 0,
        zIndex: elements.length,
        content: 'Texte',
        color: '#ffffff',
        fontSize: 18,
        fontFamily: 'Inter',
        bold: false,
        italic: false,
      };
      addElement(newElement);
      setSelectedIds([newElement.id]);
      setEditingId(newElement.id);
    }

    if (tool === 'shape') {
      const size = shapeType === 'square' || shapeType === 'circle' ? 120 : 150;
      const newElement: ShapeElement = {
        id: uuidv4(),
        type: 'shape',
        x: point.x - size / 2,
        y: point.y - size / 2,
        width: size,
        height: shapeType === 'square' || shapeType === 'circle' ? size : 100,
        rotation: 0,
        zIndex: elements.length,
        shapeType,
        fillColor: '#3b82f6',
        strokeColor: '#1e40af',
        strokeWidth: 2,
        opacity: 1,
      };
      addElement(newElement);
      setSelectedIds([newElement.id]);
    }

    if (tool === 'icon') {
      const newElement: IconElement = {
        id: uuidv4(),
        type: 'icon',
        x: point.x - 30,
        y: point.y - 30,
        width: 60,
        height: 60,
        rotation: 0,
        zIndex: elements.length,
        iconType,
        color: '#3b82f6',
        size: 48,
      };
      addElement(newElement);
      setSelectedIds([newElement.id]);
    }

    if (tool === 'code') {
      const defaultCode: Record<string, string> = {
        javascript: '// JavaScript\nfunction hello() {\n  console.log("Hello!");\n}',
        typescript: '// TypeScript\nconst greet = (name: string): void => {\n  console.log(`Hello ${name}!`);\n};',
        html: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Hello</title>\n</head>\n<body>\n  <h1>Hello World!</h1>\n</body>\n</html>',
        css: '/* CSS */\n.container {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}',
        react: '// React\nimport React from "react";\n\nconst App = () => {\n  return <h1>Hello React!</h1>;\n};\n\nexport default App;',
        python: '# Python\ndef hello():\n    print("Hello World!")\n\nhello()',
        java: '// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello!");\n    }\n}',
      };
      
      const newElement: CodeElement = {
        id: uuidv4(),
        type: 'code',
        x: point.x - 200,
        y: point.y - 100,
        width: 400,
        height: 200,
        rotation: 0,
        zIndex: elements.length,
        content: defaultCode[codeLanguage] || '// Code...',
        language: codeLanguage,
        fontSize: 13,
      };
      addElement(newElement);
      setSelectedIds([newElement.id]);
    }

    if (tool === 'image') {
      imageInputRef.current?.click();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan((e.clientX - dragStart.x) / zoom, (e.clientY - dragStart.y) / zoom);
      return;
    }

    const point = getCanvasPoint(e.clientX, e.clientY);

    if (selectionBox) {
      setSelectionBox({ ...selectionBox, endX: point.x, endY: point.y });
      return;
    }

    if (isDrawing && (tool === 'arrow' || tool === 'line')) {
      // Preview line/arrow
      return;
    }

    if (resizing) {
      const el = elements.find((e) => e.id === resizing.id);
      if (!el) return;

      const dx = point.x - (el.x + el.width);
      const dy = point.y - (el.y + el.height);

      let updates: Partial<CanvasElement> = {};

      switch (resizing.handle) {
        case 'se':
          updates = { width: Math.max(50, el.width + dx), height: Math.max(50, el.height + dy) };
          break;
        case 'sw':
          updates = { x: point.x, width: Math.max(50, el.x + el.width - point.x), height: Math.max(50, el.height + dy) };
          break;
        case 'ne':
          updates = { y: point.y, width: Math.max(50, el.width + dx), height: Math.max(50, el.y + el.height - point.y) };
          break;
        case 'nw':
          updates = { x: point.x, y: point.y, width: Math.max(50, el.x + el.width - point.x), height: Math.max(50, el.y + el.height - point.y) };
          break;
        case 'n':
          updates = { y: point.y, height: Math.max(50, el.y + el.height - point.y) };
          break;
        case 's':
          updates = { height: Math.max(50, point.y - el.y) };
          break;
        case 'e':
          updates = { width: Math.max(50, point.x - el.x) };
          break;
        case 'w':
          updates = { x: point.x, width: Math.max(50, el.x + el.width - point.x) };
          break;
      }

      updateElement(resizing.id, updates);
      return;
    }

    if (dragging) {
      const el = elements.find((e) => e.id === dragging);
      if (!el) return;
      
      updateElement(dragging, {
        x: point.x - el.width / 2,
        y: point.y - el.height / 2,
      });
      return;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (selectionBox) {
      selectElementsInBox();
    }

    if (isDrawing && (tool === 'arrow' || tool === 'line')) {
      const point = getCanvasPoint(e.clientX, e.clientY);
      
      if (tool === 'arrow') {
        const newElement: ArrowElement = {
          id: uuidv4(),
          type: 'arrow',
          x: Math.min(drawStart.x, point.x),
          y: Math.min(drawStart.y, point.y),
          width: Math.abs(point.x - drawStart.x),
          height: Math.abs(point.y - drawStart.y),
          rotation: 0,
          zIndex: elements.length,
          startX: drawStart.x,
          startY: drawStart.y,
          endX: point.x,
          endY: point.y,
          color: '#374151',
          strokeWidth: 2,
          lineStyle,
          startHead: 'none',
          endHead: arrowHead,
        };
        addElement(newElement);
        setSelectedIds([newElement.id]);
      } else {
        const newElement: LineElement = {
          id: uuidv4(),
          type: 'line',
          x: Math.min(drawStart.x, point.x),
          y: Math.min(drawStart.y, point.y),
          width: Math.abs(point.x - drawStart.x),
          height: Math.abs(point.y - drawStart.y),
          rotation: 0,
          zIndex: elements.length,
          startX: drawStart.x,
          startY: drawStart.y,
          endX: point.x,
          endY: point.y,
          color: '#374151',
          strokeWidth: 2,
          lineStyle,
        };
        addElement(newElement);
        setSelectedIds([newElement.id]);
      }
    }

    // Push history if we were dragging or resizing
    if (dragging || resizing) {
      useStore.getState().pushHistory();
    }
    
    setIsPanning(false);
    setIsDrawing(false);
    setResizing(null);
    setDragging(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      useStore.getState().setZoom(zoom + delta);
    } else {
      setPan(panX - e.deltaX / zoom, panY - e.deltaY / zoom);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const newElement: ImageElement = {
        id: uuidv4(),
        type: 'image',
        x: -150,
        y: -100,
        width: 300,
        height: 200,
        rotation: 0,
        zIndex: elements.length,
        src,
      };
      addElement(newElement);
      setSelectedIds([newElement.id]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleElementClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tool !== 'select') return;
    
    if (e.shiftKey) {
      addToSelection(id);
    } else {
      setSelectedIds([id]);
    }
  };

  const handleElementDoubleClick = (id: string) => {
    setEditingId(id);
  };

  const handleElementMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tool !== 'select') return;
    
    if (!selectedIds.includes(id)) {
      if (e.shiftKey) {
        addToSelection(id);
      } else {
        setSelectedIds([id]);
      }
    }
    setDragging(id);
  };

  const renderResizeHandles = (el: CanvasElement) => {
    if (!selectedIds.includes(el.id)) return null;

    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    const positions: Record<string, React.CSSProperties> = {
      nw: { top: -6, left: -6, cursor: 'nwse-resize' },
      n: { top: -6, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
      ne: { top: -6, right: -6, cursor: 'nesw-resize' },
      e: { top: '50%', right: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' },
      se: { bottom: -6, right: -6, cursor: 'nwse-resize' },
      s: { bottom: -6, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
      sw: { bottom: -6, left: -6, cursor: 'nesw-resize' },
      w: { top: '50%', left: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' },
    };

    return handles.map((handle) => (
      <div
        key={handle}
        className="resize-handle"
        style={positions[handle]}
        onMouseDown={(e) => {
          e.stopPropagation();
          setResizing({ id: el.id, handle });
        }}
      />
    ));
  };

  const renderElement = (el: CanvasElement) => {
    const isSelected = selectedIds.includes(el.id);
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: el.x,
      top: el.y,
      width: el.width,
      height: el.height,
      zIndex: el.zIndex,
      transform: `rotate(${el.rotation}deg)`,
    };

    switch (el.type) {
      case 'postit':
        return (
          <div
            key={el.id}
            className={`absolute rounded-lg shadow-lg transition-shadow cursor-move ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : ''}`}
            style={{ ...baseStyle, backgroundColor: el.color }}
            onClick={(e) => handleElementClick(e, el.id)}
            onDoubleClick={() => handleElementDoubleClick(el.id)}
            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
          >
            <div className="absolute top-0 left-0 right-0 h-6 bg-black/10 rounded-t-lg" />
            {editingId === el.id ? (
              <textarea
                autoFocus
                value={el.content}
                onChange={(e) => updateElement(el.id, { content: e.target.value })}
                onBlur={() => setEditingId(null)}
                className="w-full h-full p-3 pt-8 bg-transparent resize-none outline-none"
                style={{
                  color: el.textColor,
                  fontSize: el.fontSize,
                  fontFamily: el.fontFamily,
                  fontWeight: el.bold ? 'bold' : 'normal',
                  fontStyle: el.italic ? 'italic' : 'normal',
                }}
              />
            ) : (
              <div
                className="w-full h-full p-3 pt-8 overflow-hidden whitespace-pre-wrap"
                style={{
                  color: el.textColor,
                  fontSize: el.fontSize,
                  fontFamily: el.fontFamily,
                  fontWeight: el.bold ? 'bold' : 'normal',
                  fontStyle: el.italic ? 'italic' : 'normal',
                }}
              >
                {el.content || 'Double-cliquez pour éditer...'}
              </div>
            )}
            {renderResizeHandles(el)}
          </div>
        );

      case 'text':
        return (
          <div
            key={el.id}
            className={`absolute cursor-move ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900 rounded' : ''}`}
            style={baseStyle}
            onClick={(e) => handleElementClick(e, el.id)}
            onDoubleClick={() => handleElementDoubleClick(el.id)}
            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
          >
            {editingId === el.id ? (
              <textarea
                autoFocus
                value={el.content}
                onChange={(e) => updateElement(el.id, { content: e.target.value })}
                onBlur={() => setEditingId(null)}
                className="w-full h-full bg-transparent resize-none outline-none"
                style={{
                  color: el.color,
                  fontSize: el.fontSize,
                  fontFamily: el.fontFamily,
                  fontWeight: el.bold ? 'bold' : 'normal',
                  fontStyle: el.italic ? 'italic' : 'normal',
                }}
              />
            ) : (
              <div
                className="w-full h-full overflow-hidden whitespace-pre-wrap"
                style={{
                  color: el.color,
                  fontSize: el.fontSize,
                  fontFamily: el.fontFamily,
                  fontWeight: el.bold ? 'bold' : 'normal',
                  fontStyle: el.italic ? 'italic' : 'normal',
                }}
              >
                {el.content}
              </div>
            )}
            {renderResizeHandles(el)}
          </div>
        );

      case 'shape':
        return (
          <div
            key={el.id}
            className={`absolute cursor-move ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900 rounded' : ''}`}
            style={baseStyle}
            onClick={(e) => handleElementClick(e, el.id)}
            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
          >
            <svg width="100%" height="100%" viewBox={`0 0 ${el.width} ${el.height}`} style={{ opacity: el.opacity }}>
              <path
                d={getShapePath(el.shapeType, el.width, el.height)}
                fill={el.fillColor}
                stroke={el.strokeColor}
                strokeWidth={el.strokeWidth}
              />
            </svg>
            {renderResizeHandles(el)}
          </div>
        );

      case 'arrow':
        return (
          <svg
            key={el.id}
            className={`absolute cursor-move ${isSelected ? '' : ''}`}
            style={{ ...baseStyle, overflow: 'visible', pointerEvents: 'none' }}
            onClick={(e) => handleElementClick(e, el.id)}
            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
          >
            <defs>
              <marker
                id={`arrowhead-${el.id}`}
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                {el.endHead === 'arrow' && <polygon points="0 0, 10 3.5, 0 7" fill={el.color} />}
                {el.endHead === 'triangle' && <polygon points="0 0, 10 3.5, 0 7" fill={el.color} />}
                {el.endHead === 'circle' && <circle cx="5" cy="3.5" r="3" fill={el.color} />}
                {el.endHead === 'diamond' && <polygon points="5 0, 10 3.5, 5 7, 0 3.5" fill={el.color} />}
              </marker>
            </defs>
            <line
              x1={el.startX - el.x}
              y1={el.startY - el.y}
              x2={el.endX - el.x}
              y2={el.endY - el.y}
              stroke={el.color}
              strokeWidth={el.strokeWidth}
              strokeDasharray={el.lineStyle === 'dashed' ? '8,4' : el.lineStyle === 'dotted' ? '2,4' : 'none'}
              markerEnd={el.endHead !== 'none' ? `url(#arrowhead-${el.id})` : undefined}
              style={{ pointerEvents: 'stroke', cursor: 'move' }}
            />
            {isSelected && (
              <>
                <circle cx={el.startX - el.x} cy={el.startY - el.y} r="6" fill="#6366f1" stroke="white" strokeWidth="2" style={{ cursor: 'move' }} />
                <circle cx={el.endX - el.x} cy={el.endY - el.y} r="6" fill="#6366f1" stroke="white" strokeWidth="2" style={{ cursor: 'move' }} />
              </>
            )}
          </svg>
        );

      case 'line':
        return (
          <svg
            key={el.id}
            className={`absolute cursor-move`}
            style={{ ...baseStyle, overflow: 'visible', pointerEvents: 'none' }}
            onClick={(e) => handleElementClick(e, el.id)}
            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
          >
            <line
              x1={el.startX - el.x}
              y1={el.startY - el.y}
              x2={el.endX - el.x}
              y2={el.endY - el.y}
              stroke={el.color}
              strokeWidth={el.strokeWidth}
              strokeDasharray={el.lineStyle === 'dashed' ? '8,4' : el.lineStyle === 'dotted' ? '2,4' : 'none'}
              style={{ pointerEvents: 'stroke', cursor: 'move' }}
            />
            {isSelected && (
              <>
                <circle cx={el.startX - el.x} cy={el.startY - el.y} r="6" fill="#6366f1" stroke="white" strokeWidth="2" />
                <circle cx={el.endX - el.x} cy={el.endY - el.y} r="6" fill="#6366f1" stroke="white" strokeWidth="2" />
              </>
            )}
          </svg>
        );

      case 'image':
        return (
          <div
            key={el.id}
            className={`absolute cursor-move rounded-lg overflow-hidden ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : ''}`}
            style={baseStyle}
            onClick={(e) => handleElementClick(e, el.id)}
            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
          >
            <img src={el.src} alt="" className="w-full h-full object-cover" draggable={false} />
            {renderResizeHandles(el)}
          </div>
        );

      case 'icon':
        const IconComponent = Icons[el.iconType];
        return (
          <div
            key={el.id}
            className={`absolute cursor-move flex items-center justify-center ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900 rounded-lg' : ''}`}
            style={baseStyle}
            onClick={(e) => handleElementClick(e, el.id)}
            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
          >
            <IconComponent className="w-full h-full" style={{ color: el.color }} />
            {renderResizeHandles(el)}
          </div>
        );

      case 'code':
        return (
          <div
            key={el.id}
            className={`absolute cursor-move rounded-xl overflow-hidden ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : ''}`}
            style={{ ...baseStyle, backgroundColor: '#1e293b' }}
            onClick={(e) => handleElementClick(e, el.id)}
            onDoubleClick={() => handleElementDoubleClick(el.id)}
            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-slate-400 ml-2">{el.language}</span>
            </div>
            {editingId === el.id ? (
              <textarea
                autoFocus
                value={el.content}
                onChange={(e) => updateElement(el.id, { content: e.target.value })}
                onBlur={() => setEditingId(null)}
                className="w-full h-[calc(100%-36px)] p-4 bg-transparent text-green-400 resize-none outline-none font-mono"
                style={{ fontSize: el.fontSize }}
                spellCheck={false}
              />
            ) : (
              <pre
                className="w-full h-[calc(100%-36px)] p-4 overflow-auto text-green-400 font-mono whitespace-pre-wrap"
                style={{ fontSize: el.fontSize }}
              >
                {el.content}
              </pre>
            )}
            {renderResizeHandles(el)}
          </div>
        );

      case 'group':
        return (
          <div
            key={el.id}
            className={`absolute border-2 border-dashed border-indigo-400/50 rounded-lg pointer-events-none ${isSelected ? 'border-indigo-500' : ''}`}
            style={baseStyle}
          />
        );

      default:
        return null;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return;

      const key = e.key.toLowerCase();
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        useStore.getState().deleteSelected();
      }
      if (e.key === 'Escape') {
        clearSelection();
        setEditingId(null);
      }
      if (e.ctrlKey && key === 'd') {
        e.preventDefault();
        useStore.getState().duplicate();
      }
      if (e.ctrlKey && key === 'c') {
        useStore.getState().copy();
      }
      if (e.ctrlKey && key === 'v') {
        useStore.getState().paste();
      }
      if (e.ctrlKey && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          useStore.getState().ungroupSelected();
        } else {
          useStore.getState().groupSelected();
        }
      }
      if (e.ctrlKey && key === 's') {
        e.preventDefault();
        useStore.getState().saveProject();
      }
      if (e.ctrlKey && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useStore.getState().redo();
        } else {
          useStore.getState().undo();
        }
      }
      if (e.ctrlKey && key === 'y') {
        e.preventDefault();
        useStore.getState().redo();
      }
      
      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        if (key === 'v') useStore.getState().setTool('select');
        if (key === 'p') useStore.getState().setTool('postit');
        if (key === 't') useStore.getState().setTool('text');
        if (key === 's') useStore.getState().setTool('shape');
        if (key === 'a') useStore.getState().setTool('arrow');
        if (key === 'l') useStore.getState().setTool('line');
        if (key === 'i') useStore.getState().setTool('image');
        if (key === 'o') useStore.getState().setTool('icon');
        if (key === 'c') useStore.getState().setTool('code');
        if (key === 'h') useStore.getState().setTool('pan');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingId, clearSelection]);

  return (
    <>
      <div
        ref={canvasRef}
        className={`w-full h-full overflow-hidden ${tool === 'pan' ? 'cursor-grab' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'} ${isPanning ? 'cursor-grabbing' : ''}`}
        style={{
          background: '#0f172a',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${panX * zoom + 50}% ${panY * zoom + 50}%`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="absolute"
          style={{
            transform: `translate(${panX * zoom}px, ${panY * zoom}px) scale(${zoom})`,
            transformOrigin: 'center center',
            left: '50%',
            top: '50%',
          }}
        >
          {elements.sort((a, b) => a.zIndex - b.zIndex).map(renderElement)}
        </div>

        {/* Selection Box */}
        {selectionBox && (
          <div
            className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-none"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.endX) * zoom + panX * zoom + window.innerWidth / 2,
              top: Math.min(selectionBox.startY, selectionBox.endY) * zoom + panY * zoom + window.innerHeight / 2,
              width: Math.abs(selectionBox.endX - selectionBox.startX) * zoom,
              height: Math.abs(selectionBox.endY - selectionBox.startY) * zoom,
            }}
          />
        )}
      </div>
      
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </>
  );
};

// ========== APP ==========
export default function App() {
  return (
    <div className="w-full h-full bg-slate-900 overflow-hidden">
      <Toolbar />
      <div className="pt-14 sm:pt-16 h-full">
        <Canvas />
      </div>
      <PropertiesPanel />
      <MiniMap />
      <ZoomControls />
    </div>
  );
}
