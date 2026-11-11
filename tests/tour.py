import sys, time, os
from playwright.sync_api import sync_playwright
want = sys.argv[1:]  # any of: ascent orbit miro colony screens; set URL env to test another server
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1440,'height':900})
    logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    pg.goto(os.environ.get('URL', 'http://localhost:5173/'))
    pg.wait_for_selector('.menu', timeout=120000)
    def shot(n): 
        pg.screenshot(path=f'shots/{n}.png')
    def ev(js): return pg.evaluate(js)
    pg.click('text=New Mission')
    try: pg.click('text=Start new career', timeout=1500)
    except Exception: pass
    time.sleep(5); shot('a_pad')
    if 'ascent' in want:
        pg.keyboard.press('KeyZ'); pg.keyboard.press('Space'); time.sleep(5); shot('b_liftoff')
        pg.keyboard.press('Period'); pg.keyboard.press('Period'); pg.keyboard.down('KeyD'); time.sleep(1.2); pg.keyboard.up('KeyD'); time.sleep(10); shot('b_ascent')
    if 'orbit' in want:
        ev("""(() => { const g = window.frontier, c = g.craft, h = g.system.home; c.landed = null; c.activateNextStage(); c.activateNextStage(); c.activateNextStage();
          const r = h.radius + 110e3, v = Math.sqrt(h.mu / r); const sun = g.system.star.pos.clone().sub(h.pos).normalize();
          const side = sun.clone().cross(h.axis).normalize();
          c.pos.copy(h.pos).addScaledVector(sun, r*0.8).addScaledVector(side, r*0.6); c.vel.copy(h.vel).addScaledVector(side, -v*0.8).addScaledVector(sun, v*0.6); c.throttle = 0; g.rig.dist.chase = 30; g.rig.pitch = 0.3; g.rig.yaw = 2.2; })()""")
        time.sleep(6); shot('c_orbit')
        pg.keyboard.press('KeyZ'); time.sleep(3); shot('c_orbit_burn'); pg.keyboard.press('KeyX')
        pg.keyboard.press('KeyC'); time.sleep(3); shot('c_cockpit')
        pg.keyboard.press('KeyC'); time.sleep(5); shot('c_orbital')
        pg.keyboard.press('KeyC'); pg.keyboard.press('KeyC'); pg.keyboard.press('KeyC');
        pg.keyboard.press('KeyM'); time.sleep(3); pg.mouse.move(700,400); 
        for i in range(12): pg.mouse.wheel(0, 600)
        time.sleep(2); shot('c_map_far'); pg.keyboard.press('KeyM')
    if 'miro' in want:
        ev("""(() => { const g = window.frontier, c = g.craft, m = g.system.byId.miro; 
          const sun = g.system.star.pos.clone().sub(m.pos).normalize(); const d = m.localDir(m.pos.clone().addScaledVector(sun, 1).addScaledVector(m.axis, 0.5), new (sun.constructor)());
          while (c.stages.length > 2) c.activateNextStage(); c.cargo = 0; c.placeOn(m, d); c.computeEnv(g.system); g.rig.setMode('chase'); g.rig.pitch = 0.15; g.rig.dist.chase = 30; })()""")
        time.sleep(6); shot('d_miro')
        pg.keyboard.press('KeyF'); time.sleep(1); pg.keyboard.down('KeyW'); time.sleep(4); pg.keyboard.up('KeyW'); pg.keyboard.press('KeyV'); pg.keyboard.press('KeyO'); time.sleep(3); shot('d_eva')
    if 'colony' in want:
        ev("""(() => { const g = window.frontier, c = g.craft; if (g.entity) { g.entity = null; g.astronaut = null; } c.cargoCap = 2000; c.cargo = 900; console.log(g.foundColony()); const col = g.colonies[0]; for (const t of ['solar','greenhouse','lab','antenna','pad','storage']) console.log(g.buildAt(col, t)); g.rig.yaw = 1.2; g.rig.dist.chase = 110; g.rig.pitch = 0.35; })()""")
        pg.keyboard.press('KeyB'); time.sleep(5); shot('e_colony')
        pg.keyboard.press('KeyB')
        for i in range(6): pg.keyboard.press('Period')
        time.sleep(6); shot('e_warp')
    if 'screens' in want:
        pg.keyboard.press('KeyP'); time.sleep(1); shot('f_pause')
        pg.get_by_role('button', name='Spacecraft Workshop').click(); time.sleep(4); shot('f_workshop')
        pg.click('text=Main menu'); time.sleep(1)
        pg.get_by_role('button', name='Planetary Database').click(); time.sleep(1); pg.locator('.item.click', has_text='Brannoch').first.click(); time.sleep(8); shot('f_db_brannoch')
        pg.locator('.item.click', has_text='Cindra').first.click(); time.sleep(8); shot('f_db_cindra')
        pg.locator('.item.click', has_text='Ordun').first.click(); time.sleep(8); shot('f_db_ordun')
        pg.get_by_role('button', name='Back to main menu').click(); pg.get_by_role('button', name='Settings').click(); time.sleep(1); shot('f_settings')
    print('\n'.join(logs[:40]))
    b.close()
