import type { Metadata } from "next";
import { Suspense } from "react";
import { ListView } from "../../components/ListView";

export const metadata: Metadata = { title: "Tours" };

export default function ListPage() {
  return (
    <Suspense>
      <ListView />
    </Suspense>
  );
}
