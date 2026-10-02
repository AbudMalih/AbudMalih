import PageShell from "@/components/ui/PageShell";

export default function NotFound() {
  return <PageShell index="404" eyebrow="Off route" title={<>No route <span className="tone-graphite">here.</span></>} />;
}
