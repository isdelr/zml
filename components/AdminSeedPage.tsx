"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { toErrorMessage } from "@/lib/errors";

export default function AdminSeedPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const seed = useMutation(api.adminSeed.seed);
  const reset = useMutation(api.adminSeed.reset);

  const [namespace, setNamespace] = useState("dev");
  const [users, setUsers] = useState(6);
  const [cleanupFirst, setCleanupFirst] = useState(true);
  const [busy, setBusy] = useState(false);

  const isAdmin = !!currentUser?.isGlobalAdmin;
  const handleSeed = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const res = await seed({ namespace, users, cleanupFirst });
      toast.success("Seeding scheduled", { description: res?.message ?? "OK" });
    } catch (error) {
      toast.error("Failed to seed", { description: toErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      await reset({ namespace });
      toast.success("Reset scheduled", { description: `Namespace ${namespace}` });
    } catch (error) {
      toast.error("Failed to reset", { description: toErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  if (currentUser === undefined) {
    return null;
  }
  if (!currentUser) {
    return <div className="p-6">Please sign in as an admin.</div>;
  }
  if (!isAdmin) {
    return <div className="p-6">Access denied. Admins only.</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Test Data Seeder</CardTitle>
          <CardDescription>Quickly create sample leagues/rounds/submissions for testing. Data is namespaced and easily reset.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="ns">Namespace</Label>
              <Input id="ns" value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="dev" />
            </div>
            <div>
              <Label htmlFor="users">Fake Users</Label>
              <Input id="users" type="number" min={2} max={20} value={users} onChange={(e) => setUsers(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2">
              <input id="cleanupFirst" type="checkbox" className="size-4" checked={cleanupFirst} onChange={(e) => setCleanupFirst(e.target.checked)} />
              <Label htmlFor="cleanupFirst">Cleanup first</Label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSeed} disabled={busy}>
              {busy ? "Working..." : "Seed Sample Data"}
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={busy}>
              {busy ? "Working..." : "Reset Namespace"}
            </Button>
          </div>

          <div className="pt-4 text-sm text-muted-foreground">
            This will create three leagues: submissions open, voting active (with seeded submissions and partial listen progress for you), and finished (with seeded votes and results). Your admin user is included as a member.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
