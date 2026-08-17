/**
 * Dictionary namespace for the viewer panel. The DSH locale service supplies
 * the `t` translate function to slot components registered with `locale: NS`.
 */

export const NS = 'dsh3d'

export interface ViewerKey {
  'title': string
  'load': string
  'loadHint': string
  'empty': string
  'emptyHint': string
  'stats': string
  'material': string
  'color': string
  'metalness': string
  'roughness': string
  'wireframe': string
  'lighting': string
  'ambient': string
  'key': string
  'section': string
  'sectionOn': string
  'sectionAxis': string
  'sectionOffset': string
  'resetView': string
  'sendToAi': string
  'sendNow': string
  'downloadJson': string
  'copyJson': string
  'copied': string
  'noSession': string
  'sending': string
  'sent': string
  'error': string
}

export const en: Record<keyof ViewerKey, string> = {
  title: '3D Model Viewer',
  load: 'Load model',
  loadHint: 'OBJ, STL, STEP (.obj .stl .stp .step)',
  empty: 'No model loaded',
  emptyHint: 'Load a 3D model to view, inspect and send it to the conversation.',
  stats: 'Stats',
  material: 'Material',
  color: 'Color',
  metalness: 'Metalness',
  roughness: 'Roughness',
  wireframe: 'Wireframe',
  lighting: 'Lighting',
  ambient: 'Ambient',
  key: 'Key light',
  section: 'Section',
  sectionOn: 'Enable',
  sectionAxis: 'Axis',
  sectionOffset: 'Offset',
  resetView: 'Reset view',
  sendToAi: 'Send to AI',
  sendNow: 'Send now',
  downloadJson: 'Download JSON',
  copyJson: 'Copy JSON',
  copied: 'Copied',
  noSession: 'Open a conversation first',
  sending: 'Sending…',
  sent: 'Sent',
  error: 'Error',
}

export const zh: Record<keyof ViewerKey, string> = {
  title: '三维模型查看器',
  load: '加载模型',
  loadHint: 'OBJ / STL / STEP (.obj .stl .stp .step)',
  empty: '未加载模型',
  emptyHint: '加载一个三维模型，即可查看、调节并发送到对话。',
  stats: '统计',
  material: '材质',
  color: '颜色',
  metalness: '金属度',
  roughness: '粗糙度',
  wireframe: '线框',
  lighting: '光照',
  ambient: '环境光',
  key: '主光源',
  section: '剖面',
  sectionOn: '启用',
  sectionAxis: '轴向',
  sectionOffset: '偏移',
  resetView: '重置视角',
  sendToAi: '发送到 AI',
  sendNow: '立即发送',
  downloadJson: '下载 JSON',
  copyJson: '复制 JSON',
  copied: '已复制',
  noSession: '请先打开一个对话',
  sending: '发送中…',
  sent: '已发送',
  error: '错误',
}
