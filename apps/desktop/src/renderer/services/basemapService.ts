/**
 * 位图底图服务（T5a）—— 图片（PNG/JPG/JPEG）→ 底图 IMAGE 图元
 *
 * 决策 3.3：把位图包装成一条 DXF 风格 `IMAGE` 图元塞进 `drawing.entities`，
 * `data.imagePath` 存 dataURL（本次会话内联，避免落盘缓存与体积治理问题），
 * `layer='BASEMAP'` 与标注层隔离（拾取跳过、可整体隐藏）。
 *
 * 说明：
 *  - 渲染侧 `cad-renderer.drawImage` 已实现，按 `data.imagePath` 从 imageCache 取图；
 *  - 导出侧走"渲染进程画布快照"通道（`canvasSnapshots`），底图随快照一并进入点位图/PDF；
 *  - DXF 导出仅含矢量标注层（底图不含），AC-7.4 已在导出前告知。
 *  - PDF 栅格化（pdfjs）为下一里程碑，本文件当前只覆盖位图格式。
 */
import type { GraphicEntity } from '@security-survey/shared-types';

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
};

/** 本服务当前支持的位图扩展名（不含 PDF） */
export const RASTER_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] as const;

export function isRaster(pathOrName: string): boolean {
  const m = /\.([A-Za-z0-9]+)$/.exec(pathOrName || '');
  if (!m) return false;
  return (RASTER_EXTENSIONS as readonly string[]).includes(m[1].toLowerCase());
}

function extOf(path: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(path || '');
  return m ? m[1].toLowerCase() : '';
}

function mimeFor(path: string): string {
  return MIME_BY_EXT[extOf(path)] || 'application/octet-stream';
}

/** 读文件为 dataURL（经主进程 fs:readFileBase64，二进制安全） */
export async function readAsDataUrl(path: string): Promise<string> {
  if (!window.api?.fs?.readFileBase64) {
    throw new Error('桥接不可用：无法读取位图文件');
  }
  const b64 = await window.api.fs.readFileBase64(path);
  if (!b64) throw new Error('读取位图文件失败（空内容）');
  return `data:${mimeFor(path)};base64,${b64}`;
}

/** 读取图片 intrinsic 宽高（加载到 Image 后取 naturalWidth/Height） */
export function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = dataUrl;
  });
}

let seq = 0;

/** 把 dataURL 包装成 BASEMAP 图元（左上角对齐原点，模型坐标单位 = 像素） */
export function imageToEntity(dataUrl: string, width: number, height: number): GraphicEntity {
  seq += 1;
  return {
    id: `basemap-${Date.now()}-${seq}`,
    type: 'IMAGE',
    layer: 'BASEMAP',
    color: 256, // ByBlock
    lineType: 'CONTINUOUS',
    lineWeight: 0,
    visible: true,
    data: {
      position: { x: 0, y: 0 },
      size: { width, height },
      rotation: 0,
      imagePath: dataUrl,
    },
    bounds: { minX: 0, minY: 0, maxX: width, maxY: height, width, height },
  } as GraphicEntity;
}

/** 图片路径 → 底图图元（读 base64 → 取尺寸 → 生成 IMAGE 图元） */
export async function rasterToEntity(path: string): Promise<GraphicEntity> {
  const dataUrl = await readAsDataUrl(path);
  const { width, height } = await loadImageSize(dataUrl);
  return imageToEntity(dataUrl, width, height);
}

/** 把底图图元挂到图纸上：加入 entities 并确保存在 BASEMAP 图层 */
export function attachBasemap(drawing: {
  entities: GraphicEntity[];
  layers: Array<{ name: string; color?: number; visible?: boolean; locked?: boolean; lineType?: string; lineWeight?: number }>;
}, entity: GraphicEntity): void {
  // 覆盖旧的 BASEMAP 图元，保证重导入/重链接不堆叠
  drawing.entities = drawing.entities.filter(e => e.layer !== 'BASEMAP');
  drawing.entities.push(entity);
  if (!drawing.layers.some(l => l.name === 'BASEMAP')) {
    drawing.layers.push({ name: 'BASEMAP', color: 7, visible: true, locked: true, lineType: 'CONTINUOUS', lineWeight: 0 });
  }
}
