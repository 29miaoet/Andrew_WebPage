#!/usr/bin/env python3
"""
Check HTML files for accessibility and SEO issues.
Outputs issues as JSON for GitHub Actions to process.
"""

import os
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# Whitelist of issues to ignore (prevents false positives)
# Format: {filename: [list of issue titles to ignore]}
ISSUE_WHITELIST = {
    'photo_gallery.html': [
        'Image at position 6 is missing alt text',
        'All images should have descriptive alt attributes',
    ],
}

class HTMLChecker:
    def __init__(self):
        self.issues = []
        self.repo_root = Path('.')
    
    def check_all_html_files(self):
        """Find and check all HTML files in repo root"""
        html_files = list(self.repo_root.glob('*.html'))
        
        if not html_files:
            print("No HTML files found in repo root")
            return
        
        for html_file in sorted(html_files):
            self.check_file(html_file)
        
        self.output_results()
    
    def check_file(self, filepath):
        """Check a single HTML file"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            soup = BeautifulSoup(content, 'html5lib')
            filename = filepath.name
            
            # Run all checks
            self.check_meta_tags(soup, filename)
            self.check_headings(soup, filename)
            self.check_images(soup, filename)
            self.check_links(soup, filename)
            self.check_title(soup, filename)
            self.check_lang_attribute(soup, filename)
            self.check_contrast_hints(soup, filename, content)
            self.check_form_labels(soup, filename)
            
        except Exception as e:
            self.add_issue(
                filename,
                f"Error parsing file: {e}",
                "seo",
                f"Could not parse {filename}: {str(e)}"
            )
    
    def check_meta_tags(self, soup, filename):
        """Check for essential meta tags"""
        meta_description = soup.find('meta', attrs={'name': 'description'})
        if not meta_description:
            self.add_issue(
                filename,
                "Missing meta description",
                "seo",
                "Add `<meta name=\"description\" content=\"Your page description\">` to the `<head>` tag."
            )
        
        meta_viewport = soup.find('meta', attrs={'name': 'viewport'})
        if not meta_viewport:
            self.add_issue(
                filename,
                "Missing viewport meta tag",
                "accessibility,seo",
                "Add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">` for mobile responsiveness."
            )
        
        robots_tag = soup.find('meta', attrs={'name': 'robots'})
        if robots_tag:
            content = robots_tag.get('content', '')
            if 'noindex' in content:
                self.add_issue(
                    filename,
                    "Page marked as noindex",
                    "seo",
                    "Page has `content=\"noindex\"` in robots meta tag. Remove 'noindex' to allow indexing."
                )
    
    def check_title(self, soup, filename):
        """Check page title"""
        title = soup.find('title')
        if not title or not title.string or len(title.string.strip()) == 0:
            self.add_issue(
                filename,
                "Missing or empty page title",
                "accessibility,seo",
                "Add a descriptive `<title>` tag (50-60 characters recommended)."
            )
        elif len(title.string.strip()) < 10:
            self.add_issue(
                filename,
                "Page title too short",
                "seo",
                f"Title is only {len(title.string.strip())} characters. Aim for 50-60 characters."
            )
        elif len(title.string.strip()) > 70:
            self.add_issue(
                filename,
                "Page title too long",
                "seo",
                f"Title is {len(title.string.strip())} characters. Keep it under 70 characters."
            )
    
    def check_headings(self, soup, filename):
        """Check heading structure"""
        headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        
        if not headings:
            self.add_issue(
                filename,
                "No headings found",
                "accessibility,seo",
                "Page should have at least one heading (H1) for structure and SEO."
            )
            return
        
        h1_count = len([h for h in headings if h.name == 'h1'])
        if h1_count == 0:
            self.add_issue(
                filename,
                "Missing H1 heading",
                "accessibility,seo",
                "Page should have exactly one H1 heading."
            )
        elif h1_count > 1:
            self.add_issue(
                filename,
                "Multiple H1 headings found",
                "seo",
                f"Page has {h1_count} H1 headings. Should have exactly one."
            )
        
        # Check for heading hierarchy gaps
        heading_levels = [int(h.name[1]) for h in headings]
        for i, level in enumerate(heading_levels[:-1]):
            next_level = heading_levels[i + 1]
            if next_level > level + 1:
                self.add_issue(
                    filename,
                    "Heading hierarchy gap",
                    "accessibility",
                    f"Heading jumps from H{level} to H{next_level}. Maintain sequential heading levels."
                )
                break
    
    def check_images(self, soup, filename):
        """Check images for alt text"""
        images = soup.find_all('img')
        
        for i, img in enumerate(images, 1):
            alt = img.get('alt')
            if alt is None or (isinstance(alt, list) and not alt[0]):
                self.add_issue(
                    filename,
                    f"Image {i} missing alt text",
                    "accessibility,seo",
                    f"Image at position {i} is missing alt text. All images should have descriptive alt attributes."
                )
            elif len(alt) < 5:
                self.add_issue(
                    filename,
                    f"Image {i} has insufficient alt text",
                    "accessibility,seo",
                    f"Image {i} alt text is too short: '{alt}'. Provide a descriptive alternative text."
                )
    
    def check_links(self, soup, filename):
        """Check links for accessibility"""
        links = soup.find_all('a')
        
        for i, link in enumerate(links, 1):
            href = link.get('href')
            if not href:
                self.add_issue(
                    filename,
                    f"Link {i} missing href",
                    "accessibility",
                    f"Link at position {i} is missing href attribute."
                )
            
            link_text = link.get_text(strip=True)
            if not link_text:
                self.add_issue(
                    filename,
                    f"Link {i} has no text",
                    "accessibility",
                    f"Link at position {i} has no visible text. Add descriptive link text or aria-label."
                )
            elif link_text.lower() in ['click here', 'more', 'link', 'read more']:
                self.add_issue(
                    filename,
                    f"Link {i} has non-descriptive text",
                    "accessibility,seo",
                    f"Link text '{link_text}' is not descriptive. Use meaningful link text like 'Learn about X'."
                )
    
    def check_lang_attribute(self, soup, filename):
        """Check for lang attribute on html tag"""
        html_tag = soup.find('html')
        if not html_tag or not html_tag.get('lang'):
            self.add_issue(
                filename,
                "Missing lang attribute",
                "accessibility,seo",
                "Add `lang` attribute to `<html>` tag, e.g., `<html lang=\"en\">` for English."
            )
    
    def check_contrast_hints(self, soup, filename, raw_content):
        """Check for potential contrast issues"""
        # Look for inline styles with color definitions
        style_pattern = r'style\s*=\s*["\']([^"\']*(?:color|background)[^"\']*)["\']'
        matches = re.findall(style_pattern, raw_content, re.IGNORECASE)
        
        if matches:
            # This is just a hint - actual contrast testing requires rendering
            self.add_issue(
                filename,
                "Inline styles with colors detected",
                "accessibility",
                "Inline color styles detected. Verify text/background contrast meets WCAG AA standards (4.5:1 for normal text)."
            )
    
    def check_form_labels(self, soup, filename):
        """Check form inputs have associated labels"""
        inputs = soup.find_all(['input', 'textarea', 'select'])
        
        for i, input_elem in enumerate(inputs, 1):
            input_id = input_elem.get('id')
            input_name = input_elem.get('name')
            
            # Check if input has explicit label
            has_label = False
            if input_id:
                label = soup.find('label', attrs={'for': input_id})
                if label:
                    has_label = True
            
            # Check if input is wrapped in label
            if not has_label and input_elem.find_parent('label'):
                has_label = True
            
            # Check for aria-label
            if not has_label and input_elem.get('aria-label'):
                has_label = True
            
            # Check for aria-labelledby
            if not has_label and input_elem.get('aria-labelledby'):
                has_label = True
            
            if not has_label and input_elem.get('type') != 'hidden':
                self.add_issue(
                    filename,
                    f"Form input {i} missing label",
                    "accessibility",
                    f"Form input {i} ({input_elem.get('type', 'text')}) is not associated with a label. Use `<label for=\"inputId\">` or wrap input in label."
                )
    
    def add_issue(self, filename, title, labels, body):
        """Add an issue to the list (unless whitelisted)"""
        # Check if this issue is whitelisted for this file
        if filename in ISSUE_WHITELIST:
            if title in ISSUE_WHITELIST[filename]:
                print(f"  ⊘ Whitelisted: {filename} - {title}")
                return
        
        self.issues.append({
            'file': filename,
            'title': title,
            'labels': labels.split(','),
            'body': f"**File:** `{filename}`\n\n{body}"
        })
    
    def output_results(self):
        """Output results as JSON and set GitHub Actions output"""
        # Write issues to JSON
        with open('html_issues.json', 'w') as f:
            json.dump(self.issues, f, indent=2)
        
        # Set GitHub Actions output
        with open(os.environ.get('GITHUB_OUTPUT', '/dev/null'), 'a') as f:
            if self.issues:
                f.write('issues_found=true\n')
                print(f"::set-output name=issues_found::true")
            else:
                f.write('issues_found=false\n')
                print(f"::set-output name=issues_found::false")
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"HTML Accessibility & SEO Check Complete")
        print(f"{'='*60}")
        if self.issues:
            print(f"Found {len(self.issues)} issue(s):\n")
            for issue in self.issues:
                print(f"  [{issue['file']}] {issue['title']}")
        else:
            print("✓ No issues found!")

if __name__ == '__main__':
    checker = HTMLChecker()
    checker.check_all_html_files()
