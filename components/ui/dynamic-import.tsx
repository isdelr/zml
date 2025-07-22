import dynamic from "next/dynamic";

// Helper function to create dynamic imports with loading states
export function dynamicImport(componentImportFn: () => Promise<unknown>) {
  return dynamic(componentImportFn, {
    // ssr: false,
  });
}