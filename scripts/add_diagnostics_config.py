#!/usr/bin/env python3
"""Extract DiagnosticType enum from enums.ts and create a dictionary."""

import re, json, pyperclip
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

def main(script_dir: Path):
    """Main function."""
    # Get the path to enums.ts
    enums_file = script_dir.parent / 'src' / 'models' / 'DiagnosticType.ts'
    
    if not enums_file.exists():
        raise FileNotFoundError(f"enums.ts not found at {enums_file}")
    
    # Extract the enum
    diagnostics = extract_diagnostic_type_enum(str(enums_file))
    
    # Print as dictionary
    print("DiagnosticType Dictionary:")
    print(json.dumps(diagnostics, indent=2))
    
    return diagnostics

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    diagnostics = main(script_dir)

    # format for markdown table of diagnostics
    # format for markdown table of diagnostics
    txt = "| ID | Description |\n|---|---|\n"
    for key, value in diagnostics.items():
        txt += f"| `{key}` | {value} |\n"
    print(txt)
    pyperclip.copy(txt)