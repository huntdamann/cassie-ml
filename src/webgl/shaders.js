//Each Shader has the same vertex shader, so we can define it once and reuse it for all the materials
const v = `varying vec2 vUv; 
void main () {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

const p = `precision highp float;`;
const s = `precision mediump sampler2D;`;

export default {
  splat: [
    v,
    `${p} ${s}
        uniform sampler2D uTarget;
        uniform float aspectRatio, radius;
        uniform vec3 color;
        uniform vec2 point;
        varying vec2 vUv;

        void main () {
        vec2 p = vUv - point;
        p.x *= aspectRatio;
        gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + exp(-dot(p, p) / radius) * color, 1.0);}

        `,
  ],
  advection: [
    v,
    `${p} ${s}
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform float dt, dissipation;
        uniform vec2 texelSize;
        varying vec2 vUv;

        void main () {
          gl_FragColor = vec4(dissipation * texture2D(uSource, vUv - dt * texture2D(uVelocity, vUv).xy * texelSize).xyz, 1.0);
        }
      `,
  ],
  divergence: [
    v,
    `${p} ${s}
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        varying vec2 vUv;

        vec2 vel(vec2 uv) {
        vec2 e = vec2(1.0, 0.0);
        if (uv.x < 0.0) {
            uv.x = 0.0;
            e.x = -1.0;
        }
        if (uv.x > 1.0) {
            uv.x = 1.0;
            e.x = -1.0;
        
        }
        if (uv.y < 0.0) {
            uv.y = 0.0;
            e.y = -1.0;
       
        }
        if (uv.y > 1.0) {
            uv.y = 1.0;
            e.y = -1.0;
        }
        return texture2D(uVelocity, uv).xy * e;
        }

        void main () {

        vec2 L = vUv - vec2(texelSize.x, 0.0), 
            R = vUv + vec2(texelSize.x, 0.0),
            T = vUv + vec2(0.0, texelSize.y),
            B = vUv - vec2(0.0, texelSize.y);

        gl_FragColor = vec4(0.95 * (vel(R).x - vel(L).x + vel(T).y - vel(B).y), 0.0, 0.0, 1.0);
  }

      `,
  ],
  curl: [
    v,
    `${p} ${s}
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        varying vec2 vUv;

        void main () {
          vec2 L = vUv - vec2(texelSize.x, 0.0), 
                R = vUv + vec2(texelSize.x, 0.0),
                T = vUv + vec2(0.0, texelSize.y),
                B = vUv - vec2(0.0, texelSize.y);

          gl_FragColor = vec4(texture2D(uVelocity, R).x - texture2D(uVelocity, L).y - texture2D(uVelocity, T).x + texture2D(uVelocity, B).x, 0.0, 0.0, 1.0);
        }
      `,
  ],
  vorticity: [
    v,
    `${p} ${s}
        uniform sampler2D uVelocity;
        uniform sampler2D curl;
        uniform float dt, curlStrength;
        uniform vec2 texelSize;
        varying vec2 vUv;

        void main () {
        vec2 L = vUv - vec2(texelSize.x, 0.0),
            R = vUv + vec2(texelSize.x, 0.0),
            T = vUv + vec2(0.0, texelSize.y),
            B = vUv - vec2(0.0, texelSize.y);
        vec2 f = normalize(vec2(abs(texture2D(curl, T).x) - abs(texture2D(curl, B).x), abs(texture2D(curl, R).x) - abs(texture2D(curl, L).x)) + 0.001) * curlStrength * texture2D(curl, vUv).x;
        gl_FragColor = vec4(texture2D(uVelocity, vUv).xy + f * dt, 0.0, 1.0);
        }
      `,
  ],
  pressure: [
    v,
    `${p} ${s}
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        uniform vec2 texelSize;
        varying vec2 vUv;

        void main () {
          vec2 L = clamp(vUv - vec2(texelSize.x, 0.0), 0.0, 1.0),
                R = clamp(vUv + vec2(texelSize.x, 0.0), 0.0, 1.0),
                T = clamp(vUv + vec2(0.0, texelSize.y), 0.0, 1.0),
                B = clamp(vUv - vec2(0.0, texelSize.y), 0.0, 1.0);

          gl_FragColor = vec4((texture2D(uPressure, L).x + texture2D(uPressure, R).x + texture2D(uPressure, T).x + texture2D(uPressure, B).x - texture2D(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
        }
      `,
  ],
  gradientSubtract: [
    v,
    `${p} ${s}
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        varying vec2 vUv;

        void main () {
          float pL = texture2D(uPressure, clamp(vUv - vec2(texelSize.x, 0.0), 0.0, 1.0)).x,
                pR = texture2D(uPressure, clamp(vUv + vec2(texelSize.x, 0.0), 0.0, 1.0)).x,
                pT = texture2D(uPressure, clamp(vUv + vec2(0.0, texelSize.y), 0.0, 1.0)).x,
                pB = texture2D(uPressure, clamp(vUv - vec2(0.0, texelSize.y), 0.0, 1.0)).x;

          gl_FragColor = vec4(texture2D(uVelocity, vUv).xy - vec2(pR - pL, pT - pB) * 0.5, 0.0, 1.0);
        }
      `,
  ],

  clear: [
    v,
    `${p} ${s}
        uniform sampler2D uTexture;
        uniform float value;
        varying vec2 vUv;

        void main () {
          gl_FragColor = value * texture2D(uTexture, vUv);
        }
      `,
  ],
  display: [
    v,
    `${p} ${s}
        uniform sampler2D uTexture;
        uniform float threshold, edgeSoftness;
        uniform vec3 inkColor;
        varying vec2 vUv;

        void main () {
         float d = clamp(length(texture2D(uTexture, vUv).xyz), 0.0, 1.0);
         float a = edgeSoftness > 0.0 ? smoothstep(threshold - edgeSoftness * 0.5, threshold + edgeSoftness * 0.5, d) : step(threshold, d);
          gl_FragColor = vec4(inkColor, a);
        }
      `,
  ],
};
