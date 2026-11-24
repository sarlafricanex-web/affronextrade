import { COMPANY as C, type LegalSet } from "./types";

export const fr: LegalSet = {
  updated: "Dernière mise à jour : 22 novembre 2026",
  docs: {
    legal: {
      title: "Mentions légales",
      sections: [
        {
          title: "Éditeur du site",
          blocks: [
            [
              `${C.name}, société à responsabilité limitée au capital de ${C.capital}`,
              "Siège : Cité 50 LSP + 18, Locaux RDC, Bâtiment 4, Bloc 1, n° 52, Sétif, Algérie",
              `Registre du commerce : ${C.rc}`,
              `NIF : ${C.nif}`,
              `Téléphone : ${C.phone}`,
              `Email : ${C.email}`,
            ],
          ],
        },
        { title: "Directeur de la publication", blocks: [C.director] },
        {
          title: "Hébergement",
          blocks: [
            "Site : Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis (vercel.com).",
            "Base de données, comptes et fichiers : Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992 (supabase.com). Les données sont stockées dans l'Union européenne (Paris).",
          ],
        },
        {
          title: "Propriété intellectuelle",
          blocks: [
            "Les textes, la marque AFRICA NEX, le logo et la présentation du site appartiennent à SARL AFRICA NEX. Toute reproduction sans autorisation écrite est interdite.",
            "Les contenus publiés par les producteurs et les acheteurs (descriptions, photos, documents) restent leur propriété. Les crédits des images utilisées sur le site figurent en bas de chaque page.",
          ],
        },
        {
          title: "Documents associés",
          blocks: ["Politique de confidentialité et cookies, conditions générales d'utilisation (CGU) et conditions générales de vente (CGV) : liens en bas de page."],
        },
      ],
    },

    privacy: {
      title: "Politique de confidentialité et cookies",
      intro: "Cette politique explique quelles données AFRICA NEX collecte, pourquoi, combien de temps elle les garde et comment exercer vos droits. Elle applique la loi algérienne n° 18-07 sur la protection des données personnelles et, pour les personnes situées dans l'Union européenne, le règlement général sur la protection des données (RGPD).",
      sections: [
        {
          title: "1. Responsable du traitement",
          blocks: [`${C.name}, Cité 50 LSP + 18, Bloc 1, n° 52, Sétif, Algérie. Contact pour vos données : ${C.email}.`],
        },
        {
          title: "2. Données collectées",
          blocks: [
            [
              "Compte : nom, email, téléphone, WhatsApp, rôle (producteur ou acheteur), langue. Le mot de passe est chiffré et n'est jamais lisible. Avec la connexion Google, nous recevons votre nom et votre email.",
              "Entreprise : raison sociale, forme juridique, activité, adresse, wilaya ou pays, contacts, logo, présentation ; pour les producteurs, NIF, NIS, article d'imposition et registre du commerce.",
              "Documents déposés : registre du commerce, certificats (ISO, halal, etc.). Ils restent privés sauf si vous choisissez de les rendre publics.",
              "Catalogue et prix : produits, photos, prix export, prix en dinars et marge de négociation (ces deux derniers sont confidentiels et réservés à AFRICA NEX).",
              "Activité sur la plateforme : demandes de devis et pièces jointes, devis, offres, décisions, messages, avis.",
              "Vues de votre fiche : date, pays et langue du visiteur et, s'il est connecté, son compte.",
              "Formulaire de contact : nom, email, entreprise, pays, téléphone, WhatsApp, message.",
              "Mesure d'audience : statistiques de visite anonymes, sans cookie (Vercel Web Analytics).",
            ],
          ],
        },
        {
          title: "3. Pourquoi et sur quelle base",
          blocks: [
            [
              "Créer et gérer votre compte, publier votre fiche, traiter vos demandes, devis et offres, vous envoyer les messages et emails de service : exécution du contrat (CGU et CGV).",
              "Vérifier les entreprises, prévenir la fraude, sécuriser la plateforme, vous montrer les statistiques de votre fiche : intérêt légitime d'AFRICA NEX.",
              "Fiches de producteurs créées par AFRICA NEX à partir d'informations publiques (registre, site internet) : intérêt légitime de présenter l'offre algérienne. L'entreprise peut revendiquer sa fiche ou demander sa suppression à tout moment.",
              "Facturation des abonnements et obligations comptables : obligation légale.",
              "Formulaire de contact et documents rendus publics : votre consentement, que vous pouvez retirer à tout moment.",
            ],
            "Vos données ne sont jamais vendues. Aucune décision automatisée ne produit d'effet juridique à votre égard.",
          ],
        },
        {
          title: "4. Qui voit vos données",
          blocks: [
            "L'équipe d'AFRICA NEX, dans la limite de ses missions. Acheteurs et producteurs ne voient jamais l'identité ni les coordonnées les uns des autres : tout passe par AFRICA NEX.",
            "Nos prestataires techniques, qui agissent sur nos instructions :",
            [
              "Supabase (base de données, comptes, fichiers), données stockées à Paris ;",
              "Vercel (hébergement du site et mesure d'audience), États-Unis ;",
              "Resend (envoi des emails), États-Unis ;",
              "Google (seulement si vous choisissez de vous connecter avec Google), États-Unis.",
            ],
            "Les transferts hors d'Algérie et hors de l'Union européenne sont encadrés par les garanties contractuelles de ces prestataires (clauses contractuelles types de la Commission européenne).",
          ],
        },
        {
          title: "5. Durées de conservation",
          blocks: [
            [
              "Compte et fiche entreprise : tant que le compte est actif. Un compte sans connexion depuis 3 ans est supprimé, après un email d'avertissement.",
              "Demandes, devis, offres et messages : 5 ans après la clôture de la demande, pour la preuve de la relation commerciale.",
              "Factures et pièces comptables : 10 ans (obligation légale).",
              "Vues de fiche : 13 mois.",
              "Journal des emails envoyés : 12 mois.",
              "Formulaire de contact : 12 mois.",
              "Après la suppression d'un compte : effacement sous un mois, sauf les éléments à conserver pour une obligation légale, archivés à accès restreint.",
            ],
          ],
        },
        {
          title: "6. Vos droits",
          blocks: [
            "Vous pouvez accéder à vos données, les rectifier, les faire effacer, en limiter le traitement, vous y opposer, les recevoir dans un format courant (portabilité) et retirer votre consentement. Si vous résidez en France, vous pouvez aussi donner des directives sur leur sort après votre décès.",
            `Écrivez à ${C.email}, ou utilisez « Supprimer mon compte » dans votre espace. Nous répondons sous un mois. Une pièce d'identité peut être demandée en cas de doute sur votre identité.`,
            "Vous pouvez saisir l'Autorité nationale de protection des données à caractère personnel (ANPDP) en Algérie, ou la CNIL (cnil.fr) ou l'autorité de votre pays si vous résidez dans l'Union européenne.",
          ],
        },
        {
          title: "7. Cookies",
          blocks: [
            "Le site n'utilise aucun cookie publicitaire ni de suivi. Il n'y a donc pas de bandeau de consentement. Seuls ces cookies techniques sont déposés :",
            [
              "sb-…-auth-token (Supabase) : garder votre session de connexion ; supprimé à la déconnexion, 400 jours au plus.",
              "NEXT_LOCALE : retenir la langue choisie ; durée de la session de navigation.",
            ],
            "La mesure d'audience Vercel ne dépose aucun cookie et ne permet pas de vous identifier.",
          ],
        },
        {
          title: "8. Sécurité",
          blocks: ["Connexions chiffrées (HTTPS), mots de passe chiffrés, règles d'accès vérifiées par la base de données pour chaque information, prix et documents confidentiels lisibles par leur seul propriétaire et par AFRICA NEX."],
        },
        {
          title: "9. Modifications",
          blocks: ["Cette politique peut évoluer. La date de mise à jour figure en bas de page ; en cas de changement important, nous vous prévenons par email ou dans votre espace."],
        },
      ],
    },

    terms: {
      title: "Conditions générales d'utilisation (CGU)",
      intro: "Les présentes conditions encadrent l'utilisation de la plateforme AFRICA NEX par les producteurs et les acheteurs. En créant un compte, vous les acceptez.",
      sections: [
        {
          title: "1. Objet",
          blocks: ["AFRICA NEX est une plateforme de mise en relation commerciale entre producteurs, principalement algériens, et acheteurs professionnels internationaux. AFRICA NEX qualifie les demandes, consulte les producteurs et présente des offres aux acheteurs."],
        },
        {
          title: "2. Accès réservé aux professionnels",
          blocks: ["La plateforme est réservée aux personnes majeures qui agissent au nom et pour le compte d'une entreprise. Vous garantissez l'exactitude des informations fournies (identité, entreprise, documents) et les tenez à jour."],
        },
        {
          title: "3. Compte",
          blocks: ["Vous êtes responsable de la confidentialité de votre mot de passe et des actions faites depuis votre compte. Prévenez-nous sans délai de tout usage non autorisé."],
        },
        {
          title: "4. Fonctionnement et anonymat",
          blocks: [
            [
              "L'acheteur dépose une demande de devis ; AFRICA NEX la qualifie et consulte les producteurs avec un brief anonymisé.",
              "AFRICA NEX publie une ou plusieurs offres ; l'acheteur les accepte ou les refuse, offre par offre.",
              "Acheteurs et producteurs ne voient jamais l'identité ni les coordonnées les uns des autres ; les échanges passent par la messagerie d'AFRICA NEX.",
              "Il est interdit de contourner la plateforme, c'est-à-dire de contacter directement une partie présentée par AFRICA NEX pour conclure sans elle, pendant la durée de l'inscription et 12 mois après la dernière mise en relation.",
            ],
          ],
        },
        {
          title: "5. Contenus publiés",
          blocks: [
            "Vous êtes responsable des contenus que vous publiez (fiche, produits, prix, photos, documents, messages) et garantissez en détenir les droits. Ils doivent être exacts, licites et ne pas porter atteinte aux droits de tiers.",
            "AFRICA NEX peut modérer, masquer ou retirer un contenu contraire aux présentes conditions ou à la loi.",
            "Certaines fiches de producteurs sont créées par AFRICA NEX à partir d'informations publiques. L'entreprise concernée peut les revendiquer pour les gérer, ou en demander la suppression.",
          ],
        },
        {
          title: "6. Avis",
          blocks: ["Seuls les acheteurs connectés dont le profil est complet peuvent déposer un avis. Chaque avis est relu par AFRICA NEX avant publication et affiché avec sa date. AFRICA NEX ne vérifie pas qu'une transaction a eu lieu entre l'auteur et le producteur."],
        },
        {
          title: "7. Informations confidentielles",
          blocks: ["Le prix en dinars, la marge de négociation et les documents privés d'un producteur ne sont visibles que par lui et par AFRICA NEX. Les marges d'AFRICA NEX ne sont jamais communiquées aux autres utilisateurs."],
        },
        {
          title: "8. Responsabilité",
          blocks: [
            "AFRICA NEX s'engage à mettre en œuvre les moyens raisonnables pour faire fonctionner la plateforme et traiter les demandes, sans garantir la conclusion d'une affaire.",
            "En intermédiation, le contrat de vente est conclu entre l'acheteur et le producteur, qui reste l'exportateur ; quand AFRICA NEX exporte elle-même, avec l'accord préalable du producteur, le contrat de vente est conclu avec AFRICA NEX. Les conditions de chaque affaire (prix, incoterm, transport, paiement) figurent dans l'offre acceptée.",
          ],
        },
        {
          title: "9. Suspension et suppression du compte",
          blocks: ["AFRICA NEX peut suspendre ou supprimer un compte en cas de manquement aux présentes conditions, d'informations fausses ou de contournement, après vous avoir invité à vous expliquer sauf urgence. Vous pouvez supprimer votre compte à tout moment depuis votre espace."],
        },
        {
          title: "10. Données personnelles",
          blocks: ["Le traitement de vos données est décrit dans la politique de confidentialité."],
        },
        {
          title: "11. Modification des conditions",
          blocks: ["AFRICA NEX peut modifier les présentes conditions. Les utilisateurs sont prévenus au moins 15 jours avant l'entrée en vigueur d'un changement important ; continuer à utiliser la plateforme vaut acceptation."],
        },
        {
          title: "12. Droit applicable et litiges",
          blocks: ["Les présentes conditions sont soumises au droit algérien. À défaut d'accord amiable, tout litige relève des tribunaux compétents de Sétif."],
        },
      ],
    },

    sales: {
      title: "Conditions générales de vente (CGV)",
      intro: "Les présentes conditions s'appliquent aux abonnements souscrits par les producteurs et fournisseurs sur la plateforme AFRICA NEX. Elles s'adressent à des professionnels.",
      sections: [
        {
          title: "1. Abonnements",
          blocks: ["AFRICA NEX propose une formule gratuite et des abonnements payants dont le contenu, les quotas et les prix sont décrits sur la page Tarifs au jour de la souscription. Les services marqués « Bientôt » ne sont pas inclus tant qu'ils ne sont pas disponibles."],
        },
        {
          title: "2. Prix",
          blocks: ["Les prix sont indiqués en dinars algériens, hors taxes. La TVA en vigueur en Algérie s'y ajoute. Un changement de prix est annoncé au moins 30 jours à l'avance et ne s'applique qu'au renouvellement suivant."],
        },
        {
          title: "3. Souscription et paiement",
          blocks: ["La souscription se fait depuis votre espace. Le paiement se fait par virement bancaire, au mois ou à l'année (paiement annuel d'avance, avec 10 % de remise). L'abonnement est activé par AFRICA NEX à réception du paiement ; une facture est émise."],
        },
        {
          title: "4. Essai gratuit",
          blocks: ["AFRICA NEX peut proposer à des producteurs de son choix un essai gratuit d'une offre payante, d'une durée de 60 jours, une seule fois par producteur. À la fin de l'essai, le compte revient automatiquement à la formule gratuite, sans engagement ni paiement."],
        },
        {
          title: "5. Durée, renouvellement et résiliation",
          blocks: [
            [
              "Abonnement mensuel : sans engagement. Vous pouvez le résilier à tout moment ; il prend fin au terme du mois payé, sans remboursement du mois commencé.",
              "Abonnement annuel : payé d'avance et non remboursable en cours d'année, en contrepartie de la remise de 10 %, sauf manquement d'AFRICA NEX (service promis non fourni), auquel cas la période restante est remboursée au prorata.",
              "Changement de formule : une formule supérieure s'applique dès le paiement ; une formule inférieure s'applique à la fin de la période en cours.",
            ],
          ],
        },
        {
          title: "6. Fin d'abonnement et impayés",
          blocks: ["À la fin d'un abonnement, ou 30 jours après l'échéance restée impayée, le compte repasse automatiquement en formule gratuite. Les produits au-delà du quota gratuit sont masqués au public, jamais supprimés, et réapparaissent dès qu'un abonnement adapté est activé."],
        },
        {
          title: "7. Rémunération sur les affaires",
          blocks: ["Indépendamment de l'abonnement, AFRICA NEX est rémunérée sur chaque affaire conclue par son intermédiaire : commission selon la grille en vigueur (10 %, 7 % ou 5 % selon le montant de l'affaire), ou marge quand AFRICA NEX exporte elle-même. Les modalités de facturation sont précisées par écrit pour chaque affaire."],
        },
        {
          title: "8. Rétractation",
          blocks: ["Les abonnements étant souscrits par des professionnels pour leur activité, le délai de rétractation prévu pour les consommateurs ne s'applique pas."],
        },
        {
          title: "9. Droit applicable et litiges",
          blocks: ["Les présentes conditions sont soumises au droit algérien. À défaut d'accord amiable, tout litige relève des tribunaux compétents de Sétif."],
        },
      ],
    },
  },
};
