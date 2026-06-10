-- Migration : correction des warnings Supabase advisor `auth_rls_initplan`
-- Contexte : dans les policies RLS, un appel nu à auth.uid() / auth.jwt() est
-- ré-évalué pour CHAQUE ligne scannée. L'encapsuler dans une sous-requête
-- scalaire `(select auth.uid())` permet à Postgres de le traiter comme un
-- InitPlan évalué UNE seule fois par requête.
-- Réécriture purement mécanique : chaque occurrence non déjà encapsulée de
-- auth.uid() / auth.jwt() est remplacée par (select auth.uid()) /
-- (select auth.jwt()). AUCUN changement sémantique.
-- ALTER POLICY est utilisé (jamais DROP/CREATE) : cmd, roles et nom sont
-- préservés ; seuls USING / WITH CHECK sont réécrits, et uniquement si la
-- clause existait déjà (les policies INSERT n'ont pas de USING).
-- Périmètre : 183 policies du schéma public référençant auth.uid()/auth.jwt(),
-- dont 156 réécrites ici et 27 déjà encapsulées (ignorées).

-- ============================================================
-- Tables a-f
-- ============================================================

ALTER POLICY "analyses_devis_own" ON public.analyses_devis USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY "artisan_absences_owner_delete" ON public.artisan_absences USING ((EXISTS ( SELECT 1
   FROM profiles_artisan p
  WHERE ((p.id = artisan_absences.artisan_id) AND (p.user_id = (select auth.uid()))))));

ALTER POLICY "artisan_absences_owner_insert" ON public.artisan_absences WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles_artisan p
  WHERE ((p.id = artisan_absences.artisan_id) AND (p.user_id = (select auth.uid()))))));

ALTER POLICY "artisan_absences_owner_select" ON public.artisan_absences USING ((EXISTS ( SELECT 1
   FROM profiles_artisan p
  WHERE ((p.id = artisan_absences.artisan_id) AND (p.user_id = (select auth.uid()))))));

ALTER POLICY "artisan_absences_owner_update" ON public.artisan_absences USING ((EXISTS ( SELECT 1
   FROM profiles_artisan p
  WHERE ((p.id = artisan_absences.artisan_id) AND (p.user_id = (select auth.uid()))))));

ALTER POLICY "artisan_own_notifs" ON public.artisan_notifications USING ((artisan_id = (select auth.uid())));

ALTER POLICY "artisan_photos_owner_delete" ON public.artisan_photos USING ((EXISTS ( SELECT 1
   FROM profiles_artisan p
  WHERE ((p.id = artisan_photos.artisan_id) AND (p.user_id = (select auth.uid()))))));

ALTER POLICY "artisan_photos_owner_insert" ON public.artisan_photos WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles_artisan p
  WHERE ((p.id = artisan_photos.artisan_id) AND (p.user_id = (select auth.uid()))))));

ALTER POLICY "artisan_photos_owner_update" ON public.artisan_photos USING ((EXISTS ( SELECT 1
   FROM profiles_artisan p
  WHERE ((p.id = artisan_photos.artisan_id) AND (p.user_id = (select auth.uid()))))));

ALTER POLICY "audit_logs_super_admin_read" ON public.audit_logs USING ((EXISTS ( SELECT 1
   FROM auth.users u
  WHERE ((u.id = (select auth.uid())) AND ((u.raw_app_meta_data ->> 'role'::text) = 'super_admin'::text)))));

ALTER POLICY "artisan_own_availability" ON public.availability USING ((artisan_id = (select auth.uid())));

ALTER POLICY "booking_messages_owner_insert" ON public.booking_messages WITH CHECK ((EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = booking_messages.booking_id) AND (b.deleted_at IS NULL) AND ((b.client_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM profiles_artisan pa
          WHERE ((pa.id = b.artisan_id) AND (pa.user_id = (select auth.uid()))))))))));

ALTER POLICY "booking_messages_owner_update" ON public.booking_messages USING ((EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = booking_messages.booking_id) AND (b.deleted_at IS NULL) AND ((b.client_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM profiles_artisan pa
          WHERE ((pa.id = b.artisan_id) AND (pa.user_id = (select auth.uid()))))))))));

ALTER POLICY "booking_messages_select" ON public.booking_messages USING (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = booking_messages.booking_id) AND (b.deleted_at IS NULL) AND ((b.client_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM profiles_artisan pa
          WHERE ((pa.id = b.artisan_id) AND (pa.user_id = (select auth.uid())))))))))));

