# Inside the ship (zero-g in orbit, gravity on the pad), the hatch, and a tethered spacewalk.
import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/app.html'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1280,'height':800})
    logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    ev = lambda js: pg.evaluate(js)
    st = lambda: ev("JSON.stringify((()=>{const e=frontier.entity;return e?{kind:e.kind,zeroG:e.zeroG,y:+(e.y||0).toFixed(2),local:e.local?e.local.toArray().map(v=>+v.toFixed(2)):null,dist:e.distToCraft?+e.distToCraft().toFixed(1):null,near:e.nearby?(e.nearby()||{}).id:null}:null})())")
    pg.goto(URL); pg.wait_for_selector('.menu', timeout=200000); time.sleep(1)
    pg.get_by_role('button', name='Quick Start').click(); time.sleep(3)
    pg.keyboard.press('Enter'); time.sleep(3)
    print('in cabin (orbit):', st())
    pg.screenshot(path='shots/e_cabin_zero.png')
    # walk to the window on the left: turn and walk
    ev("(()=>{const e=frontier.entity;e.local.set(-2.3,0,0.2);e.heading=-Math.PI/2})()"); time.sleep(1)
    print('near window:', st()); pg.keyboard.press('KeyF'); time.sleep(1)
    print('radio:', pg.inner_text('.radio').replace('\n',' ') if pg.query_selector('.radio') else None)
    ev("frontier.rig.yaw=1.2; frontier.rig.pitch=0.2"); time.sleep(1.5); pg.screenshot(path='shots/e_cabin_window.png')
    ev("(()=>{const e=frontier.entity;e.local.set(2.05,0,0.25);e.heading=Math.PI/2})()"); time.sleep(1)
    print('near bowl:', st()); pg.keyboard.press('KeyV'); time.sleep(0.8)
    print('radio:', pg.inner_text('.radio').replace('\n',' ') if pg.query_selector('.radio') else None)
    ev("frontier.rig.yaw=-2.2; frontier.rig.pitch=0.4"); time.sleep(1.5); pg.screenshot(path='shots/e_cabin_bowl.png')
    # walk with the keyboard and check movement
    l0 = ev("frontier.entity.local.toArray()"); pg.keyboard.down('KeyW'); time.sleep(1.5); pg.keyboard.up('KeyW')
    print('walked from', l0, 'to', ev("frontier.entity.local.toArray().map(v=>+v.toFixed(2))"))
    # hatch -> spacewalk
    ev("(()=>{const e=frontier.entity;e.local.set(0,0,-2.4);e.heading=Math.PI})()"); time.sleep(0.8)
    print('near hatch:', st()); ev("frontier.rig.yaw=0;frontier.rig.pitch=0.25"); time.sleep(1); pg.screenshot(path='shots/e_cabin_hatch.png')
    pg.keyboard.press('KeyF'); time.sleep(2)
    print('after hatch:', st())
    pg.keyboard.down('KeyW'); time.sleep(4); pg.keyboard.up('KeyW')
    pg.keyboard.down('Space'); time.sleep(1.5); pg.keyboard.up('Space'); time.sleep(1)
    print('spacewalking:', st()); pg.screenshot(path='shots/e_spacewalk.png')
    ev("frontier.rig.dist.surface=25;frontier.rig.yaw+=2"); time.sleep(1.5); pg.screenshot(path='shots/e_spacewalk2.png')
    # fly far: tether
    ev("frontier.entity.vel.set(0,0,0);frontier.entity.rel.setLength(60)"); time.sleep(1); print('tether clamp:', st())
    ev("frontier.entity.rel.setLength(4)"); pg.keyboard.press('KeyF'); time.sleep(1); print('boarded:', st())
    # landed cabin with gravity on the pad, then hatch -> surface EVA
    ev("frontier.toMenu()"); time.sleep(1); ev("frontier.launch(frontier.craft ? frontier.craft.design : undefined)") 
    time.sleep(0.5)
    ev("(()=>{const g=frontier;g.newCareer()})()"); time.sleep(3)
    pg.keyboard.press('Enter'); time.sleep(2)
    print('cabin on pad:', st()); pg.keyboard.press('Space'); time.sleep(0.25); print('jump:', st())
    time.sleep(1); pg.screenshot(path='shots/e_cabin_pad.png')
    ev("(()=>{const e=frontier.entity;e.local.set(0,0,-2.4)})()"); time.sleep(0.6); pg.keyboard.press('KeyF'); time.sleep(1.5)
    print('hatch on ground:', st())
    print('\n'.join(logs[:20]) or 'no console errors')
    b.close()
