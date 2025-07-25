import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { MySubmissionsPage } from "@/components/MySubmissionsPage";

export const metadata: Metadata = {
  title: 'My Submissions',
  description: 'Track all the songs you have submitted across all your leagues. See your results and review your past entries.',
};

export default async function MySubmissions() {
  const preloadedSubmissions = await preloadQuery(api.submissions.getMySubmissions);
  
  return (
    <PageLayout>
      <MySubmissionsPage preloadedSubmissions={preloadedSubmissions} />
    </PageLayout>
  );
}