// Add a resize for reponsiveness
//Install and import gsap SplitText
//On pageload do an animation

import gsap from "gsap";
import { SplitText } from "gsap/all";
import { FluidSimulation } from "./webgl/fluid";
import GUI from "lil-gui";
import * as THREE from "three";

gsap.registerPlugin(SplitText);

const config = {
  simResolution: 128,
  dyeResolution: 1024,
  dyeDissipation: 0.97,
  velocityDissipation: 0.55,
  pressureDissipation: 0.8,
  pressureIterations: 50,
  curlStrength: 30,
  splatRadius: 0.275,
  forceStrength: 7.5,
  pressureDecay: 0.75,
  threshold: 1.0,
  edgeSoftness: 0.5,
  inkColor: new THREE.Color(0, 0, 0),
};

document.addEventListener("DOMContentLoaded", () => {
  function init() {
    const split = SplitText.create(".hero-container", { type: "chars" });

    // var canvas = createCanvas(500, 500);
    // console.log(canvas);
    gsap.from(split.chars, {
      y: 40,
      color: "#00FF66",
      opacity: 0,
      stagger: { each: 0.04, from: "start" },
      duration: 2.6,
      ease: "sine.out",
    });
  }

  init();
  const sim = new FluidSimulation(document.querySelector(".canvas"), config);
  const gui = new GUI();

  gui.add(config, "dyeDissipation", 0.8, 1, 0.001);
  gui.add(config, "velocityDissipation", 0, 1, 0.001);
  gui.add(config, "pressureDecay", 0, 1, 0.001);
  gui.add(config, "pressureIterations", 1, 100, 1);
  gui.add(config, "curl", 0, 50, 0.1);
  gui.add(config, "splatRadius", 0.01, 1, 0.001);
  gui.add(config, "forceStrength", 0, 20, 0.1);
  gui.add(config, "threshold", 0, 2, 0.01);
  gui.add(config, "edgeSoftness", 0, 1, 0.01);

  gui
    .addColor({ inkColor: `#${config.inkColor.getHexString()}` }, "inkColor")
    .name("Ink Color")
    .onChange((hex) => config.inkColor.set(hex));
});
