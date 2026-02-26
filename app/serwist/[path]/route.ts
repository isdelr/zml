import { createSerwistRoute } from "@serwist/turbopack";

export const {
  GET,
  dynamic,
  dynamicParams,
  generateStaticParams,
  revalidate,
} = createSerwistRoute({
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});
