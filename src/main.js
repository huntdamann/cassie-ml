// Add a resize for reponsiveness
//Install and import gsap SplitText
//On pageload do an animation

import gsap from "gsap";
import { SplitText } from "gsap/all";

gsap.registerPlugin(SplitText);

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
});
