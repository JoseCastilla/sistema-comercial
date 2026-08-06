export function EmptyState({ title, description }: { title: string; description: string }) {
  return <section className="ui-empty-state"><div><h2 className="ui-empty-state__title">{title}</h2><p className="ui-empty-state__description">{description}</p></div></section>;
}
