import dynamic, { DynamicOptions } from "next/dynamic";
import { ComponentType } from "react";

// Use generics to preserve the props type of the dynamically imported component
export function dynamicImport<P extends object>(
  componentImportFn: () => Promise<ComponentType<P> | { default: ComponentType<P> }>,
  options?: DynamicOptions<P>
) {
  return dynamic(componentImportFn, {
    ...options
  });
}