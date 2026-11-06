-- Datos ficticios e idempotentes para probar el historial US50.
-- Solo inserta snapshots en reportes_rentabilidad; no crea ni altera ingresos, gastos o viajes.
-- Requiere que la tabla aprobada ya exista y que la cuenta indicada sea comisionista.
-- Ejecución manual únicamente después de revisar: psql -d comitrack -v ON_ERROR_STOP=1 -f backend/db/datos_demo_reportes_rentabilidad.sql
DO $$
DECLARE
  usuario_demo INTEGER;
BEGIN
  SELECT id INTO usuario_demo
  FROM usuarios
  WHERE email = 'matiasjofre66@hotmail.com' AND rol = 'comisionista';

  IF usuario_demo IS NULL THEN
    RAISE EXCEPTION 'No existe la cuenta comisionista matiasjofre66@hotmail.com';
  END IF;

  INSERT INTO reportes_rentabilidad (
    usuario_id, periodo_desde, periodo_hasta, generado_en,
    total_ingresos, total_gastos, resultado_economico, version_snapshot, datos_snapshot
  )
  SELECT usuario_demo, d.periodo_desde, d.periodo_hasta, d.generado_en,
         d.total_ingresos, d.total_gastos, d.resultado_economico, 1, d.snapshot
  FROM (VALUES
    (
      DATE '2026-09-01', DATE '2026-09-30', TIMESTAMPTZ '2026-09-30 20:15:00-03',
      240000.00::numeric, 262000.00::numeric, -22000.00::numeric,
      $json$
      {
        "version": 1, "demo": true, "demo_code": "us50-demo-2026-09",
        "comisionista": "Matías Jofre", "periodo": {"desde":"2026-09-01","hasta":"2026-09-30"},
        "generado_en":"2026-09-30T23:15:00.000Z",
        "total_ingresos":"240000.00", "total_gastos":"262000.00", "resultado_economico":"-22000.00", "cantidad_movimientos":6,
        "ingresos":[
          {"id":"demo-i-901","fecha":"2026-09-04","concepto":"Traslado de pasajeros","monto":"140000.00","viaje_id":"DEMO-V-901","trayecto":{"id":"DEMO-V-901","origen":"Córdoba","destino":"Villa María","fecha":"2026-09-04"}},
          {"id":"demo-i-902","fecha":"2026-09-12","concepto":"Traslado de pasajeros","monto":"60000.00","viaje_id":"DEMO-V-902","trayecto":{"id":"DEMO-V-902","origen":"Córdoba","destino":"Río Cuarto","fecha":"2026-09-12"}},
          {"id":"demo-i-903","fecha":"2026-09-22","concepto":"Servicio de encomienda","monto":"40000.00","viaje_id":null,"trayecto":null}
        ],
        "gastos":[
          {"id":"demo-g-901","fecha":"2026-09-04","concepto":"Combustible","descripcion":"Carga para el recorrido","monto":"85000.00","viaje_id":"DEMO-V-901","trayecto":{"id":"DEMO-V-901","origen":"Córdoba","destino":"Villa María","fecha":"2026-09-04"}},
          {"id":"demo-g-902","fecha":"2026-09-12","concepto":"Combustible y peajes","descripcion":"Gastos del viaje","monto":"90000.00","viaje_id":"DEMO-V-902","trayecto":{"id":"DEMO-V-902","origen":"Córdoba","destino":"Río Cuarto","fecha":"2026-09-12"}},
          {"id":"demo-g-903","fecha":"2026-09-26","concepto":"Mantenimiento","descripcion":"Servicio general del vehículo","monto":"87000.00","viaje_id":null,"trayecto":null}
        ],
        "trayectos":[
          {"id":"DEMO-V-901","origen":"Córdoba","destino":"Villa María","fecha":"2026-09-04","total_ingresos":"140000.00","total_gastos":"85000.00","resultado_economico":"55000.00","clasificacion":"rentable"},
          {"id":"DEMO-V-902","origen":"Córdoba","destino":"Río Cuarto","fecha":"2026-09-12","total_ingresos":"60000.00","total_gastos":"90000.00","resultado_economico":"-30000.00","clasificacion":"perdida"}
        ],
        "movimientos_generales": {
          "total_ingresos":"40000.00", "total_gastos":"87000.00", "resultado_economico":"-47000.00",
          "ingresos":[{"id":"demo-i-903","fecha":"2026-09-22","concepto":"Servicio de encomienda","monto":"40000.00","viaje_id":null,"trayecto":null}],
          "gastos":[{"id":"demo-g-903","fecha":"2026-09-26","concepto":"Mantenimiento","descripcion":"Servicio general del vehículo","monto":"87000.00","viaje_id":null,"trayecto":null}]
        }
      }
      $json$::jsonb
    ),
    (
      DATE '2026-10-01', DATE '2026-10-31', TIMESTAMPTZ '2026-10-31 19:30:00-03',
      425000.00::numeric, 328500.00::numeric, 96500.00::numeric,
      $json$
      {
        "version": 1, "demo": true, "demo_code": "us50-demo-2026-10",
        "comisionista": "Matías Jofre", "periodo": {"desde":"2026-10-01","hasta":"2026-10-31"},
        "generado_en":"2026-10-31T22:30:00.000Z",
        "total_ingresos":"425000.00", "total_gastos":"328500.00", "resultado_economico":"96500.00", "cantidad_movimientos":8,
        "ingresos":[
          {"id":"demo-i-1001","fecha":"2026-10-04","concepto":"Traslado de pasajeros","monto":"120000.00","viaje_id":"DEMO-V-1001","trayecto":{"id":"DEMO-V-1001","origen":"Córdoba","destino":"Villa María","fecha":"2026-10-04"}},
          {"id":"demo-i-1002","fecha":"2026-10-12","concepto":"Traslado de pasajeros","monto":"180000.00","viaje_id":"DEMO-V-1002","trayecto":{"id":"DEMO-V-1002","origen":"Córdoba","destino":"Río Cuarto","fecha":"2026-10-12"}},
          {"id":"demo-i-1003","fecha":"2026-10-21","concepto":"Traslado de pasajeros","monto":"100000.00","viaje_id":"DEMO-V-1003","trayecto":{"id":"DEMO-V-1003","origen":"Córdoba","destino":"San Francisco","fecha":"2026-10-21"}},
          {"id":"demo-i-1004","fecha":"2026-10-27","concepto":"Servicio general de encomienda","monto":"25000.00","viaje_id":null,"trayecto":null}
        ],
        "gastos":[
          {"id":"demo-g-1001","fecha":"2026-10-04","concepto":"Combustible","descripcion":"Carga antes de salir","monto":"54000.00","viaje_id":"DEMO-V-1001","trayecto":{"id":"DEMO-V-1001","origen":"Córdoba","destino":"Villa María","fecha":"2026-10-04"}},
          {"id":"demo-g-1002","fecha":"2026-10-12","concepto":"Combustible y peajes","descripcion":"Gastos del recorrido","monto":"180000.00","viaje_id":"DEMO-V-1002","trayecto":{"id":"DEMO-V-1002","origen":"Córdoba","destino":"Río Cuarto","fecha":"2026-10-12"}},
          {"id":"demo-g-1003","fecha":"2026-10-21","concepto":"Combustible y refrigerio","descripcion":"Gastos del viaje","monto":"78500.00","viaje_id":"DEMO-V-1003","trayecto":{"id":"DEMO-V-1003","origen":"Córdoba","destino":"San Francisco","fecha":"2026-10-21"}},
          {"id":"demo-g-1004","fecha":"2026-10-29","concepto":"Mantenimiento","descripcion":"Cambio de aceite y filtros","monto":"16000.00","viaje_id":null,"trayecto":null}
        ],
        "trayectos":[
          {"id":"DEMO-V-1001","origen":"Córdoba","destino":"Villa María","fecha":"2026-10-04","total_ingresos":"120000.00","total_gastos":"54000.00","resultado_economico":"66000.00","clasificacion":"rentable"},
          {"id":"DEMO-V-1002","origen":"Córdoba","destino":"Río Cuarto","fecha":"2026-10-12","total_ingresos":"180000.00","total_gastos":"180000.00","resultado_economico":"0.00","clasificacion":"equilibrado"},
          {"id":"DEMO-V-1003","origen":"Córdoba","destino":"San Francisco","fecha":"2026-10-21","total_ingresos":"100000.00","total_gastos":"78500.00","resultado_economico":"21500.00","clasificacion":"rentable"}
        ],
        "movimientos_generales": {
          "total_ingresos":"25000.00", "total_gastos":"16000.00", "resultado_economico":"9000.00",
          "ingresos":[{"id":"demo-i-1004","fecha":"2026-10-27","concepto":"Servicio general de encomienda","monto":"25000.00","viaje_id":null,"trayecto":null}],
          "gastos":[{"id":"demo-g-1004","fecha":"2026-10-29","concepto":"Mantenimiento","descripcion":"Cambio de aceite y filtros","monto":"16000.00","viaje_id":null,"trayecto":null}]
        }
      }
      $json$::jsonb
    ),
    (
      DATE '2026-11-01', DATE '2026-11-05', TIMESTAMPTZ '2026-11-05 20:00:00-03',
      80000.00::numeric, 80000.00::numeric, 0.00::numeric,
      $json$
      {
        "version": 1, "demo": true, "demo_code": "us50-demo-2026-11",
        "comisionista": "Matías Jofre", "periodo": {"desde":"2026-11-01","hasta":"2026-11-05"},
        "generado_en":"2026-11-05T23:00:00.000Z",
        "total_ingresos":"80000.00", "total_gastos":"80000.00", "resultado_economico":"0.00", "cantidad_movimientos":4,
        "ingresos":[
          {"id":"demo-i-1101","fecha":"2026-11-02","concepto":"Traslado de pasajeros","monto":"50000.00","viaje_id":"DEMO-V-1101","trayecto":{"id":"DEMO-V-1101","origen":"Córdoba","destino":"Alta Gracia","fecha":"2026-11-02"}},
          {"id":"demo-i-1102","fecha":"2026-11-04","concepto":"Encomienda","monto":"30000.00","viaje_id":null,"trayecto":null}
        ],
        "gastos":[
          {"id":"demo-g-1101","fecha":"2026-11-02","concepto":"Combustible","descripcion":"Recorrido a Alta Gracia","monto":"35000.00","viaje_id":"DEMO-V-1101","trayecto":{"id":"DEMO-V-1101","origen":"Córdoba","destino":"Alta Gracia","fecha":"2026-11-02"}},
          {"id":"demo-g-1102","fecha":"2026-11-05","concepto":"Seguro y mantenimiento","descripcion":"Gasto general del período","monto":"45000.00","viaje_id":null,"trayecto":null}
        ],
        "trayectos":[
          {"id":"DEMO-V-1101","origen":"Córdoba","destino":"Alta Gracia","fecha":"2026-11-02","total_ingresos":"50000.00","total_gastos":"35000.00","resultado_economico":"15000.00","clasificacion":"rentable"}
        ],
        "movimientos_generales": {
          "total_ingresos":"30000.00", "total_gastos":"45000.00", "resultado_economico":"-15000.00",
          "ingresos":[{"id":"demo-i-1102","fecha":"2026-11-04","concepto":"Encomienda","monto":"30000.00","viaje_id":null,"trayecto":null}],
          "gastos":[{"id":"demo-g-1102","fecha":"2026-11-05","concepto":"Seguro y mantenimiento","descripcion":"Gasto general del período","monto":"45000.00","viaje_id":null,"trayecto":null}]
        }
      }
      $json$::jsonb
    )
  ) AS d(periodo_desde, periodo_hasta, generado_en, total_ingresos, total_gastos, resultado_economico, snapshot)
  WHERE NOT EXISTS (
    SELECT 1 FROM reportes_rentabilidad existente
    WHERE existente.usuario_id = usuario_demo
      AND existente.datos_snapshot->>'demo_code' = d.snapshot->>'demo_code'
  );
END $$;
