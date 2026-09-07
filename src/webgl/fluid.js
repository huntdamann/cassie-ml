import * as THREE from "three";
import shaders from "./shaders.js";
//Declare a class called "Fluid Sim"
//It will have it's own methods and initializers

export class FluidSimulation {
  constructor(canvas, config) {
    this.config = config;
    this.setupRenderer(canvas);
    this.setupScene();
    this.setupTargets();
    this.setupMaterials();
    this.setupInput();
    this.loop();
  }

  setupRenderer(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.dpr = this.renderer.getPixelRatio();
    this.width = innerWidth * this.dpr;
    this.height = innerHeight * this.dpr;
    window.addEventListener("resize", () => {
      this.width = innerWidth * this.dpr;
      this.height = innerHeight * this.dpr;
      this.renderer.setSize(innerWidth, innerHeight);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    });
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 5;
    this.bgSquare = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));

    this.scene.add(this.bgSquare);
  }
  setupTargets() {
    const { simResolution: simRes, dyeResolution: dyeRes } = this.config;
    const aspect = this.width / this.height;
    const options = { type: THREE.HalfFloatType, depthBuffer: false };

    //Single Target
    const single = (w, h) => new THREE.WebGLRenderTarget(w, h, options);
    //Double Target for ping ponging
    const double = (w, h) => ({
      read: single(w, h),
      write: single(w, h),
      swap() {
        [this.read, this.write] = [this.write, this.read];
      },
    });

    this.simSize = { w: simRes, h: Math.round(simRes / aspect) };
    this.dyeSize = { w: dyeRes, h: Math.round(dyeRes / aspect) };

    this.velocity = double(this.simSize.w, this.simSize.h);
    this.dye = double(this.dyeSize.w, this.dyeSize.h);
    this.divergence = single(this.simSize.w, this.simSize.h);
    this.curl = single(this.simSize.w, this.simSize.h);
    this.pressure = double(this.simSize.w, this.simSize.h);
  }
  setupMaterials() {
    // Helper Functions for quick use in of Multipass Shader Render
    const makeMaterial = ([vert, frag], uniforms) =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: uniforms,
      });
    const tex = () => ({ value: null });
    const num = (v = 0) => ({ value: v });
    const vec2 = () => ({ value: new THREE.Vector2() });
    const vec3 = () => ({ value: new THREE.Vector3() });

    // Stack each material on top of each other in order to create a multipass shader render
    this.material = {
      splat: makeMaterial(shaders.splat, {
        uTarget: tex(),
        aspectRatio: num(),
        radius: num(),
        color: vec3(),
        point: vec2(),
      }),
      advection: makeMaterial(shaders.advection, {
        uVelocity: tex(),
        uSource: tex(),
        dt: num(),
        dissipation: num(),
        texelSize: vec2(),
      }),
      divergence: makeMaterial(shaders.divergence, {
        uVelocity: tex(),
        texelSize: vec2(),
      }),
      curl: makeMaterial(shaders.curl, {
        uVelocity: tex(),
        texelSize: vec2(),
      }),
      vorticity: makeMaterial(shaders.vorticity, {
        uVelocity: tex(),
        curl: tex(),
        dt: num(),
        curlStrength: num(),
        texelSize: vec2(),
      }),
      pressure: makeMaterial(shaders.pressure, {
        uPressure: tex(),
        uDivergence: tex(),
        texelSize: vec2(),
      }),
      gradientSubtract: makeMaterial(shaders.gradientSubtract, {
        uPressure: tex(),
        uVelocity: tex(),
        texelSize: vec2(),
      }),
      clear: makeMaterial(shaders.clear, {
        uTexture: tex(),
        value: num(),
      }),
      display: makeMaterial(shaders.display, {
        uTexture: tex(),
        threshold: num(),
        edgeSoftness: num(),
        inkColor: vec3(),
      }),
    };
  }

  setupInput() {
    this.mouse = { x: 0, y: 0, velocityX: 0, velocityY: 0, moved: false };
    const onMove = (x, y) => {
      this.mouse.velocityX =
        (x * this.dpr - this.mouse.x) * this.config.forceStrength;
      this.mouse.velocityY =
        (y * this.dpr - this.mouse.y) * this.config.forceStrength;
      this.mouse.x = x * this.dpr;
      this.mouse.y = y * this.dpr;
      this.mouse.moved = true;
    };
    window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    window.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: false }
    );
  }
  _pass(material, target) {
    this.bgSquare.material = material;
    this.renderer.setRenderTarget(target ?? null);
    this.renderer.render(this.scene, this.camera);
  }
  _set(material, values) {
    Object.entries(values).forEach(
      ([key, value]) => (material.uniforms[key].value = value)
    );
    return material;
  }

  _splat(x, y, velocityX, velocityY) {
    const { material: m, velocity: vel, dye, width, height, config: c } = this;
    this._set(m.splat, {
      aspectRatio: width / height,
      radius: c.splatRadius / 100,
      point: new THREE.Vector2(x / width, 1 - y / height),
    });
    this._set(m.splat, {
      uTarget: vel.read.texture,
      color: new THREE.Vector3(velocityX, -velocityY, 0),
    });
    this._pass(m.splat, vel.write);
    vel.swap();

    this._set(m.splat, {
      uTarget: dye.read.texture,
      color: new THREE.Vector3(3, 3, 3),
    });
    this._pass(m.splat, dye.write);
    dye.swap();
  }
  _simulate(dt) {
    const {
      material: m,
      velocity: vel,
      dye,
      divergence: div,
      curl,
      pressure: pres,
      simSize,
      dyeSize,
      config: c,
    } = this;
    const simTexel = new THREE.Vector2(1 / simSize.w, 1 / simSize.h);

    this._pass(
      this._set(m.curl, { uVelocity: vel.read.texture, texelSize: simTexel }),
      curl
    );
    this._pass(
      this._set(m.vorticity, {
        uVelocity: vel.read.texture,
        curl: curl.texture,
        dt,
        curlStrength: c.curlStrength,
        texelSize: simTexel,
      }),
      vel.write
    );
    vel.swap();
    this._pass(
      this._set(m.divergence, {
        uVelocity: vel.read.texture,
        texelSize: simTexel,
      }),
      div
    );
    this._pass(
      this._set(m.clear, {
        uTexture: pres.read.texture,
        value: c.pressureDecay,
      }),
      pres.write
    );
    pres.swap();
    this._set(m.pressure, {
      uDivergence: div.texture,
      texelSize: simTexel,
    });
    for (let i = 0; i < c.pressureIterations; i++) {
      m.pressure.uniforms.uPressure.value = pres.read.texture;
      this._pass(m.pressure, pres.write);
      pres.swap();
    }

    this._pass(
      this._set(m.gradientSubtract, {
        uPressure: pres.read.texture,
        uVelocity: vel.read.texture,
        texelSize: simTexel,
      }),
      vel.write
    );

    this._set(m.advection, {
      uVelocity: vel.read.texture,
      uSource: vel.read.texture,
      dt,
      dissipation: c.velocityDissipation,
      texelSize: simTexel,
    });
    this._pass(m.advection, vel.write);
    vel.swap();

    this._set(m.advection, {
      uSource: dye.read.texture,
      dissipation: c.dyeDissipation,
      texelSize: new THREE.Vector2(1 / dyeSize.w, 1 / dyeSize.h),
    });
    this._pass(m.advection, dye.write);
    dye.swap();
  }
  _render() {
    this._pass(
      this._set(this.material.display, {
        uTexture: this.dye.read.texture,
        threshold: this.config.threshold,
        edgeSoftness: this.config.edgeSoftness,
        inkColor: this.config.inkColor,
      }),
      null
    );
  }
  loop() {
    let lastTime = Date.now();
    const tick = () => {
      const dt = Math.min((Date.now() - lastTime) / 1000, 0.016);
      this.renderer.render(this.scene, this.camera);

      lastTime = Date.now();
      if (this.mouse.moved) {
        this._splat(
          this.mouse.x,
          this.mouse.y,
          this.mouse.velocityX,
          this.mouse.velocityY
        );
        this.mouse.moved = false;
      }
      this._simulate(dt);
      this._render();
      requestAnimationFrame(tick);
    };
    tick();
  }
}
