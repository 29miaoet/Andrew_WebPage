#!/usr/bin/env python3
import os
import sys
import json
import subprocess
import argparse
from pathlib import Path
from typing import List, Dict, Tuple

class FileValidator:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.supported_extensions = {
            '.html': self.validate_html,
            '.css': self.validate_css,
            '.js': self.validate_js,
            '.json': self.validate_json,
            '.xml': self.validate_xml,
            '.md': self.validate_markdown,
            '.ps1': self.validate_powershell,
            '.py': self.validate_python,
        }
    
    def validate_file(self, filepath: str) -> bool:
        if not os.path.exists(filepath):
            self.errors.append(f"File not found: {filepath}")
            return False
        
        _, ext = os.path.splitext(filepath)
        ext = ext.lower()
        
        if ext not in self.supported_extensions:
            self.warnings.append(f"Skipping unsupported file type: {filepath}")
            return True
        
        validator = self.supported_extensions[ext]
        return validator(filepath)
    
    def validate_html(self, filepath: str) -> bool:
        try:
            result = subprocess.run(
                ['npx', 'html-validate', filepath],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode != 0:
                self.errors.append(f"{filepath}: {result.stdout}")
                return False
            return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return self._validate_html_basic(filepath)
    
    def _validate_html_basic(self, filepath: str) -> bool:
        try:
            from html.parser import HTMLParser
            
            class HTMLValidator(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.errors = []
            
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            validator = HTMLValidator()
            try:
                validator.feed(content)
                return True
            except Exception as e:
                self.errors.append(f"{filepath}: Invalid HTML - {str(e)}")
                return False
        except Exception as e:
            self.errors.append(f"{filepath}: Error validating HTML - {str(e)}")
            return False
    
    def validate_css(self, filepath: str) -> bool:
        try:
            result = subprocess.run(
                ['npx', 'stylelint', filepath],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode != 0:
                self.errors.append(f"{filepath}: {result.stdout}")
                return False
            return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return self._validate_css_basic(filepath)
    
    def _validate_css_basic(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            opening = content.count('{')
            closing = content.count('}')
            
            if opening != closing:
                self.errors.append(
                    f"{filepath}: Mismatched braces - {opening} opening, {closing} closing"
                )
                return False
            
            opening_parens = content.count('(')
            closing_parens = content.count(')')
            
            if opening_parens != closing_parens:
                self.errors.append(
                    f"{filepath}: Mismatched parentheses - {opening_parens} opening, {closing_parens} closing"
                )
                return False
            
            return True
        except Exception as e:
            self.errors.append(f"{filepath}: Error validating CSS - {str(e)}")
            return False
    
    def validate_js(self, filepath: str) -> bool:
        try:
            result = subprocess.run(
                ['npx', 'eslint', filepath],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode != 0:
                self.errors.append(f"{filepath}: {result.stdout}")
                return False
            return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return self._validate_js_basic(filepath)
    
    def _validate_js_basic(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if content.count('{') != content.count('}'):
                self.errors.append(f"{filepath}: Mismatched braces")
                return False
            
            if content.count('[') != content.count(']'):
                self.errors.append(f"{filepath}: Mismatched brackets")
                return False
            
            if content.count('(') != content.count(')'):
                self.errors.append(f"{filepath}: Mismatched parentheses")
                return False
            
            return True
        except Exception as e:
            self.errors.append(f"{filepath}: Error validating JS - {str(e)}")
            return False
    
    def validate_json(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                json.load(f)
            return True
        except json.JSONDecodeError as e:
            self.errors.append(f"{filepath}: Invalid JSON - {str(e)}")
            return False
        except Exception as e:
            self.errors.append(f"{filepath}: Error validating JSON - {str(e)}")
            return False
    
    def validate_xml(self, filepath: str) -> bool:
        try:
            import xml.etree.ElementTree as ET
            ET.parse(filepath)
            return True
        except Exception as e:
            self.errors.append(f"{filepath}: Invalid XML - {str(e)}")
            return False
    
    def validate_markdown(self, filepath: str) -> bool:
        try:
            result = subprocess.run(
                ['npx', 'markdownlint', filepath],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode != 0:
                self.warnings.append(f"{filepath}: {result.stdout}")
            return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return self._validate_markdown_basic(filepath)
    
    def _validate_markdown_basic(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if content.count('[') != content.count(']'):
                self.warnings.append(f"{filepath}: Possible unmatched brackets")
            
            return True
        except Exception as e:
            self.errors.append(f"{filepath}: Error validating Markdown - {str(e)}")
            return False
    
    def validate_powershell(self, filepath: str) -> bool:
        try:
            ps_command = f"Invoke-ScriptAnalyzer -Path '{filepath}' -ReportSummary"
            result = subprocess.run(
                ['pwsh', '-Command', ps_command],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode != 0:
                self.warnings.append(f"{filepath}: {result.stdout}")
            return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return self._validate_powershell_basic(filepath)
    
    def _validate_powershell_basic(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if content.count('{') != content.count('}'):
                self.errors.append(f"{filepath}: Mismatched braces")
                return False
            
            if content.count('(') != content.count(')'):
                self.errors.append(f"{filepath}: Mismatched parentheses")
                return False
            
            return True
        except Exception as e:
            self.errors.append(f"{filepath}: Error validating PowerShell - {str(e)}")
            return False
    
    def validate_python(self, filepath: str) -> bool:
        try:
            result = subprocess.run(
                ['pylint', filepath, '--disable=all', '--enable=E,F'],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode != 0:
                self.errors.append(f"{filepath}: {result.stdout}")
                return False
            return True
        except FileNotFoundError:
            try:
                result = subprocess.run(
                    ['flake8', filepath, '--select=E,F'],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                if result.returncode != 0:
                    self.errors.append(f"{filepath}: {result.stdout}")
                    return False
                return True
            except FileNotFoundError:
                return self._validate_python_basic(filepath)
    
    def _validate_python_basic(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            compile(content, filepath, 'exec')
            return True
        except SyntaxError as e:
            self.errors.append(f"{filepath}: Syntax error - {str(e)}")
            return False
        except Exception as e:
            self.errors.append(f"{filepath}: Error validating Python - {str(e)}")
            return False
    
    def validate_files(self, files: List[str]) -> Tuple[bool, List[str], List[str]]:
        if not files:
            return True, [], []
        
        all_valid = True
        for filepath in files:
            if filepath.strip() and not self.validate_file(filepath):
                all_valid = False
        
        return all_valid, self.errors, self.warnings
    
    def print_results(self):
        if self.errors:
            print("\n❌ VALIDATION ERRORS:\n")
            for error in self.errors:
                print(f"  - {error}")
        
        if self.warnings:
            print("\n⚠️  WARNINGS:\n")
            for warning in self.warnings:
                print(f"  - {warning}")
        
        if not self.errors and not self.warnings:
            print("\n✅ All files validated successfully!")


def get_modified_files() -> List[str]:
    try:
        # Get modified files from git
        result = subprocess.run(
            ['git', 'diff', '--name-only', 'HEAD~1', 'HEAD'],
            capture_output=True,
            text=True
        )
        files = [f for f in result.stdout.strip().split('\n') if f.strip()]
        return files
    except Exception as e:
        print(f"Warning: Could not get modified files from git: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(
        description='Validate code files using professional linters'
    )
    parser.add_argument(
        'files',
        nargs='*',
        help='Files to validate (if not provided, validates modified files)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Validate all files in repository'
    )
    
    args = parser.parse_args()
    
    if args.all:
        supported_exts = tuple(['.html', '.css', '.js', '.json', '.xml', '.md', '.ps1', '.py'])
        files = [str(p) for p in Path('.').rglob('*') if p.suffix.lower() in supported_exts]
    elif args.files:
        files = args.files
    else:
        files = get_modified_files()
    
    if not files:
        print("No files to validate")
        return 0
    
    validator = FileValidator()
    all_valid, errors, warnings = validator.validate_files(files)
    
    validator.print_results()
    
    if errors:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
