import { serverClient } from '@/lib/serverClient';
import { ApprovalsContent } from './ApprovalsContent';

export default async function ApprovalsPage() {
  let initialItems = [];
  try {
    const res = await serverClient('/google-workspace/approvals');
    if (res.ok) {
      initialItems = await res.json();
    }
  } catch (error) {
    console.error('Failed to fetch initial approvals:', error);
  }

  return <ApprovalsContent initialItems={initialItems} />;
}
