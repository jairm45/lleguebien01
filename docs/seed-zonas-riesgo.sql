-- ============================================================================
-- Datos de prueba: zonas de riesgo alrededor del campus de la Universidad
-- del Pacífico y la Av. Simón Bolívar, Buenaventura.
--
-- IMPORTANTE:
--   - Polígonos aproximados de prueba. No representan zonas de riesgo reales.
--   - Coordenadas en orden [longitud, latitud], como exige GeoJSON.
--   - Inserta solo si no existe una zona con el mismo nombre.
--   - Ejecutar con un rol de escritura (postgres), no con el MCP read-only.
-- ============================================================================

insert into public.zonas_riesgo (nombre, geojson, nivel, activo)
select
  v.nombre,
  v.geojson::jsonb,
  v.nivel,
  true
from (
  values
    (
      'Campus Universidad del Pacífico',
      '{
        "type": "Feature",
        "properties": {
          "nombre": "Campus Universidad del Pacífico",
          "nivel": "medio"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-76.9950, 3.8432],
            [-76.9914, 3.8432],
            [-76.9914, 3.8458],
            [-76.9950, 3.8458],
            [-76.9950, 3.8432]
          ]]
        }
      }',
      'medio'
    ),
    (
      'Corredor Av. Simón Bolívar Norte',
      '{
        "type": "Feature",
        "properties": {
          "nombre": "Corredor Av. Simón Bolívar Norte",
          "nivel": "alto"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-76.9938, 3.8502],
            [-76.9888, 3.8502],
            [-76.9888, 3.8572],
            [-76.9938, 3.8572],
            [-76.9938, 3.8502]
          ]]
        }
      }',
      'alto'
    ),
    (
      'Corredor Av. Simón Bolívar Sur',
      '{
        "type": "Feature",
        "properties": {
          "nombre": "Corredor Av. Simón Bolívar Sur",
          "nivel": "alto"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-77.0008, 3.8338],
            [-76.9952, 3.8338],
            [-76.9952, 3.8402],
            [-77.0008, 3.8402],
            [-77.0008, 3.8338]
          ]]
        }
      }',
      'alto'
    )
) as v(nombre, geojson, nivel)
where not exists (
  select 1
  from public.zonas_riesgo z
  where z.nombre = v.nombre
);

select id, nombre, nivel, activo
from public.zonas_riesgo
order by nombre;
