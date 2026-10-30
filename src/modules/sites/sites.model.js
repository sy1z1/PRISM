import { pool } from '../../config/db.js';

// `organizationId` is null for SuperAdmin (cross-org) and a uuid for scoped
// actors. A scoped actor with no organization is rejected by the controller.

export const getAllRegions = async (organizationId = null) => {
  const query = `
    SELECT id, name, center_lat, center_lng, boundary_geojson
    FROM regions
    WHERE ($1::uuid IS NULL OR organization_id = $1::uuid)
    ORDER BY name ASC;
  `;
  const { rows } = await pool.query(query, [organizationId]);
  return rows;
};

export const getRegionByName = async (regionName, organizationId = null) => {
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
      AND ($2::uuid IS NULL OR r.organization_id = $2::uuid)
    GROUP BY r.id;
  `;
  const { rows } = await pool.query(query, [regionName, organizationId]);
  return rows[0];
};

// Get all sites in a region, dynamically calculating status based on child assets
export const getSitesByRegionId = async (regionId, organizationId = null) => {
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
    JOIN regions r ON s.region_id = r.id
    LEFT JOIN assets a ON s.id = a.site_id
    WHERE s.region_id = $1
      AND ($2::uuid IS NULL OR r.organization_id = $2::uuid)
    GROUP BY s.id
    ORDER BY s.name ASC;
  `;
  const { rows } = await pool.query(query, [regionId, organizationId]);
  return rows;
};

export const getAssetsBySiteId = async (siteId, organizationId = null) => {
  const query = `
    SELECT 
      a.id,
      a.name_identifier AS name,
      c.name AS category,
      a.material,
      a.surface_type,
      a.latitude,
      a.longitude,
      a.status,
      a.image_url
    FROM assets a
    JOIN asset_categories c ON a.category_id = c.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE a.site_id = $1
      AND ($2::uuid IS NULL OR r.organization_id = $2::uuid)
    ORDER BY a.name_identifier ASC;
  `;
  const { rows } = await pool.query(query, [siteId, organizationId]);
  return rows;
};
