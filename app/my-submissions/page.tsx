import { MySubmissionsPage } from "@/components/MySubmissionsPage";
import { Sidebar } from "@/components/Sidebar";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Submissions',
  description: 'Track all the songs you have submitted across all your leagues. See your results and review your past entries.',
};

export default function MySubmissions() {
  return (
    <div className="flex h-screen ">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <MySubmissionsPage />
      </div>
    </div>
  );
}