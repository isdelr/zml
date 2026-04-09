import { render, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import WaveformData from "waveform-data";
import { Waveform } from "@/components/Waveform";

type StrokeRecord = {
  strokeStyle: string;
  startY: number;
  endY: number;
};

function createWaveform(data: number[]) {
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: 4000,
    samples_per_pixel: 256,
    bits: 16,
    length: data.length / 2,
    data,
  });
}

describe("Waveform", () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalCanvasWidth = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "clientWidth",
  );
  const originalCanvasHeight = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "clientHeight",
  );

  let strokes: StrokeRecord[] = [];
  let currentStrokeStartY = 0;
  let currentStrokeEndY = 0;

  const contextMock = {
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "round",
    globalAlpha: 1,
    setTransform: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn((_: number, y: number) => {
      currentStrokeStartY = y;
    }),
    lineTo: vi.fn((_: number, y: number) => {
      currentStrokeEndY = y;
    }),
    stroke: vi.fn(function stroke(this: { strokeStyle: string }) {
      strokes.push({
        strokeStyle: this.strokeStyle,
        startY: currentStrokeStartY,
        endY: currentStrokeEndY,
      });
    }),
  };

  beforeAll(() => {
    class ResizeObserverMock {
      callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe() {
        this.callback(
          [] as ResizeObserverEntry[],
          this as unknown as ResizeObserver,
        );
      }

      unobserve() {}

      disconnect() {}
    }

    globalThis.ResizeObserver =
      ResizeObserverMock as unknown as typeof ResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return {
        width: 6,
        height: 32,
        top: 0,
        left: 0,
        right: 6,
        bottom: 32,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      };
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(() => contextMock as never);
    Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 6;
      },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 32;
      },
    });
  });

  beforeEach(() => {
    strokes = [];
    currentStrokeStartY = 0;
    currentStrokeEndY = 0;
    document.documentElement.style.setProperty("--primary", "#ff0000");
    document.documentElement.style.setProperty("--muted-foreground", "#999999");
  });

  afterAll(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    HTMLCanvasElement.prototype.getContext = originalGetContext;

    if (originalCanvasWidth) {
      Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", originalCanvasWidth);
    }
    if (originalCanvasHeight) {
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        "clientHeight",
        originalCanvasHeight,
      );
    }
  });

  it("keeps the peak bar tall and does not recompute resampling on progress updates", async () => {
    const waveform = createWaveform([
      -100,
      100,
      -150,
      150,
      -28000,
      28000,
      -120,
      120,
      -90,
      90,
      -80,
      80,
      -70,
      70,
      -60,
      60,
    ]);
    const resampleSpy = vi.spyOn(waveform, "resample");
    const onSeek = vi.fn();

    const { rerender } = render(
      <Waveform
        waveform={waveform}
        progress={0}
        duration={8}
        onSeek={onSeek}
        className="h-8"
        comments={[]}
      />,
    );

    await waitFor(() => {
      expect(strokes.length).toBeGreaterThan(0);
    });
    expect(resampleSpy).toHaveBeenCalledTimes(1);

    strokes = [];

    rerender(
      <Waveform
        waveform={waveform}
        progress={4}
        duration={8}
        onSeek={onSeek}
        className="h-8"
        comments={[]}
      />,
    );

    await waitFor(() => {
      expect(strokes.some((stroke) => stroke.strokeStyle === "#ff0000")).toBe(true);
    });

    const primaryStroke = strokes.find((stroke) => stroke.strokeStyle === "#ff0000");
    const shortestMutedStroke = strokes
      .filter((stroke) => stroke.strokeStyle === "#999999")
      .sort(
        (left, right) =>
          Math.abs(left.endY - left.startY) - Math.abs(right.endY - right.startY),
      )[0];

    expect(primaryStroke).toBeDefined();
    expect(Math.abs((primaryStroke?.endY ?? 0) - (primaryStroke?.startY ?? 0))).toBeGreaterThan(20);
    expect(
      Math.abs(
        (shortestMutedStroke?.endY ?? 0) - (shortestMutedStroke?.startY ?? 0),
      ),
    ).toBeLessThan(2);
    expect(resampleSpy).toHaveBeenCalledTimes(1);
  });
});
