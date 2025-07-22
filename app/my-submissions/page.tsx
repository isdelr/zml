import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';

// Dynamically import the MySubmissionsPage component
const MySubmissionsPage = dynamicImport(() => import("@/components/MySubmissionsPage").then(mod => ({ default: mod.MySubmissionsPage })));

export const metadata: Metadata = {
  title: 'My Submissions',
  description: 'Track all the songs you have submitted across all your leagues. See your results and review your past entries.',
};

export default function MySubmissions() {
  return (
    <PageLayout>
      <MySubmissionsPage />
    </PageLayout>
  );
}