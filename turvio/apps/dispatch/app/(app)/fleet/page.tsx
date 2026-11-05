import type { Metadata } from "next";
import { FleetView } from "../../../components/FleetView";

export const metadata: Metadata = { title: "Fleet & team" };

export default function FleetPage() {
  return <FleetView />;
}