ALTER POLICY "reviews_client_insert" ON public.booking_reviews WITH CHECK ((client_id = (select auth.uid())));

ALTER POLICY "chantiers_owner_all" ON public.chantiers_btp USING (((select auth.uid()) = owner_id)) WITH CHECK (((select auth.uid()) = owner_id));

ALTER POLICY "charges_fixes_owner" ON public.charges_fixes USING ((owner_id = (select auth.uid())));

ALTER POLICY "favorites_own" ON public.client_favorites USING ((client_id = (select auth.uid())));

ALTER POLICY "messages_insert" ON public.conversation_messages WITH CHECK ((sender_id = (select auth.uid())));

ALTER POLICY "messages_select" ON public.conversation_messages USING (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = conversation_messages.conversation_id) AND (c.deleted_at IS NULL) AND ((c.artisan_id = (select auth.uid())) OR (c.contact_id = (select auth.uid()))))))));

ALTER POLICY "messages_update" ON public.conversation_messages USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = conversation_messages.conversation_id) AND ((c.artisan_id = (select auth.uid())) OR (c.contact_id = (select auth.uid())))))));

ALTER POLICY "conversations_insert" ON public.conversations WITH CHECK (((artisan_id = (select auth.uid())) OR (contact_id = (select auth.uid()))));

ALTER POLICY "conversations_select" ON public.conversations USING (((deleted_at IS NULL) AND ((artisan_id = (select auth.uid())) OR (contact_id = (select auth.uid())))));

ALTER POLICY "conversations_update" ON public.conversations USING (((artisan_id = (select auth.uid())) OR (contact_id = (select auth.uid()))));

ALTER POLICY "client_own_conversations" ON public.conversations_simulateur USING ((client_id = (select auth.uid()))) WITH CHECK ((client_id = (select auth.uid())));

ALTER POLICY "artisan_read_own_credits" ON public.credits_log USING ((artisan_id IN ( SELECT profiles_artisan.id
   FROM profiles_artisan
  WHERE (profiles_artisan.user_id = (select auth.uid())))));

ALTER POLICY "dc4_btp_owner" ON public.dc4_btp USING (((select auth.uid()) = owner_id));

ALTER POLICY "dce_analyses_btp_owner" ON public.dce_analyses_btp USING (((select auth.uid()) = owner_id));

ALTER POLICY "artisans_own_declarations" ON public.declarations_sociales USING ((artisan_id IN ( SELECT profiles_artisan.id
   FROM profiles_artisan
  WHERE (profiles_artisan.user_id = (select auth.uid())))));

ALTER POLICY "depenses_owner_all" ON public.depenses_btp USING (((select auth.uid()) = owner_id)) WITH CHECK (((select auth.uid()) = owner_id));

ALTER POLICY "devis_owner_insert" ON public.devis WITH CHECK ((artisan_user_id = (select auth.uid())));

ALTER POLICY "devis_owner_select" ON public.devis USING ((artisan_user_id = (select auth.uid())));

ALTER POLICY "devis_owner_update" ON public.devis USING ((artisan_user_id = (select auth.uid()))) WITH CHECK ((artisan_user_id = (select auth.uid())));

ALTER POLICY "doc_sequences_owner_access" ON public.doc_sequences USING ((artisan_user_id = (select auth.uid()))) WITH CHECK ((artisan_user_id = (select auth.uid())));

ALTER POLICY "documents_audit_log_owner_read" ON public.documents_audit_log USING ((user_id = (select auth.uid())));

ALTER POLICY "documents_audit_log_super_admin" ON public.documents_audit_log USING ((EXISTS ( SELECT 1
   FROM auth.users u
  WHERE ((u.id = (select auth.uid())) AND ((u.raw_app_meta_data ->> 'role'::text) = 'super_admin'::text)))));

ALTER POLICY "dpgf_btp_owner" ON public.dpgf_btp USING (((select auth.uid()) = owner_id));

