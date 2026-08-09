#!/usr/bin/env python3
"""Extract DiagnosticType enum from enums.ts and create a dictionary."""

import re, json
from pathlib import Path

def extract_diagnostic_type_enum(file_path: str) -> dict:
    """
    Extract DiagnosticType enum from TypeScript file and return as dictionary.
    
    Args:
        file_path: Path to the enums.ts file
        
    Returns:
        Dictionary with diagnostic type names as keys and descriptions as values
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the DiagnosticType enum block
    enum_pattern = r'export enum DiagnosticType\s*\{(.*?)\n\}'
    enum_match = re.search(enum_pattern, content, re.DOTALL)
    
    if not enum_match:
        raise ValueError("Could not find DiagnosticType enum in file")
    
    enum_content = enum_match.group(1)
    
    # Extract key-value pairs (ignoring comments and empty lines)
    diagnostic_dict = {}
    
    # Pattern to match: KEY = "value" or KEY = `value` or KEY = 'value'
    # Uses backreference to match the same quote character at start and end
    entry_pattern = r'([A-Z_]+)\s*=\s*(["`\'])(.*?)\2'
    
    matches = re.findall(entry_pattern, enum_content, re.DOTALL)
    for key, quote_char, value in matches:
        # Clean up whitespace in multi-line values
        cleaned_value = value.strip()
        diagnostic_dict[key] = cleaned_value
    
    return diagnostic_dict

def main():
    """Main function."""
    # Get the path to enums.ts
    PROJECT_DIR = Path(__file__).parent.parent
    enums_file = PROJECT_DIR / 'src' / 'models' / 'DiagnosticType.ts'
    
    if not enums_file.exists():
        raise FileNotFoundError(f"enums.ts not found at {enums_file}")
    
    # Extract the enum
    diagnostics = extract_diagnostic_type_enum(str(enums_file))

    max_key_length = max(len(f"`{key}`") for key in diagnostics.keys())
    max_value_length = max(len(value) for value in diagnostics.values())

    # format for markdown table of diagnostics
    txt = f"| {f"`ID`".ljust(max_key_length)} | {f"`Description`".ljust(max_value_length)} |\n| {'-' * max_key_length} | {'-' * max_value_length} |\n"
    # diagnostics = dict(sorted(diagnostics.items(), key=lambda item: item[0]))  # Sort by key
    for key, value in diagnostics.items():
        txt += f"| {f"`{key}`".ljust(max_key_length)} | {value.ljust(max_value_length)} |\n"

    OUTPUT_FILE = PROJECT_DIR / 'DiagnosticTypesList.md'
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("""
# Diagnostic Types List
This file is auto-generated from the `DiagnosticType` enum in [DiagnosticType.ts](src/models/DiagnosticType.ts). It provides a list of all diagnostic types and their descriptions for reference, ordered by type of diagnostics.
""".strip())
        f.write("\n\n")
        f.write(txt)

if __name__ == "__main__":
    main()