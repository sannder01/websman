"""Verify the assignment HTML/CSS freeze against the published baseline."""
from pathlib import Path
import re
import json
import hashlib
from html.parser import HTMLParser


class PageScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        assert not any(name.lower().startswith('on') for name, _ in attrs), 'Inline event attribute'
        if tag == 'script':
            assert dict(attrs).get('src'), 'Inline JavaScript must be moved to a separate file'
            self.sources.append(dict(attrs).get('src', ''))

root = Path(__file__).resolve().parents[1]
baseline = json.loads((root / 'tests/site_baseline.json').read_text(encoding='utf-8'))
checked = 0
jquery_script = (
    b'<script src="https://code.jquery.com/jquery-3.7.1.min.js" '
    b'integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" '
    b'crossorigin="anonymous" defer></script>\n'
)
for name, expected in baseline.items():
    current = (root / name).read_bytes().replace(b'\r\n', b'\n')
    if name.endswith('.html'):
        page = PageScripts()
        page.feed(current.decode('utf-8'))
        assert not any('old-js-version.js' in src for src in page.sources), f'Legacy code linked: {name}'
        if 'js/main.js' in page.sources:
            assert current.count(jquery_script) == 1, f'Expected pinned jQuery CDN once: {name}'
            assert current.index(jquery_script) < current.index(b'<script src="js/main.js"'), f'jQuery load order: {name}'
            current = current.replace(jquery_script, b'', 1)
        if name in ('demofinal/all-locations.html', 'demofinal/computers.html', 'demofinal/cart.html'):
            external_redirect = b'<script src="js/redirect.js" defer></script>'
            target = b'booking.html?mode=packages#packages' if name.endswith('/cart.html') else b'rooms.html'
            assert current.count(external_redirect) == 1, f'Expected external redirect once: {name}'
            current = current.replace(external_redirect, b"<script>location.replace('" + target + b"');</script>", 1)
    if name == 'demofinal/rooms.html':
        comparison_script = b'<script src="js/rooms-comparison.js" defer></script>\n'
        assert current.count(comparison_script) == 1, 'Expected exactly one rooms comparison script'
        current = current.replace(comparison_script, b'', 1)
    assert hashlib.sha256(current).hexdigest() == expected, f'Freeze violated: {name}'
    checked += 1

for path in (root / 'demofinal/js').glob('*.js'):
    code = path.read_text(encoding='utf-8-sig')
    assert "'use strict'" in code, path
    assert not re.search(r'\b(?:var|eval)\b|document\.write|\.innerHTML|\.style\b', code), path
    assert not re.search(r'(?<![=!])==(?!=)|(?<!!)\!=(?!=)', code), path
assert (root / 'demofinal/js/old-js-version.js').is_file(), 'Missing plain-JavaScript comparison file'
print(f'PASS: {checked} frozen HTML/CSS files (only approved comparison/CDN/redirect script references); load order, no inline JavaScript/handlers, unlinked legacy version and JavaScript policy checks.')