ALTER POLICY "equipe_membres_owner" ON public.equipe_membres_btp USING ((EXISTS ( SELECT 1
   FROM equipes_btp
  WHERE ((equipes_btp.id = equipe_membres_btp.equipe_id) AND (equipes_btp.owner_id = (select auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM equipes_btp
  WHERE ((equipes_btp.id = equipe_membres_btp.equipe_id) AND (equipes_btp.owner_id = (select auth.uid()))))));

ALTER POLICY "equipes_owner_all" ON public.equipes_btp USING (((select auth.uid()) = owner_id)) WITH CHECK (((select auth.uid()) = owner_id));

ALTER POLICY "factures_owner_insert" ON public.factures WITH CHECK ((artisan_user_id = (select auth.uid())));

ALTER POLICY "factures_owner_select" ON public.factures USING ((artisan_user_id = (select auth.uid())));

ALTER POLICY "factures_owner_update" ON public.factures USING ((artisan_user_id = (select auth.uid()))) WITH CHECK ((artisan_user_id = (select auth.uid())));

-- ============================================================
-- Tables m-s
-- ============================================================

ALTER POLICY "marches_insert" ON public.marches WITH CHECK ((publisher_user_id = (select auth.uid())));

ALTER POLICY "marches_publisher_read" ON public.marches USING ((publisher_user_id = (select auth.uid())));

ALTER POLICY "marches_publisher_update" ON public.marches USING ((publisher_user_id = (select auth.uid())));

ALTER POLICY "candidatures_artisan_insert" ON public.marches_candidatures WITH CHECK ((artisan_user_id = (select auth.uid())));

ALTER POLICY "candidatures_artisan_read" ON public.marches_candidatures USING ((artisan_user_id = (select auth.uid())));

ALTER POLICY "candidatures_artisan_update" ON public.marches_candidatures USING ((artisan_user_id = (select auth.uid())));

ALTER POLICY "candidatures_publisher_read" ON public.marches_candidatures USING ((marche_id IN ( SELECT marches.id
   FROM marches
  WHERE (marches.publisher_user_id = (select auth.uid())))));

ALTER POLICY "evaluations_insert" ON public.marches_evaluations WITH CHECK (((EXISTS ( SELECT 1
   FROM marches marche_row
  WHERE ((marche_row.id = marches_evaluations.marche_id) AND (marche_row.publisher_user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM marches_candidatures candidature_row
  WHERE ((candidature_row.id = marches_evaluations.candidature_id) AND (candidature_row.artisan_user_id = (select auth.uid())))))));

ALTER POLICY "marketplace_demandes_buyer_read" ON public.marketplace_demandes USING ((((select auth.uid()) = buyer_user_id) OR ((select auth.uid()) IN ( SELECT marketplace_listings.user_id
   FROM marketplace_listings
  WHERE (marketplace_listings.id = marketplace_demandes.listing_id)))));

ALTER POLICY "marketplace_demandes_insert" ON public.marketplace_demandes WITH CHECK (((select auth.uid()) = buyer_user_id));

ALTER POLICY "marketplace_demandes_update" ON public.marketplace_demandes USING ((((select auth.uid()) = buyer_user_id) OR ((select auth.uid()) IN ( SELECT marketplace_listings.user_id
   FROM marketplace_listings
  WHERE (marketplace_listings.id = marketplace_demandes.listing_id)))));

ALTER POLICY "marketplace_listings_delete" ON public.marketplace_listings USING (((select auth.uid()) = user_id));

ALTER POLICY "marketplace_listings_insert" ON public.marketplace_listings WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "marketplace_listings_update" ON public.marketplace_listings USING (((select auth.uid()) = user_id));

ALTER POLICY "membres_owner_all" ON public.membres_btp USING (((select auth.uid()) = owner_id)) WITH CHECK (((select auth.uid()) = owner_id));

ALTER POLICY "pointages_owner_all" ON public.pointages_btp USING (((select auth.uid()) = owner_id)) WITH CHECK (((select auth.uid()) = owner_id));

ALTER POLICY "pro_perms_delete" ON public.pro_role_permissions USING ((company_id = (select auth.uid())));

ALTER POLICY "pro_perms_insert" ON public.pro_role_permissions WITH CHECK ((company_id = (select auth.uid())));

ALTER POLICY "pro_perms_select" ON public.pro_role_permissions USING (((company_id = (select auth.uid())) OR (member_id IN ( SELECT pro_team_members.id
   FROM pro_team_members
  WHERE (pro_team_members.user_id = (select auth.uid()))))));

ALTER POLICY "pro_perms_update" ON public.pro_role_permissions USING ((company_id = (select auth.uid())));

ALTER POLICY "pro_audit_insert" ON public.pro_team_audit_log WITH CHECK (((company_id = (select auth.uid())) OR (actor_id = (select auth.uid()))));

ALTER POLICY "pro_audit_select" ON public.pro_team_audit_log USING ((company_id = (select auth.uid())));

ALTER POLICY "pro_team_delete" ON public.pro_team_members USING ((company_id = (select auth.uid())));

ALTER POLICY "pro_team_insert" ON public.pro_team_members WITH CHECK ((company_id = (select auth.uid())));

ALTER POLICY "pro_team_select" ON public.pro_team_members USING (((company_id = (select auth.uid())) OR (user_id = (select auth.uid()))));

ALTER POLICY "pro_team_update" ON public.pro_team_members USING ((company_id = (select auth.uid())));

ALTER POLICY "profile_specialties_own_delete" ON public.profile_specialties USING (((select auth.uid()) = user_id));

ALTER POLICY "profile_specialties_own_insert" ON public.profile_specialties WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "rapports_btp_owner" ON public.rapports_btp USING ((owner_id = (select auth.uid())));

ALTER POLICY "ref_taux_admin_delete" ON public.ref_taux USING (((select auth.uid()) IN ( SELECT users.id
   FROM auth.users
  WHERE ((users.raw_user_meta_data ->> 'role'::text) = 'admin'::text))));

ALTER POLICY "ref_taux_admin_update" ON public.ref_taux USING (((select auth.uid()) IN ( SELECT users.id
   FROM auth.users
  WHERE ((users.raw_user_meta_data ->> 'role'::text) = 'admin'::text))));

ALTER POLICY "ref_taux_admin_write" ON public.ref_taux WITH CHECK (((select auth.uid()) IN ( SELECT users.id
   FROM auth.users
  WHERE ((users.raw_user_meta_data ->> 'role'::text) = 'admin'::text))));

ALTER POLICY "ref_taux_audit_admin" ON public.ref_taux_audit USING (((select auth.uid()) IN ( SELECT users.id
   FROM auth.users
  WHERE ((users.raw_user_meta_data ->> 'role'::text) = 'admin'::text))));

ALTER POLICY "artisan_read_own_referrals" ON public.referrals USING (((parrain_id IN ( SELECT profiles_artisan.id
   FROM profiles_artisan
  WHERE (profiles_artisan.user_id = (select auth.uid())))) OR (filleul_id IN ( SELECT profiles_artisan.id
   FROM profiles_artisan
  WHERE (profiles_artisan.user_id = (select auth.uid()))))));

ALTER POLICY "retenues_btp_owner" ON public.retenues_btp USING (((select auth.uid()) = owner_id));

ALTER POLICY "artisan_own_service_etapes" ON public.service_etapes USING ((service_id IN ( SELECT s.id
   FROM (services s
     JOIN profiles_artisan pa ON ((pa.id = s.artisan_id)))
  WHERE (pa.user_id = (select auth.uid()))))) WITH CHECK ((service_id IN ( SELECT s.id
   FROM (services s
     JOIN profiles_artisan pa ON ((pa.id = s.artisan_id)))
  WHERE (pa.user_id = (select auth.uid())))));

ALTER POLICY "settings_owner_all" ON public.settings_btp USING (((select auth.uid()) = owner_id)) WITH CHECK (((select auth.uid()) = owner_id));

ALTER POLICY "situations_btp_owner" ON public.situations_btp USING (((select auth.uid()) = owner_id));

ALTER POLICY "users_read_own_subscription" ON public.subscriptions USING (((select auth.uid()) = user_id));

-- ============================================================
-- Tables syndic_a - syndic_e
-- ============================================================

ALTER POLICY "presences_owner_all" ON public.syndic_ag_presences USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "presences_team_select" ON public.syndic_ag_presences USING ((EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_ag_presences.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))));

ALTER POLICY "presences_team_update" ON public.syndic_ag_presences USING ((EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_ag_presences.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))));

ALTER POLICY "syndic_own_audit" ON public.syndic_ai_audit USING ((syndic_id = (select auth.uid())));

ALTER POLICY "syndic_own_conversations" ON public.syndic_ai_conversations USING ((syndic_id = (select auth.uid())));

ALTER POLICY "syndic_own_messages" ON public.syndic_ai_messages USING ((conversation_id IN ( SELECT syndic_ai_conversations.id
   FROM syndic_ai_conversations
  WHERE (syndic_ai_conversations.syndic_id = (select auth.uid())))));

ALTER POLICY "syndic_alertes_insert" ON public.syndic_alertes WITH CHECK (((cabinet_id = (select auth.uid())) OR (cabinet_id IN ( SELECT syndic_team_members.cabinet_id
   FROM syndic_team_members
  WHERE ((syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_alertes_select" ON public.syndic_alertes USING (((cabinet_id = (select auth.uid())) OR (cabinet_id IN ( SELECT syndic_team_members.cabinet_id
   FROM syndic_team_members
  WHERE ((syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_alertes_update" ON public.syndic_alertes USING (((cabinet_id = (select auth.uid())) OR (cabinet_id IN ( SELECT syndic_team_members.cabinet_id
   FROM syndic_team_members
  WHERE ((syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_own_alfredo_learning" ON public.syndic_alfredo_learning USING ((syndic_id = (select auth.uid())));

ALTER POLICY "syndic_appels_charges_all" ON public.syndic_appels_charges USING (((cabinet_id = (select auth.uid())) OR (cabinet_id IN ( SELECT syndic_team_members.cabinet_id
   FROM syndic_team_members
  WHERE ((syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "assemblees_owner_all" ON public.syndic_assemblees USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "assemblees_team_select" ON public.syndic_assemblees USING ((EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_assemblees.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))));

ALTER POLICY "assemblees_team_update" ON public.syndic_assemblees USING ((EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_assemblees.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))));

ALTER POLICY "syndic_automation_runs_select" ON public.syndic_automation_runs USING (((cabinet_id = (select auth.uid())) OR (cabinet_id IN ( SELECT syndic_team_members.cabinet_id
   FROM syndic_team_members
  WHERE ((syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_automations_all" ON public.syndic_automations USING (((cabinet_id = (select auth.uid())) OR (cabinet_id IN ( SELECT syndic_team_members.cabinet_id
   FROM syndic_team_members
  WHERE ((syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_avisos_cabinet_full_access" ON public.syndic_avisos USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_cabinets_owner_all" ON public.syndic_cabinets USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "syndic_caderneta_cabinet_full_access" ON public.syndic_caderneta USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_campanhas_owner" ON public.syndic_campanhas USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_cert_energ_cabinet_full_access" ON public.syndic_cert_energ USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_checklists_owner" ON public.syndic_checklists USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_contab_chamadas_cabinet_full_access" ON public.syndic_contab_chamadas USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_contab_diario_cabinet_full_access" ON public.syndic_contab_diario USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_contab_fracoes_cabinet_full_access" ON public.syndic_contab_fracoes USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_contab_orcamentos_cabinet_full_access" ON public.syndic_contab_orcamentos USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_contrats_cabinet_full_access" ON public.syndic_contrats USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "coproprios_owner_all" ON public.syndic_coproprios USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "coproprios_self_read" ON public.syndic_coproprios USING (((email_proprietaire = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = (select auth.uid()))))::text) OR (email_locataire = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = (select auth.uid()))))::text)));

ALTER POLICY "coproprios_team_select" ON public.syndic_coproprios USING ((EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_coproprios.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))));

ALTER POLICY "coproprios_team_update" ON public.syndic_coproprios USING ((EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_coproprios.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))));

ALTER POLICY "syndic_dashboard_prefs_owner" ON public.syndic_dashboard_prefs USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_decl_encargos_cabinet_full_access" ON public.syndic_decl_encargos USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_deliberacoes_owner" ON public.syndic_deliberacoes USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_elevadores_cabinet_full_access" ON public.syndic_elevadores USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_own_emails" ON public.syndic_emails_analysed USING ((syndic_id = (select auth.uid())));

ALTER POLICY "syndic_enquetes_owner" ON public.syndic_enquetes USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

-- ============================================================
-- Tables syndic_f - user_storage
-- ============================================================

ALTER POLICY "syndic_factures_copro_all" ON public.syndic_factures_copro USING (((cabinet_id = (select auth.uid())) OR (cabinet_id IN ( SELECT syndic_team_members.cabinet_id
   FROM syndic_team_members
  WHERE ((syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_fcr_edificios_cabinet_full_access" ON public.syndic_fcr_edificios USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_fcr_movimentos_cabinet_full_access" ON public.syndic_fcr_movimentos USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_impayes_all" ON public.syndic_impayes USING (((cabinet_id = (select auth.uid())) OR (cabinet_id IN ( SELECT syndic_team_members.cabinet_id
   FROM syndic_team_members
  WHERE ((syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_infracoes_owner" ON public.syndic_infracoes USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_missions_access" ON public.syndic_missions USING (((deleted_at IS NULL) AND ((cabinet_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_missions.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))))));

ALTER POLICY "syndic_missions_insert" ON public.syndic_missions WITH CHECK (((cabinet_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_missions.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_missions_update" ON public.syndic_missions USING (((deleted_at IS NULL) AND ((cabinet_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_missions.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))))));

ALTER POLICY "syndic_own_notifs" ON public.syndic_notifications USING ((syndic_id = (select auth.uid())));

ALTER POLICY "syndic_nps_owner" ON public.syndic_nps USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_own_tokens" ON public.syndic_oauth_tokens USING ((syndic_id = (select auth.uid())));

ALTER POLICY "syndic_obras_owner" ON public.syndic_obras USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_obrigacoes_owner" ON public.syndic_obrigacoes USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_orcamentos_owner" ON public.syndic_orcamentos USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_own_events" ON public.syndic_planning_events USING ((cree_par = ((select auth.uid()))::text));

ALTER POLICY "syndic_planos_man_owner" ON public.syndic_planos_man USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_prazos_legais_cabinet_full_access" ON public.syndic_prazos_legais USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_processos_jud_owner" ON public.syndic_processos_jud USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_procuracoes_cabinet_full_access" ON public.syndic_procuracoes USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_recouvrement_all" ON public.syndic_recouvrement USING (((cabinet_id = (select auth.uid())) OR (cabinet_id IN ( SELECT syndic_team_members.cabinet_id
   FROM syndic_team_members
  WHERE ((syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_reembolsos_cabinet_full_access" ON public.syndic_reembolsos USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_reservas_owner" ON public.syndic_reservas USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "resolutions_owner_all" ON public.syndic_resolutions USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "resolutions_team_select" ON public.syndic_resolutions USING ((EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_resolutions.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))));

ALTER POLICY "resolutions_team_update" ON public.syndic_resolutions USING ((EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_resolutions.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))));

ALTER POLICY "syndic_seg_edificio_cabinet_full_access" ON public.syndic_seg_edificio USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_seguros_cabinet_full_access" ON public.syndic_seguros USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_signalement_messages_insert" ON public.syndic_signalement_messages WITH CHECK ((EXISTS ( SELECT 1
   FROM syndic_signalements s
  WHERE ((s.id = syndic_signalement_messages.signalement_id) AND ((s.cabinet_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM syndic_team_members
          WHERE ((syndic_team_members.cabinet_id = s.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))))))));

ALTER POLICY "syndic_signalement_messages_select" ON public.syndic_signalement_messages USING (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM syndic_signalements s
  WHERE ((s.id = syndic_signalement_messages.signalement_id) AND (s.deleted_at IS NULL) AND ((s.cabinet_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM syndic_team_members
          WHERE ((syndic_team_members.cabinet_id = s.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))))))));

ALTER POLICY "syndic_signalements_delete" ON public.syndic_signalements USING ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_signalements_read" ON public.syndic_signalements USING (((deleted_at IS NULL) AND ((cabinet_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_signalements.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))))));

ALTER POLICY "syndic_signalements_update" ON public.syndic_signalements USING (((cabinet_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_signalements.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true))))));

ALTER POLICY "syndic_sinistros_cabinet_full_access" ON public.syndic_sinistros USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_vistorias_cabinet_full_access" ON public.syndic_vistorias USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "syndic_votacoes_owner" ON public.syndic_votacoes USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "votes_corr_owner_all" ON public.syndic_votes_correspondance USING ((cabinet_id = (select auth.uid()))) WITH CHECK ((cabinet_id = (select auth.uid())));

ALTER POLICY "votes_corr_team_select" ON public.syndic_votes_correspondance USING ((EXISTS ( SELECT 1
   FROM syndic_team_members
  WHERE ((syndic_team_members.cabinet_id = syndic_votes_correspondance.cabinet_id) AND (syndic_team_members.user_id = (select auth.uid())) AND (syndic_team_members.is_active = true)))));

ALTER POLICY "user_storage_owner" ON public.user_storage USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
