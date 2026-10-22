-- 1. Site Capture Log (Directly from your SITE sheet)
CREATE TABLE site_capture_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    captured_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dataset_url VARCHAR(500)
);

-- 2. Asset Capture (Directly from your ASSET sheet + 1 column for warning ignore)
CREATE TABLE asset_captures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    image_360_url VARCHAR(500) NOT NULL,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    captured_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_latest BOOLEAN DEFAULT TRUE,
    ignore_hotspot_warning BOOLEAN DEFAULT FALSE -- Added for worker soft-warning control
);

-- 3. Capture Hotspots (NEW: Anchors the green dots inside each 360 image)
CREATE TABLE capture_hotspots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_capture_id UUID NOT NULL REFERENCES asset_captures(id) ON DELETE CASCADE,
    target_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    pitch NUMERIC(6, 2) NOT NULL, -- Vertical angle (-90.00 to 90.00)
    yaw NUMERIC(6, 2) NOT NULL,   -- Horizontal angle (-180.00 to 180.00)
    is_auto_generated BOOLEAN DEFAULT FALSE, -- Ready for our future OpenCV pipeline
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Prevent a worker from accidentally putting two dots for the same target asset on one 360 image
    UNIQUE(source_capture_id, target_asset_id)
);