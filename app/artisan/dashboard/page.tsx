// Route miroir côté Artisan : réexporte la page du dashboard /pro/dashboard.
// Les artisans ont leur propre URL /{locale}/artisan/dashboard ;
// les rôles pro (société, conciergerie, gestionnaire) restent sur /pro/dashboard.
export { default } from '@/app/pro/dashboard/page'
