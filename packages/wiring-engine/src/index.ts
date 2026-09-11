// 布线引擎核心模块
// 自动布线（MST/启发式）、手动布线、长度计算、拓扑生成

import {
  Cable,
  CableType,
  DeviceInstance,
  WeakPoint,
  CableTray,
  TopologyNode,
  Point2D,
  WiringNetwork,
} from '@security-survey/shared-types';

// ============ 常量 ============

const CABLE_SLACK_FACTOR = 1.15;      // 盘留系数 15%
const VERTICAL_DROP_PER_FLOOR = 3.5;  // 每层垂直落差(米)
const MIN_CABLE_LENGTH = 1;           // 最小线缆长度(米)
const ORTHOGONAL_TOLERANCE = 0.5;     // 正交化容差(米)

// ============ 类型定义 ============

interface RoutingNode {
  id: string;
  type: 'device' | 'well' | 'tray_junction' | 'switch' | 'nvr';
  position: Point2D;
  refId: string;           // 原始对象ID
  floor: string;           // 楼层
  connections: string[];   // 连接的线缆ID
}

interface RoutingEdge {
  id: string;
  from: string;
  to: string;
  length: number;
  type: CableType;
  path: Point2D[];
  trayIds: string[];
}

interface AutoWiringOptions {
  slackFactor?: number;
  preferTrays?: boolean;
  orthogonalOnly?: boolean;
  maxLength?: number;      // 单根线缆最大长度
  groupBySwitch?: boolean; // 按交换机分组
}

// ============ 布线引擎主类 ============

export class WiringEngine {
  private devices: Map<string, DeviceInstance> = new Map();
  private weakPoints: Map<string, WeakPoint> = new Map();
  private cableTrays: Map<string, CableTray> = new Map();
  private cables: Map<string, Cable> = new Map();
  private topologyNodes: Map<string, TopologyNode> = new Map();

  // ============ 数据设置 ============

  setDevices(devices: DeviceInstance[]): void {
    this.devices.clear();
    for (const d of devices) this.devices.set(d.id, d);
  }

  setWeakPoints(wells: WeakPoint[]): void {
    this.weakPoints.clear();
    for (const w of wells) this.weakPoints.set(w.id, w);
  }

  setCableTrays(trays: CableTray[]): void {
    this.cableTrays.clear();
    for (const t of trays) this.cableTrays.set(t.id, t);
  }

  setCables(cables: Cable[]): void {
    this.cables.clear();
    for (const c of cables) this.cables.set(c.id, c);
  }

  // ============ 核心：自动布线 ============

  /**
   * 自动生成布线拓扑
   * 算法：以弱电井为根，构建最小生成树(MST)，边权为欧氏距离×盘留系数
   * 可选：按交换机分组生成星型拓扑
   */
  autoWire(options: AutoWiringOptions = {}): { cables: Cable[]; topology: TopologyNode[] } {
    const {
      slackFactor = CABLE_SLACK_FACTOR,
      preferTrays = true,
      orthogonalOnly = true,
      maxLength = 100,
      groupBySwitch = true,
    } = options;

    // 1. 收集所有需要布线的终端（摄像头等）
    const terminals = this.collectTerminals();

    // 2. 确定聚集点（弱电井/交换机位置）
    const aggregationPoints = this.collectAggregationPoints();

    // 3. 为每个终端分配最近的聚集点
    const assignments = this.assignTerminalsToAggregation(terminals, aggregationPoints);

    // 4. 生成线缆路径
    const newCables: Cable[] = [];
    for (const { terminal, aggregationPoint } of assignments) {
      const path = this.computePath(terminal.position, aggregationPoint.position, {
        preferTrays,
        orthogonalOnly,
        trays: Array.from(this.cableTrays.values()),
      });

      const length = this.calculatePathLength(path);
      const correctedLength = Math.max(length * slackFactor, MIN_CABLE_LENGTH);

      if (correctedLength > maxLength) {
        console.warn(`线缆过长: ${terminal.id} -> ${aggregationPoint.id} = ${correctedLength.toFixed(1)}m > ${maxLength}m`);
      }

      const cable: Cable = {
        id: this.genId(),
        type: this.inferCableType(terminal),
        path,
        length,
        correctedLength,
        startDeviceId: terminal.id,
        endDeviceId: aggregationPoint.id,
        trayIds: this.findTraysAlongPath(path),
        status: 'auto',
        color: this.getCableColor(this.inferCableType(terminal)),
        label: `${terminal.id}-${aggregationPoint.id}`,
      };
      newCables.push(cable);
    }

    // 5. 聚集点间连接（弱电井级联/汇聚交换机上联）
    if (aggregationPoints.length > 1) {
      const backboneCables = this.generateBackbone(aggregationPoints, {
        slackFactor,
        preferTrays,
        orthogonalOnly,
      });
      newCables.push(...backboneCables);
    }

    // 6. 生成拓扑图数据
    const topology = this.generateTopology(newCables, terminals, aggregationPoints);

    // 更新内部状态
    for (const c of newCables) this.cables.set(c.id, c);
    this.topologyNodes = new Map(topology.map(n => [n.id, n]));

    return { cables: newCables, topology };
  }

