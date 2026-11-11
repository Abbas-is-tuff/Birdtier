# Crew test: menu picker, workshop, EVA close-ups of several birds, and perk effects.
import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1440,'height':900})
    logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    pg.goto(URL); pg.wait_for_selector('.menu', timeout=120000); time.sleep(1)
    pg.locator('.crewbtn', has_text='Lemon').click(); time.sleep(0.5)
    pg.screenshot(path='shots/c_menu.png')
    ev = lambda js: pg.evaluate(js)
    print('pilot after menu pick:', ev("frontier.pilot.name"))
    pg.get_by_role('button', name='New Mission').click()
    try: pg.get_by_text('Start new career').click(timeout=1500)
    except Exception: pass
    time.sleep(3)
    print('funds after free first launch:', ev("frontier.progress.funds"))
    # workshop: Lemon discount
    ev("frontier.enterWorkshop()"); time.sleep(3)
    pg.screenshot(path='shots/c_workshop.png')
    print('workshop cost row:', pg.locator('.row', has_text='COST').first.inner_text().replace('\n',' '))
    pg.get_by_role('button', name='Launch').click(); time.sleep(3)
    print('funds after Lemon launch:', ev("frontier.progress.funds"), 'craft cost', ev("frontier.craft.cost"))
    # land on Miro and EVA, close-up of each bird
    ev("""(()=>{const g=frontier,c=g.craft,m=g.system.byId.miro;let n=0;while(c.stages.length>1&&n++<5)c.activateNextStage();
      const V=c.pos.constructor;c.placeOn(m,new V(0.3,0.5,0.8).normalize());c.computeEnv(g.system);
      const e=g.events;e.storm=null;for(const k in e.next)e.next[k]=1e12;c.failures={};g.interact();return g.entity&&g.entity.kind})()""")
    time.sleep(2)
    for bird in ['abbas','cookie','salman','lemon','aziz','lightning','pikachu','silver']:
        ev(f"(()=>{{const g=frontier;g.setPilot('{bird}');g.rig.dist.surface=3.0;g.rig.yaw=Math.PI*0.8;g.rig.pitch=0.3;document.getElementById('root').style.visibility='hidden'}})()")
        time.sleep(2.5); pg.screenshot(path=f'shots/c_eva_{bird}.png', clip={'x':420,'y':150,'width':600,'height':600})
    ev("document.getElementById('root').style.visibility='visible'"); time.sleep(0.5)
    pg.screenshot(path='shots/c_hud.png')
    # perks: walking speed and jump
    for bird in ['abbas','cookie']:
        ev(f"frontier.setPilot('{bird}')"); d0=ev("frontier.entity.dir.toArray()")
        pg.keyboard.down('KeyW'); time.sleep(3); pg.keyboard.up('KeyW')
        print(bird,'walk speed', ev("frontier.entity.mods.walk||1"), round(ev("Math.abs(frontier.entity.speed)") or 0,2), 'm/s last frame')
    print('repair time with Salman:', ev("(()=>{const g=frontier;g.setPilot('salman');g.craft.failures={x:1};g.repair=0;g.craft.thr.F=0;g.startRepair();return g.repair})()"))
    print('sample science Pikachu vs Abbas:', ev("""(()=>{const g=frontier,q=g.sciQueue;g.setPilot('pikachu');g.collectSample();const a=q[q.length-1].value;
       g.progress.sciDone=g.progress.sciDone.filter(k=>!k.startsWith('sample:'));g.setPilot('abbas');g.collectSample();return [a,q[q.length-1].value]})()"""))
    print('\n'.join(logs[:20]) or 'no console errors')
    b.close()
