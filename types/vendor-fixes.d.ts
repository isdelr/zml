import type * as React from "react";

declare module "redux" {
  export type EmptyObject = Record<string, never>;
  export type CombinedState<S> = S;
}

declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    interface ElementClass extends React.Component<any> {}
    interface ElementAttributesProperty {
      props: {};
    }
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
  }
}

export {};
