-- Auditoría de eventos de códigos y entregas DEMO. SOLO LECTURA.
-- Ejecutar con acceso administrativo; nunca modifica datos.
-- El resultado 0 con tablas vacías NO demuestra resistencia a concurrencia.

-- 1. Eventos consumed duplicados por código ficticio.
select sample_id, count(*) as consumed_count
from mwd_remittance_demo_private.pickup_code_events
where action = 'consumed'
group by sample_id
having count(*) > 1;

-- 2. Eventos sample_completed duplicados por asignación.
select assignment_id, count(*) as completed_count
from mwd_remittance_demo_private.payout_events
where event_type = 'sample_completed'
group by assignment_id
having count(*) > 1;

-- 3. Asignaciones completadas sin evento de finalización.
select a.id, a.order_id
from mwd_remittance_demo_private.payout_assignments a
where a.status = 'sample_completed'
  and not exists (
    select 1 from mwd_remittance_demo_private.payout_events e
    where e.assignment_id = a.id and e.event_type = 'sample_completed'
  );

-- 4. Códigos consumidos sin evento consumed.
select s.id, s.assignment_id
from mwd_remittance_demo_private.pickup_code_samples s
where s.status = 'consumed'
  and not exists (
    select 1 from mwd_remittance_demo_private.pickup_code_events e
    where e.sample_id = s.id and e.action = 'consumed'
  );

-- 5. Totales para distinguir una auditoría vacía de una con datos.
select
  (select count(*) from mwd_remittance_demo_private.pickup_code_samples) as total_codes,
  (select count(*) from mwd_remittance_demo_private.pickup_code_events) as total_code_events,
  (select count(*) from mwd_remittance_demo_private.payout_assignments) as total_assignments,
  (select count(*) from mwd_remittance_demo_private.payout_events) as total_payout_events;
