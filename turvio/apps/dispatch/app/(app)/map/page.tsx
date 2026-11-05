import type { Metadata } from "next";
import { MapWorkspace } from "../../../components/MapWorkspace";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return <MapWorkspace />;
}
