import { createFileRoute } from "@tanstack/react-router";
import { CreazzyApp } from "@/components/creazzy/app-shell";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CreazzyApp />;
}
