import type { Metadata } from "next";
import { PickupsView } from "../../components/PickupsView";

export const metadata: Metadata = { title: "Pickups" };

export default function PickupsPage() {
  return <PickupsView />;
}
