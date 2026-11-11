import { notFound, redirect } from 'next/navigation';
import { currentIdentity } from '@/lib/auth';
import { sections } from '@/lib/data';
import CyberShell from '@/components/CyberShell';
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const user = await currentIdentity();
  if (!user) redirect('/login');
  const { section } = await params;
  if (section === 'users' && user.role !== 'admin') redirect('/dashboard');
  if (!sections.some((item) => item[0] === section)) notFound();
  return (
    <CyberShell
      section={section as Parameters<typeof CyberShell>[0]['section']}
      username={user.username}
      role={user.role}
    />
  );
}
