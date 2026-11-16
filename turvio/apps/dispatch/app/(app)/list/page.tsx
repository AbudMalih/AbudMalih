import type { Metadata } from "next";
import { Suspense } from "react";
import { ToursPage } from "../../../components/ToursPage";

export const metadata: Metadata = { title: "Tours" };

export default function ListPage() {
  return (
    <Suspense>
      <ToursPage />
    </Suspense>
  );
}
