# Renders src/assets/icon.svg to every PNG icon size the site uses (headless Chrome via Playwright).
# Usage, from the repo root: python3 tools/render_icons.py
from playwright.sync_api import sync_playwright
svg = open('src/assets/icon.svg').read()
OUT = {'bt-icon-1024.png': 1024, 'bt-icon-512.png': 512, 'bt-icon-192.png': 192, 'bt-touch-180.png': 180,
       'bt-touch-167.png': 167, 'bt-touch-152.png': 152, 'bt-favicon-32.png': 32}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for name, size in OUT.items():
        pg = b.new_page(viewport={'width': size, 'height': size})
        pg.set_content('<html><body style="margin:0;background:#020308">' + svg.replace('width="512" height="512"', f'width="{size}" height="{size}"', 1) + '</body></html>')
        pg.wait_for_timeout(300); pg.screenshot(path='public/' + name, clip={'x': 0, 'y': 0, 'width': size, 'height': size}); pg.close()
    b.close()
