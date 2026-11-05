import type { Metadata } from "next";
import { PlanningView } from "../../../components/PlanningView";

export const metadata: Metadata = { title: "Planning" };

export default function PlanningPage() {
  return <PlanningView />;
}
