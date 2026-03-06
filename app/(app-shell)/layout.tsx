import { PageLayout } from "@/components/layout/PageLayout";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageLayout>{children}</PageLayout>;
}
