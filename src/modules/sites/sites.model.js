import { pool } from '../../config/db.js';

export const getAllRegions = async () => {
  const query = `
    SELECT id, name, center_lat, center_lng 
    FROM regions 
    ORDER BY name ASC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const getRegionByName = async (regionName) => {
  const query = `
    SELECT 
      r.id, 
      r.name, 
      r.center_lat, 
      r.center_lng, 
      r.boundary_geojson,
      CASE 
        WHEN COUNT(a.id) FILTER (WHERE a.status = 'MAINTENANCE PENDING') > 0 
        THEN 'PENDING'
        ELSE 'CLEAR'
      END AS status
    FROM regions r
    LEFT JOIN sites s ON r.id = s.region_id
    LEFT JOIN assets a ON s.id = a.site_id
    WHERE LOWER(r.name) = LOWER($1)
    GROUP BY r.id;
  `;
  const { rows } = await pool.query(query, [regionName]);
  return rows[0];
};

// Get all sites in a region, dynamically calculating status based on child assets
export const getSitesByRegionId = async (regionId) => {
  const query = `
    SELECT 
      s.id,
      s.site_code,
      s.name,
      s.address_location,
      s.latitude,
      s.longitude,
      CASE 
        WHEN COUNT(a.id) FILTER (WHERE a.status = 'MAINTENANCE PENDING') > 0 
        THEN 'PENDING'
        ELSE 'CLEAR'
      END AS status
    FROM sites s
    LEFT JOIN assets a ON s.id = a.site_id
    WHERE s.region_id = $1
    GROUP BY s.id
    ORDER BY s.name ASC;
  `;
  const { rows } = await pool.query(query, [regionId]);
  return rows;
};

export const getAssetsBySiteId = async (siteId) => {
  const query = `
    SELECT 
      a.id,
      a.name_identifier AS name,
      c.name AS category,
      a.material,
      a.surface_type,
      a.latitude,
      a.longitude,
      a.status
    FROM assets a
    JOIN asset_categories c ON a.category_id = c.id
    WHERE a.site_id = $1
    ORDER BY a.name_identifier ASC;
  `;
  const { rows } = await pool.query(query, [siteId]);
  return rows;
};