  // ============ 手动布线 ============

  /**
   * 手动添加线缆：起点设备 -> 途经点 -> 终点设备/井
   */
  manualWire(
    startId: string,
    endId: string,
    waypoints: Point2D[] = [],
    cableType: CableType = 'cat6'
  ): Cable | null {
    const start = this.getNodePosition(startId);
    const end = this.getNodePosition(endId);
    if (!start || !end) return null;

    const path = [start, ...waypoints, end];
    const length = this.calculatePathLength(path);
    const correctedLength = length * CABLE_SLACK_FACTOR;

    const cable: Cable = {
      id: this.genId(),
      type: cableType,
      path,
      length,
      correctedLength,
      startDeviceId: startId,
      endDeviceId: endId,
      trayIds: this.findTraysAlongPath(path),
      status: 'manual',
      color: this.getCableColor(cableType),
      label: `${startId}-${endId}`,
    };

    this.cables.set(cable.id, cable);
    return cable;
  }

  /**
   * 调整线缆路径（拖拽折点）
   */
  adjustCablePath(cableId: string, newPath: Point2D[]): boolean {
    const cable = this.cables.get(cableId);
    if (!cable) return false;

    cable.path = newPath;
    cable.length = this.calculatePathLength(newPath);
    cable.correctedLength = cable.length * CABLE_SLACK_FACTOR;
    cable.trayIds = this.findTraysAlongPath(newPath);
    cable.status = 'modified';
    return true;
  }

  // ============ 拓扑生成 ============

  /**
   * 生成拓扑图节点（用于 dagre 布局）
   */
  generateTopology(
    cables: Cable[],
    terminals: RoutingNode[],
    aggregationPoints: RoutingNode[]
  ): TopologyNode[] {
    const nodes: TopologyNode[] = [];
    const nodeMap = new Map<string, TopologyNode>();

    // 创建设备节点
    for (const t of terminals) {
      const node: TopologyNode = {
        id: `topo-${t.id}`,
        type: 'device',
        refId: t.id,
        position: { x: 0, y: 0 }, // dagre 会重新布局
        children: [],
        metadata: { deviceType: 'camera', label: t.refId },
      };
      nodes.push(node);
      nodeMap.set(t.id, node);
    }

    // 创建聚集点节点（弱电井/交换机）
    for (const a of aggregationPoints) {
      const node: TopologyNode = {
        id: `topo-${a.id}`,
        type: a.type === 'well' ? 'weak_point' : 'switch',
        refId: a.id,
        position: { x: 0, y: 0 },
        children: [],
        metadata: { label: a.refId },
      };
      nodes.push(node);
      nodeMap.set(a.id, node);
    }

    // 建立父子关系
    for (const cable of cables) {
      const parent = nodeMap.get(cable.endDeviceId);
      const child = nodeMap.get(cable.startDeviceId);
      if (parent && child) {
        parent.children.push(child.id);
      }
    }

    return nodes;
  }

  // ============ 线缆长度统计 ============

  /**
   * 按类型汇总线缆长度
   */
  summarizeCableLengths(): Record<CableType, { count: number; totalLength: number; totalCorrected: number }> {
    const summary: Record<CableType, { count: number; totalLength: number; totalCorrected: number }> = {
      cat6: { count: 0, totalLength: 0, totalCorrected: 0 },
      cat6a: { count: 0, totalLength: 0, totalCorrected: 0 },
      cat7: { count: 0, totalLength: 0, totalCorrected: 0 },
      fiber_sm: { count: 0, totalLength: 0, totalCorrected: 0 },
      fiber_mm: { count: 0, totalLength: 0, totalCorrected: 0 },
      power: { count: 0, totalLength: 0, totalCorrected: 0 },
      custom: { count: 0, totalLength: 0, totalCorrected: 0 },
    };

    for (const cable of this.cables.values()) {
      const s = summary[cable.type];
      s.count++;
      s.totalLength += cable.length;
      s.totalCorrected += cable.correctedLength;
    }

    return summary;
  }

  // ============ 私有辅助方法 ============

