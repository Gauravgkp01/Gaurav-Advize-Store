import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  testId?: string;
}

export function StatCard({ title, value, icon, description, testId }: StatCardProps) {
  return (
    <Card className="rounded-2xl border-none shadow-sm bg-card hover:shadow-md transition-shadow" data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground tracking-wide">{title}</p>
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
