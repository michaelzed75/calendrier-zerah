-- Migration: Changement pennylane_customer_id de INTEGER à TEXT (UUID)
-- Date: 2026-01-26
-- Raison: L'identifiant visible dans Pennylane est l'external_reference (UUID), pas l'id numérique

-- ============================================================================
-- 1. MODIFICATION TABLE CLIENTS
-- ============================================================================

-- Supprimer l'ancien index
DROP INDEX IF EXISTS idx_clients_pennylane_customer_id;

-- Changer le type de la colonne (les valeurs INTEGER seront converties en TEXT)
ALTER TABLE clients ALTER COLUMN pennylane_customer_id TYPE TEXT USING pennylane_customer_id::TEXT;

-- Recréer l'index
CREATE INDEX IF NOT EXISTS idx_clients_pennylane_customer_id ON clients(pennylane_customer_id);

-- Commentaire explicatif
COMMENT ON COLUMN clients.pennylane_customer_id IS 'UUID Pennylane (external_reference de l''API v2)';
