CREATE OR REPLACE FUNCTION notify_dito_order_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  changed_order record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    changed_order := OLD;
  ELSE
    changed_order := NEW;
  END IF;

  PERFORM pg_notify(
    'dito_order_changes',
    json_build_object(
      'organizationId', changed_order.organization_id,
      'orderId', changed_order.id,
      'operation', TG_OP,
      'changedAt', COALESCE(changed_order.updated_at, CURRENT_TIMESTAMP)
    )::text
  );

  RETURN changed_order;
END;
$$;

DROP TRIGGER IF EXISTS dito_order_change_notify ON dito_orders;

CREATE TRIGGER dito_order_change_notify
AFTER INSERT OR UPDATE OR DELETE ON dito_orders
FOR EACH ROW
EXECUTE FUNCTION notify_dito_order_change();
