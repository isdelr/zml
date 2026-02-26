"use client";

import React from "react";

type NonBlockingErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  boundaryName?: string;
  resetKey?: string | number;
};

type NonBlockingErrorBoundaryState = {
  hasError: boolean;
};

export class NonBlockingErrorBoundary extends React.Component<
  NonBlockingErrorBoundaryProps,
  NonBlockingErrorBoundaryState
> {
  state: NonBlockingErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): Partial<NonBlockingErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    const label = this.props.boundaryName ?? "unknown";
    console.error(`[Boundary:${label}]`, error);
  }

  componentDidUpdate(prevProps: NonBlockingErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
