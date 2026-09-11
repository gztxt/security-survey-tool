/**
 * 位图底图服务（T5）—— 图片（PNG/JPG/JPEG）与 PDF → 底图 IMAGE 图元
 *
 * 决策 3.3：把位图/PDF 首页包装成一条 DXF 风格 `IMAGE` 图元塞进 `drawing.entities`，
 * `data.imagePath` 存 dataURL（本次会话内联，避免落盘缓存与体积治理问题），
 * `layer='BASEMAP'` 与标注层隔离（拾取跳过、可整体隐藏）。
 *
 * 说明：
 *  - 渲染侧 `cad-renderer.drawImage` 已实现，按 `data.imagePath` 从 imageCache 取图；
 *  - 导出侧走"渲染进程画布快照"通道（`canvasSnapshots`），底图随快照一并进入点位图/PDF；
 *  - DXF 导出仅含矢量标注层（底图不含），AC-7.4 已在导出前告知；
 *  - PDF 依赖 pdfjs-dist，采用「懒加载 + 按需 worker」，纯函数（imageToEntity/attachBasemap/
 *    isRaster/isPdf）不触达 pdfjs，保证单测环境（jsdom）可隔离运行。
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

/** 本服务支持的位图扩展名（不含 PDF） */
export const RASTER_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] as const;

export function isRaster(pathOrName: string): boolean {
  const m = /\.([A-Za-z0-9]+)$/.exec(pathOrName || '');
  if (!m) return false;
  return (RASTER_EXTENSIONS as readonly string[]).includes(m[1].toLowerCase());
}

/** 是否 PDF 底图 */
export function isPdf(pathOrName: string): boolean {
  const m = /\.([A-Za-z0-9]+)$/.exec(pathOrName || '');
  return !!m && m[1].toLowerCase() === 'pdf';
}

/** PDF 栅格化缩放（AC-1.3 "scale=2" 清晰度要求） */
export const PDF_RASTER_SCALE = 2;

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

/**
 * 把 dataURL 包装成 BASEMAP 图元（左上角对齐原点，模型坐标单位 = 像素）。
 * meta 记录来源信息（sourcePath / pageIndex），保存时仅保留 meta 而剔除 dataURL，
 * 打开项目时按 sourcePath 重栅格化（决策 3.3 的体积治理 + AC-5 重开闭环）。
 */
export function imageToEntity(
  dataUrl: string,
  width: number,
  height: number,
  meta?: { sourcePath?: string; pageIndex?: number },
): GraphicEntity {
  seq += 1;
  const data: any = {
    position: { x: 0, y: 0 },
    size: { width, height },
    rotation: 0,
    imagePath: dataUrl,
  };
  if (meta?.sourcePath) data.sourcePath = meta.sourcePath;
  if (typeof meta?.pageIndex === 'number') data.pageIndex = meta.pageIndex;
  return {
    id: `basemap-${Date.now()}-${seq}`,
    type: 'IMAGE',
    layer: 'BASEMAP',
    color: 256, // ByBlock
    lineType: 'CONTINUOUS',
    lineWeight: 0,
    visible: true,
    data,
    bounds: { minX: 0, minY: 0, maxX: width, maxY: height, width, height },
  } as GraphicEntity;
}

/** 图片路径 → 底图图元（读 base64 → 取尺寸 → 生成 IMAGE 图元） */
export async function rasterToEntity(path: string): Promise<GraphicEntity> {
  const dataUrl = await readAsDataUrl(path);
  const { width, height } = await loadImageSize(dataUrl);
  return imageToEntity(dataUrl, width, height, { sourcePath: path });
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

// ============ PDF 栅格化（pdfjs-dist 懒加载，隔离 jsdom 单测）============

/** 经主进程读文件二进制为 base64（二进制安全，PDF/位图共用） */
async function readFileBase64(path: string): Promise<string> {
  if (!window.api?.fs?.readFileBase64) {
    throw new Error('桥接不可用：无法读取文件');
  }
  const b64 = await window.api.fs.readFileBase64(path);
  if (!b64) throw new Error('读取文件失败（空内容）');
  return b64;
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let pdfjsPromise: Promise<any> | null = null;

/**
 * 懒加载 pdfjs-dist 并本地化 worker（决策 3.3：worker 走 Vite `?url` 资源，
 * 构建后为相对路径 `./assets/pdf.worker.min-*.mjs`，file:// 下可正确解析）。
 */
function loadPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib: any = await import('pdfjs-dist');
      const workerUrl: string = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
}

/** 读取 PDF 页数（不渲染页面） */
export async function getPdfPageCount(path: string): Promise<number> {
  const b64 = await readFileBase64(path);
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: base64ToUint8(b64) }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

/** 渲染 PDF 第 pageIndex（0 起）页为 PNG dataURL 与像素尺寸（scale=2） */
export async function pdfPageToDataUrl(
  path: string,
  pageIndex = 0,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const b64 = await readFileBase64(path);
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: base64ToUint8(b64) }).promise;
  try {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: PDF_RASTER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 PDF 栅格化画布');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, width: viewport.width, height: viewport.height };
  } finally {
    await doc.destroy();
  }
}

/** PDF 路径 → 底图图元（渲染指定页，默认首页） */
export async function pdfToEntity(path: string, pageIndex = 0): Promise<GraphicEntity> {
  const { dataUrl, width, height } = await pdfPageToDataUrl(path, pageIndex);
  return imageToEntity(dataUrl, width, height, { sourcePath: path, pageIndex });
}

/**
 * 重水合：按底图图元上记录的 sourcePath（+ pageIndex）重新栅格化，回填 imagePath 与尺寸。
 * 用于打开项目时恢复被保存流程剥离的 dataURL（AC-5）。返回是否成功。
 */
export async function rehydrateBasemapEntity(entity: GraphicEntity): Promise<boolean> {
  const d = (entity.data as any) || {};
  const src = d.sourcePath as string | undefined;
  if (!src) return false;
  const pageIndex = typeof d.pageIndex === 'number' ? d.pageIndex : 0;
  const rebuilt = isPdf(src) ? await pdfToEntity(src, pageIndex) : await rasterToEntity(src);
  d.imagePath = (rebuilt.data as any).imagePath;
  d.size = (rebuilt.data as any).size;
  d.position = (rebuilt.data as any).position;
  entity.bounds = rebuilt.bounds;
  return true;
}
