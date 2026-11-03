> Voici la version finale, enrichie et définitive de votre Cahier des Charges Technique & Stratégique (CDCT). Ce document intègre désormais officiellement le nouveau module AI Packaging Studio, pensé sur-mesure pour propulser les industriels algériens à l'international grâce à l'intelligence artificielle.

# CAHIER DES CHARGES TECHNIQUE & STRATÉGIQUE COMPLET (CDCT)

- **Projet :** Plateforme SaaS B2B "One-Stop-Shop" d'Accélération, de Sécurisation des Exportations & de Design de Packaging par IA
- **Périmètre :** Exportations industrielles et conformité packaging depuis l'Algérie, l'Europe et la Chine vers 15 pays africains cibles.
- **Stack Technologique :** n8n (Orchestration Multi-Agents & Automatisations) + Claude Code (Développement Front/Back) + Google Stitch (Prototypage UX/UI) + PostgreSQL + Redis + Docker + APIs d'IA Générative (Image/Design 3D).

---

## 1. ARCHITECTURE TECHNIQUE & INFRASTRUCTURE GLOBALE

```text
[ Industriels (Algérie, Europe, Chine) ] (Saisie RFQ, Stocks, Packaging, Validation)
            │
            ▼
┌────────────────────────────────────────────────────────┐
│               CEO AGENT (Orchestrateur Principal)       │
└────────────────────────────────────────────────────────┘
    │
    ├── 1. Agent Macro & Market Intelligence ──► Analyse des 15 pays & Sélection du Top 5
    ├── 2. Agent SEO & Growth ───────────────► Génération des Landing Pages (Code SH / Pays)
    ├── 3. Agent Copywriting & Vidéo ────────► Rédaction des 18 scripts publicitaires ──[ Checkpoint Validation ]
    ├── 4. Agent Social Listening & WhatsApp ─► Suivi des retours marchés & Qualification de leads (WhatsApp Business API)
    ├── 5. Agent Logistique & Fret ──────────► Calcul des conteneurs (20ft/40ft) & Grilles tarifaires
    ├── 6. Agent Compliance & CAGEX ─────────► Vérification de solvabilité & Assurance-crédit export
    ├── 7. Agent AI Packaging Studio ────────► Génération de concepts 2D/3D & Vérification des normes d'export
    └── 8. Agent Billing & Invoicing ────────► Facturation globale, multi-devises & Prélèvement de la Commission (Success Fee)
```

### Stack & Infrastructure Docker

L'infrastructure repose sur un écosystème conteneurisé hautement disponible :

- **Orchestration des Agents & Workflows :** n8n interconnecté via webhooks sécurisés et files d'attente Redis.
- **Moteur de Code & Agents IA (Dev) :** Claude Code pour l'implémentation des composants React/Next.js (Front-office) et Node.js/Python (Back-office).
- **Base de données principale :** PostgreSQL 16+ avec extensions de recherche textuelle et réplication active.
- **Cache & Files d'attente :** Redis pour la gestion des sessions, des workers n8n et le rate-limiting des API de scraping et de génération d'images.

---

## 2. MODÉLISATION AVANCÉE DE LA BASE DE DONNÉES (PostgreSQL)

Voici le schéma relationnel complet intégrant la nouvelle table de gestion du packaging par IA :

