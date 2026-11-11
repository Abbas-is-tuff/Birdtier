# Play-through of the "fun" features: Quick Start, radio chatter, fast travel to Miro, assisted landing
# at the stranded bird, EVA rescue, seed caches near the pad, upgrade shop, locked crew. Usage: python3 tests/fun.py [url]
import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/app.html'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1440,'height':900})
    logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    ev = lambda js: pg.evaluate(js)
    pg.goto(URL); pg.wait_for_selector('.menu', timeout=200000); time.sleep(1)
    pg.locator('.crewbtn', has_text='Salman').click(); time.sleep(0.4)
    print('locked info:', pg.inner_text('.crewinfo').replace('\n',' | ')[:160])
    pg.screenshot(path='shots/f_menu.png')
    pg.get_by_role('button', name='Quick Start').click(); time.sleep(4)
    print('quick start radio:', ev("JSON.stringify(window.__ui_radio||null)"), pg.inner_text('.radio') if pg.query_selector('.radio') else 'no bubble')
    pg.screenshot(path='shots/f_orbit.png')
    plan = ev("(()=>{const p=frontier.travelPlan('miro');return [Math.round(p.dv),Math.round(p.have)]})()"); print('plan miro dv/have:', plan)
    # map panel for Miro
    ev("frontier.toggleMap()"); time.sleep(2); ev("frontier.ui=1"); 
    ev("window.__setUI && 0")
    pg.evaluate("import('/src/ui/store.js').then(m=>m.setUI({selected:'miro'}))"); time.sleep(1.5)
    pg.screenshot(path='shots/f_map.png')
    pg.get_by_role('button', name='Travel to Miro').click(); time.sleep(3)
    print('after travel:', ev("JSON.stringify({body:frontier.craft.env.body.id, alt:Math.round(frontier.craft.env.alt), dvLeft:Math.round(frontier.hudDv||0)})"))
    pg.screenshot(path='shots/f_miro.png')
    site = ev("frontier.sites.find(s=>s.body.id==='miro'&&s.type==='bird').id")
    ev(f"frontier.landAtSite('{site}')")
    t0=time.time()
    while time.time()-t0 < 300 and ev("!frontier.craft.landed && !frontier.craft.destroyed"): time.sleep(2)
    print('assisted landing:', ev("JSON.stringify({landed:!!frontier.craft.landed, destroyed:frontier.craft.destroyed&&frontier.craft.destroyReason})"), round(time.time()-t0),'s')
    pg.screenshot(path='shots/f_landed.png')
    print('site pointer:', pg.inner_text('.sitepointer').replace('\n',' ') if pg.query_selector('.sitepointer') else None)
    # EVA and walk to the bird (teleport the last few metres to keep the test short)
    ev("frontier.interact()"); time.sleep(1)
    ev(f"(()=>{{const g=frontier,s=g.sites.find(x=>x.id==='{site}'),e=g.entity;e.dir.copy(s.dir).addScaledVector(new e.dir.constructor(0,1,0).cross(s.dir).normalize(),12/s.body.radius).normalize();g.rig.dist.surface=9}})()")
    time.sleep(2); pg.screenshot(path='shots/f_bird.png')
    pg.keyboard.down('KeyW'); 
    for i in range(20):
        time.sleep(0.5)
        if ev("frontier.progress.crew.includes('salman')"): break
        ev(f"(()=>{{const g=frontier,s=g.sites.find(x=>x.id==='{site}'),e=g.entity;const sp=s.dir.clone().applyQuaternion(s.body.quat),ep=e.dir.clone().applyQuaternion(s.body.quat);e.dir.lerp(s.dir,0.15).normalize()}})()")
    pg.keyboard.up('KeyW')
    print('rescued salman:', ev("frontier.progress.crew.includes('salman')"), 'crew', ev("frontier.progress.crew.join(',')"), 'seeds', ev("frontier.progress.seeds"))
    time.sleep(1); pg.screenshot(path='shots/f_rescue.png')
    # shop
    ev("frontier.progress.seeds += 200"); ev("frontier.togglePause()"); time.sleep(0.5)
    pg.get_by_role('button', name='Upgrades').first.click(); time.sleep(0.5)
    pg.locator('.upg', has_text='Bird jetpack').get_by_role('button').click(); time.sleep(0.3)
    print('jetpack level:', ev("frontier.progress.upgrades.jetpack"), 'seeds', ev("frontier.progress.seeds"))
    pg.screenshot(path='shots/f_shop.png')
    print('\n'.join(logs[:20]) or 'no console errors')
    b.close()
