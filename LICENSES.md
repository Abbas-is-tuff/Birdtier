# Third-party licences

| Package | Version | Use | Licence |
|---|---|---|---|
| [three](https://github.com/mrdoob/three.js) | 0.187 | WebGL2 rendering, math types, `BufferGeometryUtils` (`three/addons`) | MIT |
| [react](https://github.com/facebook/react) / react-dom | 18.3 | User interface | MIT |
| [vite](https://github.com/vitejs/vite) | 8 | Development server and bundler (dev only) | MIT |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | 6 | JSX support for Vite (dev only) | MIT |
| [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) | 2 | Optional one-file build (dev only) | MIT |

No third-party art, audio, models, textures or fonts are bundled. The UI uses the system font stack.

## Original content

Everything else in this repository was written for this project: the Kaelis star system and every name in it,
terrain generation, shaders, spacecraft parts and models, user interface and game rules. The noise routines in
`src/world/noise.js` are independent implementations of published, unpatented algorithms (value/gradient noise,
fractal Brownian motion). Physical constants and standard formulas (Newtonian gravity, Kepler's equation, the
rocket equation, exponential atmospheres, Rayleigh phase function) are public-domain science.
