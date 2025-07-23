import dynamic from "next/dynamic";

 
export function dynamicImport(componentImportFn: () => Promise<unknown>) {
  return dynamic(componentImportFn, {
     
  });
}