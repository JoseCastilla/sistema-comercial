import { requireAccess } from "@/server/auth/access";
import { getInboxOverview, listConversations } from "@/server/inbox/queries";

import { ConversationList } from "./conversation-list";
import { readFilters } from "./filters";

export const dynamic = "force-dynamic";

/** Bandeja sin conversación abierta: la lista y, en escritorio, la invitación a elegir una. */
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAccess();
  const filters = readFilters(await searchParams);
  const [overview, list] = await Promise.all([getInboxOverview(access), listConversations(access, filters)]);

  return (
    <div className="inbox">
      <ConversationList access={access} filters={filters} list={list} overview={overview} />
      <div className="inbox__placeholder">
        <div>
          <p>Elige una conversación de la izquierda para atenderla.</p>
        </div>
      </div>
    </div>
  );
}
