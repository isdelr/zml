import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import { MySubmissionsPage } from "@/components/MySubmissionsPage";

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
