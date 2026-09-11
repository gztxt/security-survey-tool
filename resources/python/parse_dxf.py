#!/usr/bin/env python3
"""
DXF 解析脚本
作为 Electron Python sidecar 运行，解析 DXF 文件并输出 JSON
"""

import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional
import ezdxf
from ezdxf.entities import DXFEntity


def entity_to_dict(entity: DXFEntity) -> Optional[Dict[str, Any]]:
    """将 ezdxf 实体转换为标准化字典"""
    try:
        dxf = entity.dxf
        common = {
            'layer': dxf.layer if hasattr(dxf, 'layer') else '0',
            'color': dxf.color if hasattr(dxf, 'color') else 256,
            'lineType': dxf.linetype if hasattr(dxf, 'linetype') else 'BYLAYER',
            'lineWeight': dxf.lineweight if hasattr(dxf, 'lineweight') else -1,
        }

        etype = entity.dxftype()

        if etype == 'LINE':
            return {
                **common,
                'type': 'LINE',
                'data': {
                    'start': {'x': float(dxf.start.x), 'y': float(dxf.start.y)},
                    'end': {'x': float(dxf.end.x), 'y': float(dxf.end.y)},
                }
            }

        elif etype in ('LWPOLYLINE', 'POLYLINE'):
            vertices = []
            bulges = []
            if etype == 'LWPOLYLINE':
                for v in dxf.vertices:
                    vertices.append({'x': float(v[0]), 'y': float(v[1])})
                    bulges.append(float(v[3]) if len(v) > 3 else 0.0)
                closed = dxf.closed
                width = float(dxf.width) if hasattr(dxf, 'width') else 0
                vertex_widths = None
            else:  # POLYLINE
                for v in entity.vertices:
                    vertices.append({'x': float(v.dxf.location.x), 'y': float(v.dxf.location.y)})
                    bulges.append(float(v.dxf.bulge))
                closed = dxf.closed
                width = 0
                vertex_widths = None

            return {
                **common,
                'type': 'LWPOLYLINE',
                'data': {
                    'vertices': vertices,
                    'bulges': bulges,
                    'closed': bool(closed),
                    'width': width,
                    'vertexWidths': vertex_widths,
                }
            }

        elif etype == 'ARC':
            return {
                **common,
                'type': 'ARC',
                'data': {
                    'center': {'x': float(dxf.center.x), 'y': float(dxf.center.y)},
                    'radius': float(dxf.radius),
                    'startAngle': float(dxf.start_angle),
                    'endAngle': float(dxf.end_angle),
                }
            }

        elif etype == 'CIRCLE':
            return {
                **common,
                'type': 'CIRCLE',
                'data': {
                    'center': {'x': float(dxf.center.x), 'y': float(dxf.center.y)},
                    'radius': float(dxf.radius),
                }
            }

        elif etype == 'TEXT':
            return {
                **common,
                'type': 'TEXT',
                'data': {
                    'position': {'x': float(dxf.insert.x), 'y': float(dxf.insert.y)},
                    'text': dxf.text,
                    'height': float(dxf.height),
                    'rotation': float(dxf.rotation) if hasattr(dxf, 'rotation') else 0.0,
                    'hAlign': dxf.halign if hasattr(dxf, 'halign') else 0,
                    'vAlign': dxf.valign if hasattr(dxf, 'valign') else 0,
                    'style': dxf.style if hasattr(dxf, 'style') else 'STANDARD',
                }
            }

        elif etype == 'MTEXT':
            return {
                **common,
                'type': 'MTEXT',
                'data': {
                    'position': {'x': float(dxf.insert.x), 'y': float(dxf.insert.y)},
                    'text': dxf.text,
                    'width': float(dxf.width) if hasattr(dxf, 'width') else 0,
                    'height': float(dxf.char_height) if hasattr(dxf, 'char_height') else 2.5,
                    'rotation': float(dxf.rotation) if hasattr(dxf, 'rotation') else 0.0,
                    'attachmentPoint': dxf.attachment_point if hasattr(dxf, 'attachment_point') else 1,
                    'lineSpacing': float(dxf.line_spacing_factor) if hasattr(dxf, 'line_spacing_factor') else 1.0,
                }
            }

        elif etype == 'INSERT':
            attribs = {}
            for attrib in entity.attribs:
                attribs[attrib.dxf.tag] = attrib.dxf.text

            return {
                **common,
                'type': 'INSERT',
                'data': {
                    'blockName': dxf.name,
                    'position': {'x': float(dxf.insert.x), 'y': float(dxf.insert.y)},
                    'scale': {
                        'x': float(dxf.xscale) if hasattr(dxf, 'xscale') else 1.0,
                        'y': float(dxf.yscale) if hasattr(dxf, 'yscale') else 1.0,
                        'z': float(dxf.zscale) if hasattr(dxf, 'zscale') else 1.0,
                    },
                    'rotation': float(dxf.rotation) if hasattr(dxf, 'rotation') else 0.0,
                    'attributes': attribs,
                }
            }

        elif etype == 'HATCH':
            loops = []
            for path in entity.paths:
                if path.path_type == 1:  # 外部轮廓
                    loop_vertices = []
                    for edge in path.edges:
                        if hasattr(edge, 'start'):
                            loop_vertices.append({'x': float(edge.start.x), 'y': float(edge.start.y)})
                            loop_vertices.append({'x': float(edge.end.x), 'y': float(edge.end.y)})
                    if loop_vertices:
                        loops.append(loop_vertices)

            return {
                **common,
                'type': 'HATCH',
                'data': {
                    'patternName': dxf.pattern_name if hasattr(dxf, 'pattern_name') else 'SOLID',
                    'scale': float(dxf.pattern_scale) if hasattr(dxf, 'pattern_scale') else 1.0,
                    'angle': float(dxf.pattern_angle) if hasattr(dxf, 'pattern_angle') else 0.0,
                    'loops': loops,
                    'solidFill': dxf.solid_fill if hasattr(dxf, 'solid_fill') else True,
                }
            }

        elif etype == 'DIMENSION':
            defpoints = []
            for p in dxf.defpoints:
                defpoints.append({'x': float(p.x), 'y': float(p.y)})

            return {
                **common,
                'type': 'DIMENSION',
                'data': {
                    'dimType': dxf.dimtype if hasattr(dxf, 'dimtype') else 0,
                    'defPoints': defpoints,
                    'textPosition': {'x': float(dxf.text_midpoint.x), 'y': float(dxf.text_midpoint.y)},
                    'dimensionText': dxf.text if hasattr(dxf, 'text') else '',
                    'style': dxf.dimstyle if hasattr(dxf, 'dimstyle') else 'STANDARD',
                }
            }

        elif etype == 'POINT':
            return {
                **common,
                'type': 'POINT',
                'data': {
                    'position': {'x': float(dxf.location.x), 'y': float(dxf.location.y)},
                }
            }

        elif etype == 'SPLINE':
            control_points = []
            for p in dxf.control_points:
                control_points.append({'x': float(p.x), 'y': float(p.y)})

            return {
                **common,
                'type': 'SPLINE',
                'data': {
                    'controlPoints': control_points,
                    'knots': [float(k) for k in dxf.knots] if hasattr(dxf, 'knots') else [],
                    'degree': int(dxf.degree) if hasattr(dxf, 'degree') else 3,
                    'closed': bool(dxf.closed) if hasattr(dxf, 'closed') else False,
                }
            }

        elif etype == 'ELLIPSE':
            return {
                **common,
                'type': 'ELLIPSE',
                'data': {
                    'center': {'x': float(dxf.center.x), 'y': float(dxf.center.y)},
                    'majorAxis': {'x': float(dxf.major_axis.x), 'y': float(dxf.major_axis.y)},
                    'ratio': float(dxf.ratio) if hasattr(dxf, 'ratio') else 1.0,
                    'startParam': float(dxf.start_param) if hasattr(dxf, 'start_param') else 0.0,
                    'endParam': float(dxf.end_param) if hasattr(dxf, 'end_param') else 6.283185,
                }
            }

        elif etype == 'IMAGE':
            return {
                **common,
                'type': 'IMAGE',
                'data': {
                    'position': {'x': float(dxf.insert.x), 'y': float(dxf.insert.y)},
                    'size': {'width': float(dxf.u_pixel.x), 'height': float(dxf.v_pixel.y)},
                    'rotation': float(dxf.rotation) if hasattr(dxf, 'rotation') else 0.0,
                    'imagePath': dxf.path if hasattr(dxf, 'path') else '',
                }
            }

        # 忽略其他类型
        return None

    except Exception as e:
        print(f"Warning: Failed to convert entity {entity.dxftype()}: {e}", file=sys.stderr)
        return None


