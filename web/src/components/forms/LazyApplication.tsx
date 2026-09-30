"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import type { ApplicationExperience as AE } from "./ApplicationExperience";

const ApplicationExperience = dynamic(() => import("./ApplicationExperience").then((m) => m.ApplicationExperience), {
  ssr: false,
  loading: () => <FormSkeleton />,
});

function FormSkeleton() {
  return (
    <div aria-hidden="true" className="min-h-[70rem] animate-pulse space-y-4">
      <div className="h-16 border border-ink/10 bg-white" />
      <div className="h-1 bg-ink/10" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-[3.25rem] border border-ink/10 bg-white" />
      ))}
    </div>
  );
}

/**
 * Loads the application form (React Hook Form + Zod) only when it approaches
 * the viewport or its anchor (#bewerben) is targeted – keeps job pages fast.
 */
export function LazyApplication(props: ComponentProps<typeof AE>) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setShow(true), { rootMargin: "900px 0px" });
    io.observe(el);
    const onHash = () => location.hash === "#bewerben" && setShow(true);
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => {
      io.disconnect();
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  return <div ref={ref}>{show ? <ApplicationExperience {...props} /> : <FormSkeleton />}</div>;
}
