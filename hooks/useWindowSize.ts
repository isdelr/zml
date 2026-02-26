// hooks/useWindowSize.ts
import { useState, useEffect } from "react";

export function useWindowSize() {
  const [windowSize, setWindowSize] = useState<{
    width: number;
    height: number;
  }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", handleResize);
    handleResize(); // Set the initial size

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}