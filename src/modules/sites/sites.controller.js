import * as sitesService from './sites.service.js';
import { pool } from '../../config/db.js';
import fs from 'fs';
import path from 'path';

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

export const uploadThumbnail = async (req, res) => {
  try {
    const { assetId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const localFileUrl = `/uploads/assets/thumbnails/${req.file.filename}`;

    // 1. Fetch the CURRENT asset to see if there is an old image we need to delete
    const checkQuery = `SELECT image_url FROM assets WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [assetId]);
    
    const oldImageUrl = checkResult.rows[0]?.image_url;

    // 2. Update the database with the NEW image URL
    const updateQuery = `
      UPDATE assets 
      SET image_url = $1 
      WHERE id = $2 
      RETURNING id, name_identifier, image_url;
    `;
    const { rows } = await pool.query(updateQuery, [localFileUrl, assetId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // 3. The Garbage Collector: Delete the OLD image from the hard drive
    if (oldImageUrl) {
      // Convert the URL (e.g., /uploads/...) into a real folder path on your computer
      const oldFilePath = path.join(process.cwd(), oldImageUrl);
      
      fs.unlink(oldFilePath, (err) => {
        if (err) {
          // We just log the error, we don't crash the API if the old file is missing
          console.error(`Could not delete old image at ${oldFilePath}:`, err.message);
        } else {
          console.log(`Successfully deleted orphaned image: ${oldImageUrl}`);
        }
      });
    }

    res.status(200).json({
      message: 'Thumbnail uploaded successfully!',
      asset: rows[0]
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};