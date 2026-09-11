#!/usr/bin/env python3
"""
DWG 转 DXF 转换脚本
使用 ODA File Converter CLI 将 DWG 转为 DXF
"""

import sys
import os
import subprocess
import argparse
import tempfile
import shutil
from pathlib import Path


def find_oda_converter() -> Optional[str]:
    """查找 ODA File Converter 可执行文件"""
    # 常见安装路径
    candidates = []

    # Windows
    if sys.platform == 'win32':
        program_files = os.environ.get('ProgramFiles', 'C:\\Program Files')
        program_files_x86 = os.environ.get('ProgramFiles(x86)', 'C:\\Program Files (x86)')
        for pf in [program_files, program_files_x86]:
            candidates.append(Path(pf) / 'ODA' / 'ODAFileConverter' / 'ODAFileConverter.exe')
            candidates.append(Path(pf) / 'ODA' / 'ODAFileConverter_X.X.X' / 'ODAFileConverter.exe')

    # Linux/macOS - 通过 wine 运行 Windows 版本，或使用原生版本
    else:
        # 尝试 wine 运行 Windows 版本
        wine_prefix = os.environ.get('WINEPREFIX', os.path.expanduser('~/.wine'))
        candidates.append(Path(wine_prefix) / 'drive_c' / 'Program Files' / 'ODA' / 'ODAFileConverter' / 'ODAFileConverter.exe')
        candidates.append(Path(wine_prefix) / 'drive_c' / 'Program Files (x86)' / 'ODA' / 'ODAFileConverter' / 'ODAFileConverter.exe')

        # Linux 原生版本（如果有）
        candidates.append(Path('/opt/ODA/ODAFileConverter/ODAFileConverter'))
        candidates.append(Path('/usr/local/bin/ODAFileConverter'))

    for c in candidates:
        if c.exists():
            return str(c)

    return None


def convert_dwg_to_dxf(
    input_file: str,
    output_dir: str,
    version: str = 'ACAD2018',
    format: str = 'DXF',
    recursive: bool = False,
    audit: bool = True
) -> str:
    """
    使用 ODA File Converter 将 DWG 转为 DXF
    返回生成的 DXF 文件路径
    """
    converter = find_oda_converter()
    if not converter:
        raise RuntimeError(
            "ODA File Converter not found. Please install it from https://www.opendesign.com/guestfiles/oda_file_converter\n"
            "On Linux, you may need to run the Windows version via Wine."
        )

    input_path = Path(input_file).resolve()
    output_path = Path(output_dir).resolve()

    # 安全加固：仅接受 .dwg 扩展名（大小写不敏感），避免非预期/路径穿越文件
    if input_path.suffix.lower() != '.dwg':
        raise ValueError(
            f"Invalid input file: {input_file}. Only .dwg files are accepted."
        )

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_file}")

    output_path.mkdir(parents=True, exist_ok=True)

    # ODA File Converter CLI 参数
    # 格式: ODAFileConverter.exe <input_dir> <output_dir> <version> <format> <recursive> <audit> <input_filter>
    cmd = [
        converter,
        str(input_path.parent),
        str(output_path),
        version,
        format,
        '1' if recursive else '0',
        '1' if audit else '0',
        input_path.name,
    ]

    print(f"Running: {' '.join(cmd)}", file=sys.stderr)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5分钟超时
        )

        if result.returncode != 0:
            raise RuntimeError(f"ODA File Converter failed: {result.stderr}")

        # 查找生成的 DXF 文件
        dxf_files = list(output_path.glob(input_path.stem + '*.dxf'))
        if not dxf_files:
            dxf_files = list(output_path.glob('*.dxf'))

        if not dxf_files:
            raise RuntimeError("No DXF file generated")

        # 返回最新的 DXF 文件
        dxf_file = max(dxf_files, key=lambda f: f.stat().st_mtime)
        return str(dxf_file)

    except subprocess.TimeoutExpired:
        raise RuntimeError("ODA File Converter timed out (5 min)")
    except Exception as e:
        print(f"Conversion failed: {e}", file=sys.stderr)
        raise RuntimeError(f"Conversion failed: {e}")


def convert_and_parse(
    dwg_file: str,
    output_dir: str,
    parse_script: str,
    keep_dxf: bool = False
) -> dict:
    """
    完整流程：DWG -> DXF -> JSON
    """
    import json

    # Step 1: DWG -> DXF
    print(f"Converting {dwg_file} to DXF...", file=sys.stderr)
    dxf_file = convert_dwg_to_dxf(dwg_file, output_dir)

    try:
        # Step 2: DXF -> JSON
        print(f"Parsing DXF: {dxf_file}...", file=sys.stderr)
        result = subprocess.run(
            [sys.executable, parse_script, dxf_file],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            raise RuntimeError(f"DXF parsing failed: {result.stderr}")

        parsed = json.loads(result.stdout)

        # 添加源文件信息
        parsed['sourceFile'] = dwg_file
        parsed['format'] = 'dwg'

        return parsed

    finally:
        if not keep_dxf:
            try:
                os.remove(dxf_file)
            except OSError:
                pass


def main():
    parser = argparse.ArgumentParser(description='Convert DWG to DXF using ODA File Converter')
    parser.add_argument('input', help='Input DWG file path')
    parser.add_argument('-o', '--output-dir', default='.', help='Output directory for DXF')
    parser.add_argument('--version', default='ACAD2018', help='Output DXF version (ACAD2000-ACAD2018)')
    parser.add_argument('--format', default='DXF', choices=['DXF', 'DXB'], help='Output format')
    parser.add_argument('--recursive', action='store_true', help='Process subdirectories')
    parser.add_argument('--no-audit', action='store_true', help='Skip audit/repair')
    parser.add_argument('--parse', action='store_true', help='Also parse DXF to JSON (requires parse_dxf.py)')
    parser.add_argument('--parse-script', help='Path to parse_dxf.py')
    parser.add_argument('--keep-dxf', action='store_true', help='Keep intermediate DXF file')
    parser.add_argument('--find-oda', action='store_true', help='Just print ODA converter path and exit')

    args = parser.parse_args()

    if args.find_oda:
        converter = find_oda_converter()
        if converter:
            print(converter)
        else:
            print("NOT_FOUND", file=sys.stderr)
            sys.exit(1)
        return

    try:
        if args.parse:
            if not args.parse_script:
                # 尝试同目录下的 parse_dxf.py
                script_dir = Path(__file__).parent
                args.parse_script = str(script_dir / 'parse_dxf.py')

            if not Path(args.parse_script).exists():
                raise FileNotFoundError(f"Parse script not found: {args.parse_script}")

            result = convert_and_parse(
                args.input,
                args.output_dir,
                args.parse_script,
                args.keep_dxf
            )
            print(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
        else:
            dxf_file = convert_dwg_to_dxf(
                args.input,
                args.output_dir,
                args.version,
                args.format,
                args.recursive,
                not args.no_audit
            )
            print(dxf_file)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()