import { Topbar } from '@/components/layout/topbar';
import { IssueForm } from '@/components/issues/issue-form';

export default function NewIssuePage() {
  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Create Issue"
        subtitle="Paste or type an incoming message — AI will extract structured data"
      />
      <main className="flex-1 p-6">
        <IssueForm />
      </main>
    </div>
  );
}
