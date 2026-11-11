# Menu screens + planet close-ups. Usage: python3 tests/screens.py [url]
import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1440,'height':900})
    logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    pg.goto(URL); pg.wait_for_selector('.menu', timeout=120000)
    shot = lambda n: pg.screenshot(path=f'shots/{n}.png')
    time.sleep(2); shot('s_menu')
    pg.get_by_role('button', name='Planetary Database').click(); time.sleep(1)
    for n in ['Brannoch','Thalen','Cindra','Ysolde']:
        pg.locator('.item.click', has_text=n).first.click(); time.sleep(7); shot('s_db_'+n.lower())
    pg.get_by_role('button', name='Back to main menu').click(); time.sleep(0.5)
    pg.get_by_role('button', name='Settings').click(); time.sleep(1); shot('s_settings')
    print('\n'.join(logs[:40]))
    b.close()
