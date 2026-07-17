"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

/** Animated LaunchBench mark for the login page: rocket shakes, ignites, lifts off the desk. */
export function LoginAnimation() {
  const [animation, setAnimation] = useState<object | null>(null);
  useEffect(() => { void fetch("/lottie/launchbench-desk.json?v=4", { cache: "no-store" }).then((response) => response.json()).then(setAnimation); }, []);
  const rendererSettings = { preserveAspectRatio: "xMidYMid meet" };
  return <div className="h-[300px] w-[257px] max-w-full" aria-label="Rocket taking off from a desk"><div className="h-full w-full">{animation && <Lottie animationData={animation} loop autoplay rendererSettings={rendererSettings} />}</div></div>;
}
