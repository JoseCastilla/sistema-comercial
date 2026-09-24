import type { ReactNode } from "react";

import { ShellLayout } from "@/components/layout/shell-layout";

export default function AuthenticatedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <ShellLayout>{children}</ShellLayout>;
}
