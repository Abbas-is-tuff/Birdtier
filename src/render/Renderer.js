// Three.js scene setup. The camera always sits at the scene origin; every object is placed
// relative to it each frame ("floating origin") so that double-precision world coordinates
// survive the trip to 32-bit GPU floats. A logarithmic depth buffer covers 0.1 m – 10¹³ m.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class SceneRenderer {
  constructor(canvas, q) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q.aa, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x8fb4e0, 0);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1e13);
    this.scene.add(this.camera);

    // Sunlight near the focus (parallel rays, casts shadows) …
    this.sun = new THREE.DirectionalLight(0xfff3e2, 3.4);
    this.sun.shadow.camera.left = -45; this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45; this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 600;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    // … and a point light at the star for the map, where every planet must be lit from its own direction.
    this.mapLight = new THREE.PointLight(0xfff3e2, 3.4, 0, 0);
    this.mapLight.visible = false;
    this.scene.add(this.mapLight);
    this.ambient = new THREE.AmbientLight(0x8899bb, 0.03);
    this.hemi = new THREE.HemisphereLight(0x9fc4ff, 0x554433, 0);
    this.scene.add(this.ambient, this.hemi);

    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pm.dispose();
    this.applyQuality(q);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  applyQuality(q) {
    this.q = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows > 0;
    this.sun.castShadow = q.shadows > 0;
    if (q.shadows > 0 && this.sun.shadow.mapSize.x !== q.shadows) {
      this.sun.shadow.mapSize.set(q.shadows, q.shadows);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // focusRel: focus position relative to camera; sunDir: unit vector from focus toward the star.
  setSun(focusRel, sunDir, starRel, visibility, mapMode) {
    this.sun.visible = !mapMode; this.mapLight.visible = mapMode;
    this.sun.intensity = 3.4 * visibility;
    this.sun.target.position.copy(focusRel);
    this.sun.position.copy(focusRel).addScaledVector(sunDir, 300);
    this.mapLight.position.copy(starRel);
    this.scene.environmentIntensity = 0.06 + 0.26 * visibility;
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
