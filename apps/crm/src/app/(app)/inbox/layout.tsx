import type { ReactNode } from "react";

import { InboxRealtime } from "./realtime";

import "./inbox.css";

/** La bandeja mantiene el canal de tiempo real abierto mientras se navega dentro de ella. */
export default function InboxLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <InboxRealtime />
      {children}
    </>
  );
}