  private collectTerminals(): RoutingNode[] {
    const nodes: RoutingNode[] = [];
    for (const [id, device] of this.devices) {
      // 只布线需要网络的设备（摄像头、门禁等）
      if (this.needsNetwork(device)) {
        nodes.push({
          id,
          type: 'device',
          position: device.position,
          refId: id,
          floor: '', // 可从 drawingId 映射
          connections: [],
        });
      }
    }
    return nodes;
  }

  private collectAggregationPoints(): RoutingNode[] {
    const nodes: RoutingNode[] = [];
    for (const [id, well] of this.weakPoints) {
      nodes.push({
        id,
        type: 'well',
        position: well.position,
        refId: id,
        floor: '',
        connections: [],
      });
    }
    // 可扩展：添加交换机位置
    return nodes;
  }

  private assignTerminalsToAggregation(
    terminals: RoutingNode[],
    aggregations: RoutingNode[]
  ): { terminal: RoutingNode; aggregationPoint: RoutingNode }[] {
    const assignments: { terminal: RoutingNode; aggregationPoint: RoutingNode }[] = [];

    for (const terminal of terminals) {
      let nearest = aggregations[0];
      let minDist = Infinity;

      for (const agg of aggregations) {
        const dist = this.distance(terminal.position, agg.position);
        if (dist < minDist) {
          minDist = dist;
          nearest = agg;
        }
      }
      assignments.push({ terminal, aggregationPoint: nearest });
    }

    return assignments;
  }

  private computePath(
    from: Point2D,
    to: Point2D,
    options: { preferTrays: boolean; orthogonalOnly: boolean; trays: CableTray[] }
  ): Point2D[] {
    const { preferTrays, orthogonalOnly, trays } = options;

    if (preferTrays && trays.length > 0) {
      // 寻找最近的桥架路径
      const trayPath = this.findTrayPath(from, to, trays);
      if (trayPath) return trayPath;
    }

    // 直线或正交路径
    if (orthogonalOnly) {
      return this.orthogonalPath(from, to);
    }

    return [from, to]; // 直线
  }

  private findTrayPath(from: Point2D, to: Point2D, trays: CableTray[]): Point2D[] | null {
    // 简化：找到距离起点和终点最近的桥架段，拼接路径
    // 实际应用需构建桥架拓扑图，用 Dijkstra/A* 寻路
    let bestTray: CableTray | null = null;
    let bestDist = Infinity;

    for (const tray of trays) {
      const distToStart = this.pointToPolylineDistance(from, tray.path);
      const distToEnd = this.pointToPolylineDistance(to, tray.path);
      const total = distToStart + distToEnd;
      if (total < bestDist) {
        bestDist = total;
        bestTray = tray;
      }
    }

    if (!bestTray) return null;

    // 找到桥架上最近的点
    const onTrayStart = this.closestPointOnPolyline(from, bestTray.path);
    const onTrayEnd = this.closestPointOnPolyline(to, bestTray.path);

    return [from, onTrayStart, onTrayEnd, to];
  }

  private orthogonalPath(from: Point2D, to: Point2D): Point2D[] {
    // L型正交路径：先水平后垂直（或相反），取较短者
    const path1: Point2D[] = [from, { x: to.x, y: from.y }, to];
    const path2: Point2D[] = [from, { x: from.x, y: to.y }, to];

    const len1 = this.calculatePathLength(path1);
    const len2 = this.calculatePathLength(path2);

    return len1 < len2 ? path1 : path2;
  }

  private generateBackbone(
    aggregations: RoutingNode[],
    options: { slackFactor: number; preferTrays: boolean; orthogonalOnly: boolean }
  ): Cable[] {
    if (aggregations.length <= 1) return [];

    // 以第一个聚集点为根，构建 MST
    const nodes = [...aggregations];
    const edges: { from: RoutingNode; to: RoutingNode; weight: number }[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = this.distance(nodes[i].position, nodes[j].position);
        edges.push({ from: nodes[i], to: nodes[j], weight: dist });
      }
    }

    // Kruskal MST
    edges.sort((a, b) => a.weight - b.weight);
    const parent = new Map<string, string>();
    for (const n of nodes) parent.set(n.id, n.id);

    const find = (id: string): string => {
      const p = parent.get(id)!;
      return p === id ? id : find(p);
    };
    const union = (a: string, b: string) => {
      parent.set(find(a), find(b));
    };

