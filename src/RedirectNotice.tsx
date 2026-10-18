"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingScreen from "./_LoadingScreen";

/* Shown instead of a blank frame when a page can't be used yet and we are
   sending the user somewhere else. Says why, then replaces the history entry
   so Back doesn't bounce into the same redirect. */
export default function RedirectNotice({
  to,
  title,
  message,
  fullScreen = true,
}: {
  to: string;
  title: string;
  message: string;
  fullScreen?: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return <LoadingScreen title={title} message={message} fullScreen={fullScreen} />;
}
