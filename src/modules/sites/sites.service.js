import * as sitesModel from './sites.model.js';

export const fetchRegionList = async () => {
  return await sitesModel.getAllRegions();
};

export const fetchMacroMapData = async (regionName) => {
  const region = await sitesModel.getRegionByName(regionName);
  if (!region) {
    throw new Error('REGION_NOT_FOUND');
  }

  const sites = await sitesModel.getSitesByRegionId(region.id);

  return {
    region: {
      id: region.id,
      name: region.name,
      status: region.status, // Dynamically computed: 'PENDING' if any asset needs maintenance
      center: {
        lat: parseFloat(region.center_lat),
        lng: parseFloat(region.center_lng)
      },
      boundary: region.boundary_geojson
    },
    sites: sites.map(site => ({
      id: site.id,
      code: site.site_code,
      name: site.name,
      address: site.address_location,
      lat: parseFloat(site.latitude),
      lng: parseFloat(site.longitude),
      status: site.status // Dynamically computed for each site
    }))
  };
};

export const fetchMicroMapData = async (siteId) => {
  const assets = await sitesModel.getAssetsBySiteId(siteId);

  return {
    siteId: siteId,
    assets: assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      material: asset.material,
      surface: asset.surface_type,
      lat: parseFloat(asset.latitude),
      lng: parseFloat(asset.longitude),
      status: asset.status
    }))
  };
};