    const cables: Cable[] = [];
    for (const edge of edges) {
      if (find(edge.from.id) !== find(edge.to.id)) {
        union(edge.from.id, edge.to.id);
        const path = this.computePath(edge.from.position, edge.to.position, {
          preferTrays: options.preferTrays,
          orthogonalOnly: options.orthogonalOnly,
          trays: Array.from(this.cableTrays.values()),
        });
        const length = this.calculatePathLength(path);
        cables.push({
          id: this.genId(),
          type: 'fiber_sm', // 骨干建议光纤
          path,
          length,
          correctedLength: length * options.slackFactor,
          startDeviceId: edge.from.id,
          endDeviceId: edge.to.id,
          trayIds: this.findTraysAlongPath(path),
          status: 'auto',
          color: this.getCableColor('fiber_sm'),
          label: `Backbone-${edge.from.id}-${edge.to.id}`,
        });
      }
    }

    return cables;
  }

  private findTraysAlongPath(path: Point2D[]): string[] {
    const trayIds: string[] = [];
    for (const [id, tray] of this.cableTrays) {
      for (let i = 1; i < path.length; i++) {
        if (this.segmentsIntersect(path[i - 1], path[i], tray.path)) {
          trayIds.push(id);
          break;
        }
      }
    }
    return trayIds;
  }

  private segmentsIntersect(p1: Point2D, p2: Point2D, poly: Point2D[]): boolean {
    for (let i = 1; i < poly.length; i++) {
      if (this.lineSegmentsIntersect(p1, p2, poly[i - 1], poly[i])) return true;
    }
    return false;
  }

  private lineSegmentsIntersect(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): boolean {
    const cross = (p: Point2D, q: Point2D, r: Point2D) =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

    const d1 = cross(a1, a2, b1);
    const d2 = cross(a1, a2, b2);
    const d3 = cross(b1, b2, a1);
    const d4 = cross(b1, b2, a2);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;

    if (d1 === 0 && this.onSegment(a1, b1, a2)) return true;
    if (d2 === 0 && this.onSegment(a1, b2, a2)) return true;
    if (d3 === 0 && this.onSegment(b1, a1, b2)) return true;
    if (d4 === 0 && this.onSegment(b1, a2, b2)) return true;

    return false;
  }

  private onSegment(p: Point2D, q: Point2D, r: Point2D): boolean {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
           q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  }

  private inferCableType(device: RoutingNode): CableType {
    // 根据设备类型推断：摄像头默认 Cat6，远距离/大带宽用光纤
    const dev = this.devices.get(device.refId);
    if (!dev) return 'cat6';

    // 可根据设备规格判断：8MP+ 或距离>90m 用光纤
    return 'cat6';
  }

  private needsNetwork(device: DeviceInstance): boolean {
    // 录像机、交换机不需要布网线（它们是汇聚点）
    return true; // 简化：所有设备都布线
  }

  private getNodePosition(nodeId: string): Point2D | null {
    const dev = this.devices.get(nodeId);
    if (dev) return dev.position;
    const well = this.weakPoints.get(nodeId);
    if (well) return well.position;
    return null;
  }

  private calculatePathLength(path: Point2D[]): number {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      len += this.distance(path[i - 1], path[i]);
    }
    return len;
  }

  private distance(a: Point2D, b: Point2D): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pointToPolylineDistance(point: Point2D, poly: Point2D[]): number {
    let minDist = Infinity;
    for (let i = 1; i < poly.length; i++) {
      const d = this.pointToLineDistance(point, poly[i - 1], poly[i]);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  private pointToLineDistance(p: Point2D, a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return this.distance(p, a);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  }

  private closestPointOnPolyline(point: Point2D, poly: Point2D[]): Point2D {
    let closest = poly[0];
    let minDist = Infinity;

    for (let i = 1; i < poly.length; i++) {
      const proj = this.projectPointToSegment(point, poly[i - 1], poly[i]);
      const dist = this.distance(point, proj);
      if (dist < minDist) {
        minDist = dist;
        closest = proj;
      }
    }
    return closest;
  }

  private projectPointToSegment(p: Point2D, a: Point2D, b: Point2D): Point2D {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return a;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  private getCableColor(type: CableType): string {
    const colors: Record<CableType, string> = {
      cat6: '#3B82F6', cat6a: '#2563EB', cat7: '#1D4ED8',
      fiber_sm: '#F59E0B', fiber_mm: '#FBBF24',
      power: '#EF4444', custom: '#8B5CF6',
    };
    return colors[type];
  }

  private genId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  // ============ 状态获取 ============

  getCables(): Cable[] {
    return Array.from(this.cables.values());
  }

  getTopology(): TopologyNode[] {
    return Array.from(this.topologyNodes.values());
  }
}

// ============ 单例导出 ============

export const wiringEngine = new WiringEngine();