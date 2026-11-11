# Phone emulation: menu, workshop, flight HUD with touch controls, joystick + throttle, EVA, sheets,
# in landscape and portrait. Usage: python3 tests/mobile.py [url]
import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'
ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx = b.new_context(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    ev = lambda js: pg.evaluate(js)
    pg.goto(URL); pg.wait_for_selector('.menu', timeout=120000); time.sleep(1.5)
    print('layout flags:', ev("(()=>{const u=document.documentElement.classList;return [...u].join(' ')+' | quality='+frontier.settings.quality})()"))
    pg.screenshot(path='shots/m_menu_land.png')
    pg.get_by_role('button', name='New Mission').tap()
    try: pg.get_by_text('Start new career').tap(timeout=1500)
    except Exception: pass
    time.sleep(4); pg.screenshot(path='shots/m_pad.png')
    # throttle slider: tap near top of the track
    tr = pg.locator('.ttrack').bounding_box()
    pg.touchscreen.tap(tr['x']+tr['width']/2, tr['y']+tr['height']*0.1); time.sleep(0.3)
    print('throttle after slider tap:', round(ev("frontier.craft.throttle"),2))
    pg.locator('.tbtn.big', has_text='Stage').tap(); time.sleep(4)
    print('altitude after staging (m):', round(ev("frontier.craft.env.alt"),1))
    # joystick: drag right with the mouse (pointer events), check yaw input reaches the craft
    st = pg.locator('.stick').bounding_box(); cx, cy = st['x']+st['width']/2, st['y']+st['height']/2
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx+60, cy-30, steps=4); time.sleep(0.4)
    print('joystick analog:', ev("JSON.stringify(frontier.input.analog)"), 'yaw axis', ev("frontier.input.axis('yawRight','yawLeft')"))
    time.sleep(1.5); pg.screenshot(path='shots/m_flight.png'); pg.mouse.up(); time.sleep(0.2)
    print('analog after release:', ev("JSON.stringify(frontier.input.analog)"))
    # info drawer
    pg.get_by_role('button', name='Info').tap(); time.sleep(0.8); pg.screenshot(path='shots/m_drawer.png')
    pg.locator('.drawer .click', has_text='Close').tap(); time.sleep(0.3)
    # map + body sheet
    pg.locator('.controls button', has_text='Map').tap(); time.sleep(3); pg.screenshot(path='shots/m_map.png')
    pg.locator('.controls button', has_text='Map').tap(); time.sleep(1)
    # land on Miro, EVA, walk with the joystick
    ev("""(()=>{const g=frontier;if(g.craft.destroyed||g.getUIlost)g.revert();const c=g.craft,m=g.system.byId.miro;let n=0;while(c.stages.length>1&&n++<5)c.activateNextStage();
      const V=c.pos.constructor;c.placeOn(m,new V(0.3,0.5,0.8).normalize());c.computeEnv(g.system);
      const e=g.events;e.storm=null;for(const k in e.next)e.next[k]=1e12;c.failures={};g.interact();g.toasts.length=0})()""")
    time.sleep(2)
    d0 = ev("frontier.entity.dir.toArray()")
    st = pg.locator('.stick').bounding_box(); cx, cy = st['x']+st['width']/2, st['y']+st['height']/2
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx, cy-60, steps=4); time.sleep(3)
    pg.screenshot(path='shots/m_eva.png'); pg.mouse.up()
    print('walked (m):', round(ev(f"frontier.entity.dir.angleTo(new frontier.entity.dir.constructor(...{d0}))*frontier.entity.body.radius"),2))
    pg.locator('.controls button', has_text='Colony').tap(); time.sleep(0.8); pg.screenshot(path='shots/m_colony.png')
    pg.locator('.sheetclose').tap(); time.sleep(0.3)
    # workshop
    ev("frontier.enterWorkshop()"); time.sleep(3); pg.screenshot(path='shots/m_workshop.png')
    pg.locator('.tabbar button', has_text='Vessel').tap(); time.sleep(0.5); pg.screenshot(path='shots/m_workshop_vessel.png')
    ev("frontier.exitWorkshop(false)"); time.sleep(1)
    pg.get_by_role('button', name='Planetary Database').tap(); time.sleep(3); pg.screenshot(path='shots/m_db.png')
    # portrait
    pg.set_viewport_size({'width':390,'height':844}); time.sleep(1); pg.screenshot(path='shots/m_db_port.png')
    pg.get_by_role('button', name='Back to main menu').tap(); time.sleep(1); pg.screenshot(path='shots/m_menu_port.png')
    pg.get_by_role('button', name='Continue Mission').tap(); time.sleep(4); pg.screenshot(path='shots/m_eva_port.png')
    print('\n'.join(logs[:20]) or 'no console errors')
    b.close()
