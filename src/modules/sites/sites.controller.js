import * as sitesService from './sites.service.js';

export const getRegions = async (req, res) => {
  try {
    const regions = await sitesService.fetchRegionList();
    res.status(200).json({ regions });
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMacroData = async (req, res) => {
  try {
    const { region } = req.query;

    if (!region) {
      return res.status(400).json({ error: 'Query parameter "region" is required.' });
    }

    const macroData = await sitesService.fetchMacroMapData(region);
    res.status(200).json(macroData);
  } catch (error) {
    if (error.message === 'REGION_NOT_FOUND') {
      return res.status(404).json({ error: 'Region not found' });
    }
    console.error('Error fetching macro map data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMicroData = async (req, res) => {
  try {
    const { siteId } = req.params;

    if (!siteId) {
      return res.status(400).json({ error: 'Site ID parameter is required.' });
    }

    const microData = await sitesService.fetchMicroMapData(siteId);
    res.status(200).json(microData);
  } catch (error) {
    console.error('Error fetching micro map data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};