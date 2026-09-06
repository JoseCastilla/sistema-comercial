-- SPEC-037 / SPEC-046: las restricciones CHECK de agosto se crearon NOT VALID
-- para proteger escrituras nuevas sin auditar el histórico. Aquí se validan.
-- Si alguna encuentra filas que la violan, se registra un aviso y sigue sin
-- validar (un despliegue no debe caerse por datos viejos): la lista de las
-- que sigan NOT VALID se consulta con
--   select conname from pg_constraint where not convalidated;
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE NOT convalidated
      AND contype = 'c'
      AND conname IN (
        'commercial_team_members_primary_requires_sales_check',
        'dito_orders_billing_cycle_day_check',
        'dito_orders_coordinates_pair_check',
        'dito_orders_fixed_charge_nonnegative_check',
        'dito_orders_latitude_range_check',
        'dito_orders_longitude_range_check',
        'dito_orders_payment_due_day_check'
      )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %s VALIDATE CONSTRAINT %I',
        item.table_name,
        item.conname
      );
      RAISE NOTICE 'Validada %', item.conname;
    EXCEPTION
      WHEN check_violation THEN
        RAISE WARNING 'Sigue sin validar % en %: hay filas que la violan; revisar antes de validar', item.conname, item.table_name;
    END;
  END LOOP;
END $$;