def calculate_bounds(entity: Dict[str, Any]) -> Dict[str, float]:
    """计算实体包围盒"""
    data = entity.get('data', {})
    etype = entity.get('type', '')

    if etype == 'LINE':
        start = data.get('start', {})
        end = data.get('end', {})
        min_x = min(start.get('x', 0), end.get('x', 0))
        max_x = max(start.get('x', 0), end.get('x', 0))
        min_y = min(start.get('y', 0), end.get('y', 0))
        max_y = max(start.get('y', 0), end.get('y', 0))

    elif etype in ('LWPOLYLINE', 'POLYLINE'):
        vertices = data.get('vertices', [])
        if vertices:
            xs = [v.get('x', 0) for v in vertices]
            ys = [v.get('y', 0) for v in vertices]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
        else:
            min_x = max_x = min_y = max_y = 0

    elif etype in ('ARC', 'CIRCLE'):
        center = data.get('center', {})
        radius = data.get('radius', 0)
        min_x = center.get('x', 0) - radius
        max_x = center.get('x', 0) + radius
        min_y = center.get('y', 0) - radius
        max_y = center.get('y', 0) + radius

    elif etype in ('TEXT', 'MTEXT'):
        pos = data.get('position', {})
        height = data.get('height', 2.5)
        text = data.get('text', '')
        width = len(text) * height * 0.6
        min_x = pos.get('x', 0)
        max_x = pos.get('x', 0) + width
        min_y = pos.get('y', 0) - height
        max_y = pos.get('y', 0)

    elif etype == 'INSERT':
        pos = data.get('position', {})
        # 块引用边界需要递归计算，这里简化
        min_x = max_x = pos.get('x', 0)
        min_y = max_y = pos.get('y', 0)

    elif etype == 'HATCH':
        loops = data.get('loops', [])
        all_points = [p for loop in loops for p in loop]
        if all_points:
            xs = [p.get('x', 0) for p in all_points]
            ys = [p.get('y', 0) for p in all_points]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
        else:
            min_x = max_x = min_y = max_y = 0

    elif etype == 'DIMENSION':
        defpoints = data.get('defPoints', [])
        if defpoints:
            xs = [p.get('x', 0) for p in defpoints]
            ys = [p.get('y', 0) for p in defpoints]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
        else:
            min_x = max_x = min_y = max_y = 0

    elif etype == 'POINT':
        pos = data.get('position', {})
        min_x = max_x = pos.get('x', 0)
        min_y = max_y = pos.get('y', 0)

    elif etype == 'SPLINE':
        ctrl_pts = data.get('controlPoints', [])
        if ctrl_pts:
            xs = [p.get('x', 0) for p in ctrl_pts]
            ys = [p.get('y', 0) for p in ctrl_pts]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
        else:
            min_x = max_x = min_y = max_y = 0

    elif etype == 'ELLIPSE':
        center = data.get('center', {})
        major = data.get('majorAxis', {})
        ratio = data.get('ratio', 1.0)
        rx = (major.get('x', 0)**2 + major.get('y', 0)**2)**0.5
        ry = rx * ratio
        min_x = center.get('x', 0) - rx
        max_x = center.get('x', 0) + rx
        min_y = center.get('y', 0) - ry
        max_y = center.get('y', 0) + ry

    elif etype == 'IMAGE':
        pos = data.get('position', {})
        size = data.get('size', {})
        min_x = pos.get('x', 0)
        max_x = pos.get('x', 0) + size.get('width', 0)
        min_y = pos.get('y', 0)
        max_y = pos.get('y', 0) + size.get('height', 0)

    else:
        min_x = max_x = min_y = max_y = 0

    return {
        'minX': min_x,
        'maxX': max_x,
        'minY': min_y,
        'maxY': max_y,
        'width': max_x - min_x,
        'height': max_y - min_y,
    }


