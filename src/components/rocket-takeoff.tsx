"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

export function RocketTakeoff() {
  const [animation, setAnimation] = useState<object | null>(null);
  useEffect(() => { void fetch("/lottie/launchbench-rocket-takeoff.json?v=6", { cache: "no-store" }).then((response) => response.json()).then(setAnimation); }, []);
  const rendererSettings = { preserveAspectRatio: "xMidYMid meet" };
  return <div className="h-[330px] w-[180px] overflow-hidden" aria-label="LaunchBench rocket taking off"><div className="rocket-lottie-takeoff h-full w-full">{animation && <Lottie animationData={animation} loop autoplay rendererSettings={rendererSettings} />}</div></div>;
}
