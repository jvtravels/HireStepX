"use client";
import { useSyncExternalStore } from "react";

const STAGING_HOST = "staging.hirestepx.com";
const noopSubscribe = () => () => {};

export function useStagingHost(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.hostname === STAGING_HOST,
    () => false,
  );
}
