# Forces each dynamic event and drives the rover; prints state and any console errors.
import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1280,'height':800})
    logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    pg.goto(URL); pg.wait_for_selector('.menu', timeout=120000)
    pg.get_by_role('button', name='New Mission').click()
    try: pg.get_by_text('Start new career').click(timeout=1500)
    except Exception: pass
    time.sleep(3)
    ev = lambda js: pg.evaluate(js)
    print('storm/fail/weather/shower/rogue armed:', ev("""(()=>{const g=frontier,e=g.events,t=g.t;e.next.storm=t;e.next.weather=t;e.next.rogue=t;e.next.shower=t;
       for(const b of g.system.bodies) if(b.atmo&&b.landable) {}; return true})()"""))
    time.sleep(4)
    print(ev("""(()=>{const g=frontier,e=g.events;return JSON.stringify({storm:!!e.storm,rogue:!!e.rogue,weather:g.system.bodies.filter(b=>b.weather).map(b=>b.name+':'+b.weather.type),sas:g.craft.sas,toasts:g.toasts.map(t=>t.msg)})})()"""))
    print('force failure:', ev("(()=>{const g=frontier;g.events.fail();return Object.keys(g.craft.failures)})()"))
    pg.screenshot(path='shots/z_events.png')
    print('rogue asteroid in orbit:', ev("""(()=>{const g=frontier,c=g.craft,h=g.system.home;c.landed=null;const r=h.radius+150e3,v=Math.sqrt(h.mu/r);
        const V=c.pos.constructor;c.pos.copy(h.pos).add(new V(r,0,0));c.vel.copy(h.vel).add(new V(0,0,-v));c.computeEnv(g.system);g.events.storm=null;g.events.next.rogue=g.t;return true})()"""))
    time.sleep(3)
    print('  ->', ev("(()=>{const e=frontier.events;return e.rogue?('spawned, distance '+e.rogue.pos.distanceTo(frontier.craft.pos).toFixed(0)+' m'):'none'})()"))
    pg.screenshot(path='shots/z_rogue.png')
    for js in ["(()=>{const c=frontier.craft;let n=0;while(c.stages.length>1&&n++<5) c.activateNextStage();return c.stages.length})()",
               "(()=>{const g=frontier,c=g.craft,m=g.system.byId.miro;const V=c.pos.constructor;c.placeOn(m,new V(0.3,0.5,0.8).normalize());c.computeEnv(g.system);c.has.rover=true;c.roverDeployed=false;g.events.rogue=null;g.removeRogueMesh();return !!c.landed})()",
               "(()=>{frontier.deployRover();frontier.interact();return frontier.entity&&frontier.entity.kind})()",
               "(()=>{const g=frontier;g.entity.dir.copy(g.rover.dir);g.interact();return 'rover boarded: '+(g.entity===g.rover)})()"]:
        print(ev(js))
    d0 = ev("frontier.rover.dir.toArray()")
    pg.keyboard.down('KeyW'); time.sleep(6); pg.keyboard.up('KeyW')
    print('rover moved (m):', ev(f"frontier.rover.dir.angleTo(new frontier.rover.dir.constructor(...{d0}))*frontier.rover.body.radius"))
    print('eclipse check (sunVis at Thalen night side):', ev("""(()=>{const g=frontier,h=g.system.home,s=g.system.star.pos.clone().sub(h.pos).normalize();const p=h.pos.clone().addScaledVector(s,-(h.radius+200e3));return g.system.sunVisibility(p,{})})()"""))
    print('\n'.join(logs[:30]))
    b.close()
