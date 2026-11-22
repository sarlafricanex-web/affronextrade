import { COMPANY as C, type LegalSet } from "./types";

export const en: LegalSet = {
  updated: "Last updated: 22 November 2026",
  docs: {
    legal: {
      title: "Legal notice",
      sections: [
        {
          title: "Publisher",
          blocks: [
            [
              `${C.name}, limited liability company (SARL) with a share capital of ${C.capital}`,
              "Registered office: Cité 50 LSP + 18, Locaux RDC, Bâtiment 4, Bloc 1, n° 52, Sétif, Algeria",
              `Trade register: ${C.rc}`,
              `Tax ID (NIF): ${C.nif}`,
              `Phone: ${C.phone}`,
              `Email: ${C.email}`,
            ],
          ],
        },
        { title: "Publication director", blocks: [C.director] },
        {
          title: "Hosting",
          blocks: [
            "Website: Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, United States (vercel.com).",
            "Database, accounts and files: Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992 (supabase.com). Data is stored in the European Union (Paris).",
          ],
        },
        {
          title: "Intellectual property",
          blocks: [
            "The texts, the AFRICA NEX brand, the logo and the design of the site belong to SARL AFRICA NEX. Any reproduction without written permission is prohibited.",
            "Content published by producers and buyers (descriptions, photos, documents) remains their property. Credits for the images used on the site appear at the bottom of each page.",
          ],
        },
        {
          title: "Related documents",
          blocks: ["Privacy and cookie policy, terms of use and terms of sale: links at the bottom of the page."],
        },
      ],
    },

    privacy: {
      title: "Privacy and cookie policy",
      intro: "This policy explains what data AFRICA NEX collects, why, how long it is kept and how to exercise your rights. It applies Algerian law no. 18-07 on personal data protection and, for people located in the European Union, the General Data Protection Regulation (GDPR).",
      sections: [
        {
          title: "1. Data controller",
          blocks: [`${C.name}, Cité 50 LSP + 18, Bloc 1, n° 52, Sétif, Algeria. Contact for your data: ${C.email}.`],
        },
        {
          title: "2. Data we collect",
          blocks: [
            [
              "Account: name, email, phone, WhatsApp, role (producer or buyer), language. Your password is encrypted and never readable. With Google sign-in, we receive your name and email.",
              "Company: company name, legal form, activity, address, province or country, contacts, logo, presentation; for producers, tax ID (NIF), statistical ID (NIS), tax article and trade register number.",
              "Uploaded documents: trade register, certificates (ISO, halal, etc.). They stay private unless you choose to make them public.",
              "Catalogue and prices: products, photos, export price, price in dinars and negotiation margin (the last two are confidential and reserved to AFRICA NEX).",
              "Activity on the platform: quote requests and attachments, quotes, offers, decisions, messages, reviews.",
              "Views of your profile: date, country and language of the visitor and, if signed in, their account.",
              "Contact form: name, email, company, country, phone, WhatsApp, message.",
              "Audience measurement: anonymous visit statistics, without cookies (Vercel Web Analytics).",
            ],
          ],
        },
        {
          title: "3. Purposes and legal bases",
          blocks: [
            [
              "Creating and managing your account, publishing your profile, handling your requests, quotes and offers, sending you service messages and emails: performance of the contract (terms of use and terms of sale).",
              "Verifying companies, preventing fraud, securing the platform, showing you your profile statistics: AFRICA NEX's legitimate interest.",
              "Producer profiles created by AFRICA NEX from public information (trade register, website): legitimate interest in presenting Algerian supply. The company can claim its profile or ask for its deletion at any time.",
              "Subscription invoicing and accounting obligations: legal obligation.",
              "Contact form and documents made public: your consent, which you can withdraw at any time.",
            ],
            "Your data is never sold. No automated decision produces legal effects concerning you.",
          ],
        },
        {
          title: "4. Who sees your data",
          blocks: [
            "The AFRICA NEX team, within the limits of its tasks. Buyers and producers never see each other's identity or contact details: everything goes through AFRICA NEX.",
            "Our technical providers, acting on our instructions:",
            [
              "Supabase (database, accounts, files), data stored in Paris;",
              "Vercel (website hosting and audience measurement), United States;",
              "Resend (email delivery), United States;",
              "Google (only if you choose to sign in with Google), United States.",
            ],
            "Transfers outside Algeria and the European Union are covered by these providers' contractual safeguards (European Commission standard contractual clauses).",
          ],
        },
        {
          title: "5. Retention periods",
          blocks: [
            [
              "Account and company profile: as long as the account is active. An account with no sign-in for 3 years is deleted after a warning email.",
              "Requests, quotes, offers and messages: 5 years after the request is closed, as evidence of the business relationship.",
              "Invoices and accounting records: 10 years (legal obligation).",
              "Profile views: 13 months.",
              "Log of sent emails: 12 months.",
              "Contact form: 12 months.",
              "After an account is deleted: erased within one month, except items that must be kept for a legal obligation, archived with restricted access.",
            ],
          ],
        },
        {
          title: "6. Your rights",
          blocks: [
            "You can access your data, correct it, have it erased, restrict its processing, object to it, receive it in a common format (portability) and withdraw your consent. If you live in France, you can also give instructions on what happens to it after your death.",
            `Write to ${C.email}, or use "Delete my account" in your space. We reply within one month. We may ask for proof of identity if there is doubt about who you are.`,
            "You can lodge a complaint with the Algerian personal data protection authority (ANPDP), or with the CNIL (cnil.fr) or your country's authority if you live in the European Union.",
          ],
        },
        {
          title: "7. Cookies",
          blocks: [
            "The site uses no advertising or tracking cookies, so there is no consent banner. Only these technical cookies are set:",
            [
              "sb-…-auth-token (Supabase): keeps you signed in; deleted when you sign out, 400 days at most.",
              "NEXT_LOCALE: remembers the language you chose; lasts for the browsing session.",
            ],
            "Vercel audience measurement sets no cookie and cannot identify you.",
          ],
        },
        {
          title: "8. Security",
          blocks: ["Encrypted connections (HTTPS), encrypted passwords, access rules checked by the database for every piece of information, confidential prices and documents readable only by their owner and by AFRICA NEX."],
        },
        {
          title: "9. Changes",
          blocks: ["This policy may change. The update date appears at the bottom of the page; for any significant change, we notify you by email or in your space."],
        },
      ],
    },

    terms: {
      title: "Terms of use",
      intro: "These terms govern the use of the AFRICA NEX platform by producers and buyers. By creating an account, you accept them.",
      sections: [
        {
          title: "1. Purpose",
          blocks: ["AFRICA NEX is a business matchmaking platform between producers, mainly Algerian, and international professional buyers. AFRICA NEX qualifies requests, consults producers and presents offers to buyers."],
        },
        {
          title: "2. Access for professionals only",
          blocks: ["The platform is reserved to adults acting in the name and on behalf of a company. You guarantee that the information you provide (identity, company, documents) is accurate and keep it up to date."],
        },
        {
          title: "3. Account",
          blocks: ["You are responsible for keeping your password confidential and for actions taken from your account. Tell us immediately of any unauthorised use."],
        },
        {
          title: "4. How it works and anonymity",
          blocks: [
            [
              "The buyer submits a quote request; AFRICA NEX qualifies it and consults producers with an anonymised brief.",
              "AFRICA NEX publishes one or more offers; the buyer accepts or declines them, offer by offer.",
              "Buyers and producers never see each other's identity or contact details; exchanges go through AFRICA NEX messaging.",
              "Circumventing the platform, meaning contacting a party introduced by AFRICA NEX directly to close a deal without it, is prohibited for the duration of your registration and 12 months after the last introduction.",
            ],
          ],
        },
        {
          title: "5. Published content",
          blocks: [
            "You are responsible for the content you publish (profile, products, prices, photos, documents, messages) and guarantee that you hold the rights to it. It must be accurate, lawful and must not infringe third-party rights.",
            "AFRICA NEX may moderate, hide or remove content that breaches these terms or the law.",
            "Some producer profiles are created by AFRICA NEX from public information. The company concerned can claim them to manage them, or ask for their deletion.",
          ],
        },
        {
          title: "6. Reviews",
          blocks: ["Only signed-in buyers with a complete profile can post a review. Each review is checked by AFRICA NEX before publication and shown with its date. AFRICA NEX does not verify that a transaction took place between the author and the producer."],
        },
        {
          title: "7. Confidential information",
          blocks: ["A producer's price in dinars, negotiation margin and private documents are visible only to that producer and to AFRICA NEX. AFRICA NEX's margins are never disclosed to other users."],
        },
        {
          title: "8. Liability",
          blocks: [
            "AFRICA NEX undertakes to use reasonable means to run the platform and handle requests, without guaranteeing that a deal will be concluded.",
            "In intermediation, the sales contract is concluded between the buyer and the producer, who remains the exporter; when AFRICA NEX exports itself, with the producer's prior consent, the sales contract is concluded with AFRICA NEX. The terms of each deal (price, Incoterm, transport, payment) are set out in the accepted offer.",
          ],
        },
        {
          title: "9. Suspension and deletion of the account",
          blocks: ["AFRICA NEX may suspend or delete an account for breach of these terms, false information or circumvention, after inviting you to explain yourself except in an emergency. You can delete your account at any time from your space."],
        },
        {
          title: "10. Personal data",
          blocks: ["The processing of your data is described in the privacy policy."],
        },
        {
          title: "11. Changes to the terms",
          blocks: ["AFRICA NEX may change these terms. Users are notified at least 15 days before a significant change takes effect; continuing to use the platform means acceptance."],
        },
        {
          title: "12. Governing law and disputes",
          blocks: ["These terms are governed by Algerian law. Failing an amicable settlement, any dispute falls under the competent courts of Sétif."],
        },
      ],
    },

    sales: {
      title: "Terms of sale",
      intro: "These terms apply to subscriptions taken out by producers and suppliers on the AFRICA NEX platform. They are intended for professionals.",
      sections: [
        {
          title: "1. Subscriptions",
          blocks: ["AFRICA NEX offers a free plan and paid subscriptions whose content, quotas and prices are described on the Pricing page on the day of subscription. Services marked \"Coming soon\" are not included until they are available."],
        },
        {
          title: "2. Prices",
          blocks: ["Prices are stated in Algerian dinars, excluding tax. The VAT in force in Algeria is added. A price change is announced at least 30 days in advance and only applies at the next renewal."],
        },
        {
          title: "3. Subscription and payment",
          blocks: ["You subscribe from your space. Payment is made by bank transfer, monthly or yearly (annual prepayment, with two months free). The subscription is activated by AFRICA NEX on receipt of payment; an invoice is issued."],
        },
        {
          title: "4. Founder offer",
          blocks: ["The first 30 subscribers paying annually in advance get a 50% discount, as long as the subscription is renewed without interruption. The founder price is permanently lost if the subscription is cancelled."],
        },
        {
          title: "5. Term, renewal and cancellation",
          blocks: [
            [
              "Monthly subscription: no commitment. You can cancel at any time; it ends at the end of the paid month, with no refund for the month started.",
              "Annual subscription: paid in advance and not refundable during the year, in return for the two free months, except in case of default by AFRICA NEX (promised service not provided), in which case the remaining period is refunded pro rata.",
              "Change of plan: a higher plan applies as soon as it is paid; a lower plan applies at the end of the current period.",
            ],
          ],
        },
        {
          title: "6. End of subscription and unpaid amounts",
          blocks: ["At the end of a subscription, or 30 days after an unpaid due date, the account automatically returns to the free plan. Products beyond the free quota are hidden from the public, never deleted, and reappear as soon as a suitable subscription is activated."],
        },
        {
          title: "7. Remuneration on deals",
          blocks: ["Independently of the subscription, AFRICA NEX is remunerated on each deal concluded through it: commission according to the grid in force (10%, 7% or 5% depending on the deal amount), or margin when AFRICA NEX exports itself. Invoicing terms are set out in writing for each deal."],
        },
        {
          title: "8. Withdrawal",
          blocks: ["As subscriptions are taken out by professionals for their business, the withdrawal period provided for consumers does not apply."],
        },
        {
          title: "9. Governing law and disputes",
          blocks: ["These terms are governed by Algerian law. Failing an amicable settlement, any dispute falls under the competent courts of Sétif."],
        },
      ],
    },
  },
};