```sql
-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table des Utilisateurs / Industriels
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    country VARCHAR(50) NOT NULL, -- 'Algeria', 'Europe', 'China'
    tax_id VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50) NOT NULL, -- 'Starter', 'Pro', 'Enterprise'
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table du Catalogue Produits & RFQ
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    hs_code VARCHAR(20) NOT NULL, -- Code SH douanier
    unit_price_ht NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL, -- 'DZD', 'EUR', 'USD'
    dimensions_cm JSONB NOT NULL, -- {length, width, height, weight_kg}
    container_capacity_20ft INT NOT NULL,
    container_capacity_40ft INT NOT NULL,
    stock_quantity INT NOT NULL,
    stock_sync_frequency VARCHAR(20) NOT NULL, -- 'weekly', 'monthly'
    is_locked BOOLEAN DEFAULT FALSE, -- Verrouillage auto si stock épuisé
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table des Campagnes d'Exportation & SEO
CREATE TABLE export_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_country VARCHAR(50) NOT NULL, -- Un des 15 pays africains cibles
    hs_code_target VARCHAR(20) NOT NULL,
    seo_landing_url VARCHAR(500),
    ad_scripts JSONB, -- Tableau des 18 scripts validés
    status VARCHAR(30) DEFAULT 'pending_human_validation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. NOUVEAU : Table dédiée au Studio Packaging par IA
CREATE TABLE ai_packaging_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    target_market VARCHAR(50) NOT NULL, -- Pays de destination (ex: Sénégal, France)
    packaging_type VARCHAR(50) NOT NULL, -- 'box', 'pouch', 'bottle', 'carton'
    ai_prompts_used TEXT NOT NULL,
    generated_assets_urls JSONB NOT NULL, -- URLs des images 2D, rendus 3D et fichiers d'impression
    compliance_check_results JSONB NOT NULL, -- Validation des mentions légales du pays cible
    status VARCHAR(30) DEFAULT 'draft', -- 'generated', 'validated_by_user', 'sent_to_printer'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table des Contrats, Commandes & Facturation
CREATE TABLE contracts_and_billing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    buyer_company VARCHAR(255) NOT NULL,
    buyer_country VARCHAR(50) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    freight_cost NUMERIC(10, 2) NOT NULL,
    cagex_status VARCHAR(50) DEFAULT 'under_review', -- 'approved', 'rejected'
    success_fee_amount NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(30) DEFAULT 'unpaid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. WORKFLOWS DÉTAILLÉS & AGENTS n8n (Avec AI Packaging Studio)

- **Agent 1 (Macro Intelligence) :** Analyse l'adéquation offre/demande sur les 15 pays africains cibles.
- **Agent 2 & 3 (SEO & Copywriting) :** Génération de landing pages et des 18 scripts publicitaires (avec checkpoint de validation humaine).
- **Agent 4 (Social Listening & WhatsApp) :** Suivi des signaux d'achat et qualification interactive des leads.
- **Agent 5 & 6 (Logistique & Compliance CAGEX) :** Calcul du taux de remplissage des conteneurs et vérification de la solvabilité/assurance-crédit export.
- **Agent 7 (AI Packaging Studio) - Nouveau :**
  - Récupère les données produit de l'industriel et croise les exigences légales du pays cible (mentions obligatoires, langues, normes de résistance).
  - Pilote une API d'IA générative pour concevoir le design visuel 2D et le prototype 3D de l'emballage (boîte, sachet, carton d'export).
  - Fournit les fichiers prêts pour l'impression haute résolution directement sur le dashboard de l'industriel algérien.
- **Agent 8 (Billing & Invoicing) :** Facturation proforma/définitive et application de la commission de succès (Success Fee).

---

## 4. GRILLE TARIFAIRE ET MODÈLE MULTIDEVISE APPROFONDI

L'intégration du module AI Packaging Studio sert de levier d'accélération commerciale, notamment pour les structures algériennes cherchant à se mettre aux normes internationales :

| Zone géographique | Palier / Niveau SaaS | Abonnement Fixe | Commission de Succès (Success Fee) | Spécificités & Services Inclus (Dont Packaging) |
|---|---|---|---|---|
| Algérie (DZD) | Starter Local<br>Pro Algérie<br>Enterprise | 20 000 DZD / mo<br>50 000 DZD / mo<br>120 000 DZD / mo | 1,5 %<br>1,0 %<br>0,5 % | Paiement en DZD (CIB / Edahabia / Virement).<br>Starter : 2 designs de packaging/mois.<br>Pro & Enterprise : Générations illimitées de packaging 2D/3D & conformité normes export. |
| Europe (EUR) | Starter EU<br>Pro EU<br>Enterprise EU | 290 € / mois<br>790 € / mois<br>Sur devis (> 1 900 €) | 2,0 %<br>1,5 %<br>0,8 % (dégressif) | Prélèvement SEPA, Stripe, conformité RGPD.<br>Studio packaging intégré pour standardisation européenne. |
| Chine (USD) | Starter China<br>Pro China<br>Enterprise China | 350 $ / mois<br>950 $ / mois<br>Sur devis (> 2 200 €) | 2,5 %<br>1,8 %<br>1,0 % (dégressif) | SWIFT/USD, passerelles asiatiques, support multilingue et adaptation packaging Asie-Afrique. |

---

## 5. ENGAGEMENTS DE SERVICE (SLA - PALIER ENTERPRISE)

Destiné à sécuriser les grands comptes industriels exigeants :

- **Disponibilité (Uptime) :** Garantie contractuelle de 99,9 % à 99,95 % de disponibilité mensuelle.
- **Support Critique (GTI / GTR) :** Temps de prise en charge (GTI) < 30 minutes et temps de rétablissement (GTR) < 4 heures pour les incidents bloquants.
- **Performances & Temps de réponse :** Latence des interfaces < 1,5 s ; génération des assets du studio packaging et synchronisation ERP < 2 s.
- **Sécurité & Gouvernance des Données :** RPO < 1 heure, RTO < 4 heures, et respect rigoureux de la souveraineté des données (réglementations locales algériennes, européennes et chinoises).
