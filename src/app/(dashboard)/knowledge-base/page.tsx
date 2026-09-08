import { KBClient } from "./_components/kb-client";

export const metadata = {
  title: "Knowledge Base & AI Helpdesk | SI MANTAP",
  description: "Pusat pengetahuan IT, panduan troubleshooting mandiri, dan AI Helpdesk Assistant",
};

export default function KnowledgeBasePage() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <KBClient />
    </div>
  );
}