def calculate_overall_bounds(entities: List[Dict[str, Any]]) -> Dict[str, float]:
    """计算所有实体的总体边界"""
    if not entities:
        return {'minX': 0, 'maxX': 1000, 'minY': 0, 'maxY': 1000, 'width': 1000, 'height': 1000}

    min_x = min(e['bounds']['minX'] for e in entities)
    max_x = max(e['bounds']['maxX'] for e in entities)
    min_y = min(e['bounds']['minY'] for e in entities)
    max_y = max(e['bounds']['maxY'] for e in entities)

    return {
        'minX': min_x,
        'maxX': max_x,
        'minY': min_y,
        'maxY': max_y,
        'width': max_x - min_x,
        'height': max_y - min_y,
    }


def parse_dxf(file_path: str) -> Dict[str, Any]:
    """解析 DXF 文件，返回结构化数据"""
    doc = ezdxf.readfile(file_path)
    msp = doc.modelspace()

    entities = []
    entity_count = 0
    layer_info = []

    # 收集图层信息
    for layer in doc.layers:
        layer_info.append({
            'name': layer.dxf.name,
            'color': layer.dxf.color,
            'lineType': layer.dxf.linetype,
            'lineWeight': layer.dxf.lineweight,
            'visible': not layer.is_off(),
            'locked': layer.is_locked(),
        })

    # 收集块定义
    blocks = {}
    for block in doc.blocks:
        if block.name.startswith('*') or not block:  # 跳过匿名块和空块
            continue
        block_entities = []
        for ent in block:
            converted = entity_to_dict(ent)
            if converted:
                block_entities.append(converted)
        if block_entities:
            blocks[block.name] = block_entities

    # 解析模型空间实体
    for entity in msp:
        entity_count += 1
        converted = entity_to_dict(entity)
        if converted:
            # 计算包围盒
            bounds = calculate_bounds(converted)
            converted['bounds'] = bounds
            entities.append(converted)

    # 计算整体边界
    overall_bounds = calculate_overall_bounds(entities)

    return {
        'filePath': file_path,
        'format': 'dxf',
        'version': doc.dxfversion,
        'encoding': doc.encoding,
        'entities': entities,
        'layers': layer_info,
        'blocks': blocks,
        'bounds': overall_bounds,
        'stats': {
            'totalEntities': entity_count,
            'parsedEntities': len(entities),
            'layers': len(layer_info),
            'blocks': len(blocks),
        }
    }


def main():
    parser = argparse.ArgumentParser(description='Parse DXF file to JSON')
    parser.add_argument('file', help='DXF file path')
    parser.add_argument('-o', '--output', help='Output JSON file (default: stdout)')
    parser.add_argument('--pretty', action='store_true', help='Pretty print JSON')
    args = parser.parse_args()

    try:
        result = parse_dxf(args.file)
        output = json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False)

        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(output)
        else:
            print(output)

    except (FileNotFoundError, OSError, ValueError, PermissionError, UnicodeDecodeError) as e:
        print(json.dumps({'error': str(e), 'type': type(e).__name__}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'error': str(e), 'type': type(e).__name__}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()