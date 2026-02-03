-- מיגרציה: שמירת ניתוח AI לתחזית מוצרים (עדכון יומי אוטומטי)
CREATE TABLE IF NOT EXISTS forecast_analysis (
    id                  SERIAL PRIMARY KEY,
    product_id          INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    forecast_days       INT NOT NULL CHECK (forecast_days IN (30, 60, 90)),
    risk                VARCHAR(50),
    trend               VARCHAR(50),
    explanation         TEXT,
    recommendation      TEXT,
    analyzed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, forecast_days)
);

CREATE INDEX IF NOT EXISTS idx_forecast_analysis_product_days ON forecast_analysis(product_id, forecast_days);
CREATE INDEX IF NOT EXISTS idx_forecast_analysis_analyzed ON forecast_analysis(analyzed_at DESC);
