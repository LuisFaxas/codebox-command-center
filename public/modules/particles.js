/* Particle background — ported from ReactBits Particles component
   Uses OGL (WebGL) for performant particle rendering
   Renders behind the session cards for visual depth */

import { Renderer, Camera, Geometry, Program, Mesh } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/index.js';

const PARTICLE_COLORS = ['#667eea', '#764ba2', '#f093fb'];

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const int = parseInt(hex, 16);
  return [(int >> 16 & 255) / 255, (int >> 8 & 255) / 255, (int & 255) / 255];
}

const vertexShader = `
  attribute vec3 position;
  attribute vec4 random;
  attribute vec3 color;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpread;
  uniform float uBaseSize;
  uniform float uSizeRandomness;

  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vRandom = random;
    vColor = color;

    vec3 pos = position * uSpread;
    pos.z *= 10.0;

    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    float t = uTime;
    mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
    mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
    mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);

    vec4 mvPos = viewMatrix * mPos;
    gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord.xy;
    float d = length(uv - vec2(0.5));
    float circle = smoothstep(0.5, 0.4, d) * 0.6;
    gl_FragColor = vec4(vColor + 0.15 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
  }
`;

function initParticles(container, options = {}) {
  if (!container) return null;

  const {
    count = 120,
    spread = 10,
    speed = 0.08,
    baseSize = 80,
    sizeRandomness = 1,
    cameraDistance = 20,
    colors = PARTICLE_COLORS
  } = options;

  const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), depth: false, alpha: true });
  const gl = renderer.gl;
  gl.canvas.style.position = 'absolute';
  gl.canvas.style.top = '0';
  gl.canvas.style.left = '0';
  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';
  gl.canvas.style.pointerEvents = 'none';
  gl.canvas.style.zIndex = '0';
  container.style.position = 'relative';
  container.appendChild(gl.canvas);
  gl.clearColor(0, 0, 0, 0);

  const camera = new Camera(gl, { fov: 15 });
  camera.position.set(0, 0, cameraDistance);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
  }
  window.addEventListener('resize', resize);
  resize();

  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count * 4);
  const colorsArr = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    let x, y, z, len;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      len = x * x + y * y + z * z;
    } while (len > 1 || len === 0);
    const r = Math.cbrt(Math.random());
    positions.set([x * r, y * r, z * r], i * 3);
    randoms.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const col = hexToRgb(colors[Math.floor(Math.random() * colors.length)]);
    colorsArr.set(col, i * 3);
  }

  const geometry = new Geometry(gl, {
    position: { size: 3, data: positions },
    random: { size: 4, data: randoms },
    color: { size: 3, data: colorsArr }
  });

  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSpread: { value: spread },
      uBaseSize: { value: baseSize * renderer.dpr },
      uSizeRandomness: { value: sizeRandomness },
    },
    transparent: true,
    depthTest: false
  });

  const particles = new Mesh(gl, { mode: gl.POINTS, geometry, program });

  let raf;
  let lastTime = performance.now();
  let elapsed = 0;

  function update(t) {
    raf = requestAnimationFrame(update);
    const delta = t - lastTime;
    lastTime = t;
    elapsed += delta * speed;

    program.uniforms.uTime.value = elapsed * 0.001;
    particles.rotation.x = Math.sin(elapsed * 0.0002) * 0.1;
    particles.rotation.y = Math.cos(elapsed * 0.0005) * 0.15;
    particles.rotation.z += 0.005 * speed;

    renderer.render({ scene: particles, camera });
  }

  raf = requestAnimationFrame(update);

  return {
    destroy() {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
    }
  };
}

export { initParticles };
