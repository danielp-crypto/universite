#!/usr/bin/env python3
"""
Comprehensive Asset Minifier for PHP Files
This script extracts and minifies all inline CSS and JavaScript from PHP files.
"""

import re
import os
import glob
from pathlib import Path

def minify_css(css_content):
    """Minify CSS by removing comments, whitespace, and unnecessary characters."""
    # Remove comments
    css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
    # Remove unnecessary whitespace
    css_content = re.sub(r'\s+', ' ', css_content)
    css_content = re.sub(r';\s*', ';', css_content)
    css_content = re.sub(r':\s*', ':', css_content)
    css_content = re.sub(r'{\s*', '{', css_content)
    css_content = re.sub(r'}\s*', '}', css_content)
    css_content = re.sub(r',\s*', ',', css_content)
    # Remove leading/trailing whitespace
    css_content = css_content.strip()
    return css_content

def minify_js(js_content):
    """Minify JavaScript by removing comments, whitespace, and unnecessary characters."""
    # Remove single-line comments
    js_content = re.sub(r'//.*$', '', js_content, flags=re.MULTILINE)
    # Remove multi-line comments
    js_content = re.sub(r'/\*.*?\*/', '', js_content, flags=re.DOTALL)
    # Remove unnecessary whitespace
    js_content = re.sub(r'\s+', ' ', js_content)
    # Remove whitespace around operators
    js_content = re.sub(r'\s*([{}();,=+\-*/<>!&|])\s*', r'\1', js_content)
    # Remove leading/trailing whitespace
    js_content = js_content.strip()
    return js_content

def process_php_file(php_file, css_dir, js_dir):
    """Process a single PHP file to extract and minify CSS/JS."""
    print(f"Processing {php_file}...")
    
    try:
        with open(php_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        changes_made = False
        
        # Extract and replace CSS
        css_matches = re.findall(r'<style[^>]*>(.*?)</style>', content, re.DOTALL)
        if css_matches:
            css_content = '\n'.join(css_matches)
            minified_css = minify_css(css_content)
            
            # Create minified CSS file
            css_filename = f"{Path(php_file).stem}.min.css"
            css_filepath = css_dir / css_filename
            
            with open(css_filepath, 'w', encoding='utf-8') as f:
                f.write(minified_css)
            
            print(f"  Created {css_filepath}")
            
            # Replace inline CSS with link tag
            content = re.sub(
                r'<style[^>]*>.*?</style>',
                f'<link rel="stylesheet" href="assets/css/{css_filename}">',
                content,
                flags=re.DOTALL
            )
            changes_made = True
        
        # Extract and replace JavaScript (excluding external script tags)
        js_matches = re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
        if js_matches:
            # Filter out empty or external script content
            valid_js = [js for js in js_matches if js.strip() and not js.strip().startswith('http')]
            
            if valid_js:
                js_content = '\n'.join(valid_js)
                minified_js = minify_js(js_content)
                
                # Create minified JS file
                js_filename = f"{Path(php_file).stem}.min.js"
                js_filepath = js_dir / js_filename
                
                with open(js_filepath, 'w', encoding='utf-8') as f:
                    f.write(minified_js)
                
                print(f"  Created {js_filepath}")
                
                # Replace inline JavaScript with script tag
                content = re.sub(
                    r'<script[^>]*>.*?</script>',
                    f'<script src="assets/js/{js_filename}"></script>',
                    content,
                    flags=re.DOTALL
                )
                changes_made = True
        
        # Update the PHP file if changes were made
        if changes_made:
            with open(php_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  Updated {php_file} to use external assets")
        
        return changes_made
        
    except Exception as e:
        print(f"  Error processing {php_file}: {e}")
        return False

def create_common_assets(css_dir, js_dir):
    """Create common minified assets for shared styles and functions."""
    
    # Common CSS for navigation and layout
    common_css = """
    /* Common styles for all pages */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; min-height: 100vh; }
    .container { display: flex; }
    nav { background-color: #1f2937; color: white; padding: 1rem; }
    .nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; }
    .main { margin-left: 250px; padding: 2rem; flex: 1; }
    @media (max-width: 768px) { .container { flex-direction: column; } .main { margin-left: 0; } }
    """
    
    # Common JavaScript functions
    common_js = """
    // Common JavaScript functions
    function showNotification(message) { console.log(message); }
    function validateForm(form) { return form.checkValidity(); }
    function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }
    """
    
    # Create common minified files
    common_css_min = minify_css(common_css)
    common_js_min = minify_js(common_js)
    
    with open(css_dir / "common.min.css", 'w', encoding='utf-8') as f:
        f.write(common_css_min)
    
    with open(js_dir / "common.min.js", 'w', encoding='utf-8') as f:
        f.write(common_js_min)
    
    print("Created common.min.css and common.min.js")

def main():
    """Main function to process all PHP files."""
    print("Starting comprehensive asset minification...")
    
    # Create assets directories
    css_dir = Path("assets/css")
    js_dir = Path("assets/js")
    css_dir.mkdir(parents=True, exist_ok=True)
    js_dir.mkdir(parents=True, exist_ok=True)
    
    # Find all PHP files
    php_files = glob.glob("*.php")
    
    if not php_files:
        print("No PHP files found in current directory.")
        return
    
    print(f"Found {len(php_files)} PHP files to process.")
    
    # Process each PHP file
    processed_count = 0
    for php_file in php_files:
        if process_php_file(php_file, css_dir, js_dir):
            processed_count += 1
    
    # Create common assets
    create_common_assets(css_dir, js_dir)
    
    print(f"\nMinification complete! Processed {processed_count} files.")
    print(f"CSS files created in: {css_dir}")
    print(f"JavaScript files created in: {js_dir}")

if __name__ == "__main__":
    main()
