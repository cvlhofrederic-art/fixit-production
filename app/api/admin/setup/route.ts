import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'public' } }
)

// GET /api/admin/setup?step=tables|admin|all
// ⚠️ SÉCURISÉ : nécessite authentification super_admin + vérification email
export async function GET(request: NextRequest) {
  // ── Rate limit strict pour endpoint admin ──────────────────────────────
  const ip = getClientIP(request)
  if (!checkRateLimit(`admin_setup_${ip}`, 5, 60_000)) return rateLimitResponse()

  // ── Vérification authentification ────────────────────────────────────────
  const user = await getAuthUser(request as any)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  // ── Vérification admin via email (non forgeable, contrairement à user_metadata) ──
  const ADMIN_EMAILS = [process.env.ADMIN_EMAIL].filter(Boolean) as string[]
  if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
  }

  const url = new URL(request.url)
  const step = url.searchParams.get('step') || 'all'
  const results: Record<string, any> = {}

  // ── ÉTAPE 1 : Créer les tables ──────────────────────────────────────────────
  if (step === 'tables' || step === 'all') {
    const tablesSql = `
      -- ── IMMEUBLES ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS syndic_immeubles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cabinet_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        nom TEXT NOT NULL,
        adresse TEXT NOT NULL DEFAULT '',
        ville TEXT NOT NULL DEFAULT '',
        code_postal TEXT NOT NULL DEFAULT '',
        nb_lots INTEGER DEFAULT 1,
        annee_construction INTEGER DEFAULT 2000,
        type_immeuble TEXT DEFAULT 'Copropriété',
        gestionnaire TEXT DEFAULT '',
        prochain_controle DATE,
        nb_interventions INTEGER DEFAULT 0,
        budget_annuel NUMERIC DEFAULT 0,
        depenses_annee NUMERIC DEFAULT 0,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        geoloc_activee BOOLEAN DEFAULT false,
        rayon_detection INTEGER DEFAULT 150,
        reglement_texte TEXT,
        reglement_pdf_nom TEXT,
        reglement_date_maj DATE,
        reglement_charges_repartition TEXT,
        reglement_majorite_ag TEXT,
        reglement_fonds_travaux BOOLEAN DEFAULT false,
        reglement_fonds_roulement_pct NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- ── SIGNALEMENTS ─────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS syndic_signalements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cabinet_id UUID,
        immeuble_nom TEXT,
        demandeur_nom TEXT NOT NULL DEFAULT '',
        demandeur_role TEXT CHECK (demandeur_role IN ('coproprio','locataire','technicien')),
        demandeur_email TEXT,
        demandeur_telephone TEXT,
        type_intervention TEXT NOT NULL DEFAULT 'Autre',
        description TEXT,
        priorite TEXT DEFAULT 'normale' CHECK (priorite IN ('urgente','normale','planifiee')),
        statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','acceptee','en_cours','terminee','annulee')),
        batiment TEXT,
        etage TEXT,
        num_lot TEXT,
        est_partie_commune BOOLEAN DEFAULT false,
        zone_signalee TEXT,
        artisan_assigne TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- ── MESSAGES SIGNALEMENT ─────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS syndic_signalement_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        signalement_id UUID REFERENCES syndic_signalements(id) ON DELETE CASCADE,
        auteur TEXT NOT NULL,
        role TEXT NOT NULL,
        texte TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- ── MISSIONS ─────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS syndic_missions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cabinet_id UUID,
        signalement_id UUID REFERENCES syndic_signalements(id),
        immeuble TEXT,
        artisan TEXT,
        type TEXT,
        description TEXT,
        priorite TEXT DEFAULT 'normale' CHECK (priorite IN ('urgente','normale','planifiee')),
        statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','acceptee','en_cours','terminee','annulee')),
        date_creation DATE DEFAULT CURRENT_DATE,
        date_intervention DATE,
        montant_devis NUMERIC,
        montant_facture NUMERIC,
        batiment TEXT,
        etage TEXT,
        num_lot TEXT,
        locataire TEXT,
        telephone_locataire TEXT,
        acces_logement TEXT,
        demandeur_nom TEXT,
        demandeur_role TEXT,
        demandeur_email TEXT,
        est_partie_commune BOOLEAN DEFAULT false,
        zone_signalee TEXT,
        canal_messages JSONB DEFAULT '[]'::jsonb,
        demandeur_messages JSONB DEFAULT '[]'::jsonb,
        rapport_artisan TEXT,
        travail_effectue TEXT,
        materiaux_utilises TEXT,
        problemes_constates TEXT,
        recommandations TEXT,
        date_rapport DATE,
        duree_intervention TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- Index pour les requêtes fréquentes
      CREATE INDEX IF NOT EXISTS idx_syndic_immeubles_cabinet ON syndic_immeubles(cabinet_id);
      CREATE INDEX IF NOT EXISTS idx_syndic_signalements_cabinet ON syndic_signalements(cabinet_id);
      CREATE INDEX IF NOT EXISTS idx_syndic_missions_cabinet ON syndic_missions(cabinet_id);
      CREATE INDEX IF NOT EXISTS idx_syndic_signalement_msgs ON syndic_signalement_messages(signalement_id);

      -- RLS
      ALTER TABLE syndic_immeubles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE syndic_signalements ENABLE ROW LEVEL SECURITY;
      ALTER TABLE syndic_signalement_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE syndic_missions ENABLE ROW LEVEL SECURITY;

      -- Policies syndic_immeubles
      DROP POLICY IF EXISTS "syndic_immeubles_access" ON syndic_immeubles;
      CREATE POLICY "syndic_immeubles_access" ON syndic_immeubles
        USING (cabinet_id = auth.uid() OR EXISTS (
          SELECT 1 FROM syndic_team_members WHERE cabinet_id = syndic_immeubles.cabinet_id AND user_id = auth.uid() AND is_active = true
        ));

      -- Policies syndic_signalements (sécurisées par cabinet_id)
      DROP POLICY IF EXISTS "syndic_signalements_read" ON syndic_signalements;
      CREATE POLICY "syndic_signalements_read" ON syndic_signalements FOR SELECT
        USING (cabinet_id = auth.uid() OR EXISTS (
          SELECT 1 FROM syndic_team_members WHERE cabinet_id = syndic_signalements.cabinet_id AND user_id = auth.uid() AND is_active = true
        ));
      DROP POLICY IF EXISTS "syndic_signalements_insert" ON syndic_signalements;
      CREATE POLICY "syndic_signalements_insert" ON syndic_signalements FOR INSERT
        WITH CHECK (true);
      DROP POLICY IF EXISTS "syndic_signalements_update" ON syndic_signalements;
      CREATE POLICY "syndic_signalements_update" ON syndic_signalements FOR UPDATE
        USING (cabinet_id = auth.uid() OR EXISTS (
          SELECT 1 FROM syndic_team_members WHERE cabinet_id = syndic_signalements.cabinet_id AND user_id = auth.uid() AND is_active = true
        ));

      -- Policies syndic_signalement_messages (sécurisées)
      DROP POLICY IF EXISTS "syndic_signalement_messages_all" ON syndic_signalement_messages;
      CREATE POLICY "syndic_signalement_messages_all" ON syndic_signalement_messages
        USING (EXISTS (
          SELECT 1 FROM syndic_signalements s
          WHERE s.id = syndic_signalement_messages.signalement_id
          AND (s.cabinet_id = auth.uid() OR EXISTS (
            SELECT 1 FROM syndic_team_members WHERE cabinet_id = s.cabinet_id AND user_id = auth.uid() AND is_active = true
          ))
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM syndic_signalements s
          WHERE s.id = syndic_signalement_messages.signalement_id
          AND (s.cabinet_id = auth.uid() OR EXISTS (
            SELECT 1 FROM syndic_team_members WHERE cabinet_id = s.cabinet_id AND user_id = auth.uid() AND is_active = true
          ))
        ));

      -- Policies syndic_missions
      DROP POLICY IF EXISTS "syndic_missions_access" ON syndic_missions;
      CREATE POLICY "syndic_missions_access" ON syndic_missions
        USING (cabinet_id = auth.uid() OR EXISTS (
          SELECT 1 FROM syndic_team_members WHERE cabinet_id = syndic_missions.cabinet_id AND user_id = auth.uid() AND is_active = true
        ));
      DROP POLICY IF EXISTS "syndic_missions_insert" ON syndic_missions;
      CREATE POLICY "syndic_missions_insert" ON syndic_missions FOR INSERT
        WITH CHECK (cabinet_id = auth.uid() OR EXISTS (
          SELECT 1 FROM syndic_team_members WHERE cabinet_id = syndic_missions.cabinet_id AND user_id = auth.uid() AND is_active = true
        ));
    `

    try {
      const statements = tablesSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      const tableErrors: string[] = []
      for (const stmt of statements) {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: stmt + ';' }).single()
        if (error && !error.message.includes('already exists')) {
          tableErrors.push(`${stmt.substring(0, 60)}… → ${error.message}`)
        }
      }
      results.tables = tableErrors.length === 0
        ? { success: true, message: 'Toutes les tables créées avec succès' }
        : { success: false, errors: tableErrors }
    } catch (e: any) {
      results.tables = { success: false, error: e.message }
    }
  }

  // ── ÉTAPE 2 : Créer le compte super_admin ────────────────────────────────────
  if (step === 'admin' || step === 'all') {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      results.admin = { success: false, error: 'Variables ADMIN_EMAIL et ADMIN_PASSWORD requises dans les env vars' }
    } else {
      try {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        if (listError) throw listError

        const existing = users.find(u => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())

        if (existing) {
          const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            user_metadata: {
              ...existing.user_metadata,
              role: 'super_admin',
              full_name: 'Super Admin Vitfix',
            }
          })
          results.admin = {
            success: !error,
            action: 'updated',
            user_id: existing.id,
            email: existing.email,
            role: data?.user?.user_metadata?.role,
            error: error?.message,
          }
        } else {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true,
            user_metadata: {
              role: 'super_admin',
              full_name: 'Super Admin Vitfix',
            }
          })
          results.admin = {
            success: !error,
            action: 'created',
            user_id: data?.user?.id,
            email: data?.user?.email,
            role: data?.user?.user_metadata?.role,
            error: error?.message,
          }
        }
      } catch (e: any) {
        results.admin = { success: false, error: e.message }
      }
    }
  }

  return NextResponse.json({
    ...results,
    timestamp: new Date().toISOString(),
  })
}
