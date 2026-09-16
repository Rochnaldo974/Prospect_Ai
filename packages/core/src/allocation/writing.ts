import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { getTodayOpportunities, type TodayOpportunity } from './today';
import { WrittenCardSchema, emailHasJargon, type WrittenCard } from './written-card';

/**
 * Rédaction des fiches par Claude.
 *
 * Le moteur produit un relevé exact — faits mesurés, datés, vérifiables —
 * mais un relevé ne donne pas envie de décrocher. Retour du propriétaire
 * sur les premières fiches réelles : ce qui fait cliquer, c'est un titre qui
 * dit le défaut comme on le dirait au commerçant, et une première phrase
 * prête à être prononcée au téléphone.
 *
 * Claude n'intervient qu'ici, sur les dossiers déjà attribués — jamais dans
 * le scan ni dans le scoring (décision du 2026-09-14 : le coût par appel
 * interdit tout usage en masse). Il ne peut rien inventer : il reçoit les
 * faits que le moteur a constatés et rien d'autre, et la fiche est validée
 * avant d'être enregistrée. La fiche rédigée est figée à côté de
 * l'attribution : améliorer la formulation plus tard ne réécrit pas ce que
 * le freelance a déjà lu.
 *
 * Sans clé d'API, la rédaction est simplement sautée : le relevé du moteur
 * reste affiché, et c'est déjà juste.
 */

export const DEFAULT_WRITING_MODEL = 'claude-opus-5';

export interface CardInput {
  opportunity: TodayOpportunity;
  /** Les services que le freelance propose, pour orienter l'angle. */
  services: string[];
  /** Où le freelance est basé, s'il l'a dit. Sinon l'accroche ne situe personne. */
  freelanceCity?: string | null;
  /** Comment le freelance se présente, tel qu'il l'a écrit dans sa signature. */
  freelanceTitle?: string | null;
}

export type CardWriter = (input: CardInput) => Promise<WrittenCard>;

const SYSTEM_PROMPT = `Tu rédiges, pour un freelance du web, la fiche d'un prospect détecté par un moteur d'analyse.

Règles absolues :
- Tu n'utilises QUE les faits fournis. Aucun chiffre, aucune date, aucun nom, aucun outil qui n'y figure pas.
- Tu ne prêtes jamais d'intention à l'entreprise : elle n'a rien demandé. Tu dis ce qui a été constaté, pas ce qu'elle veut.
- Tu n'inventes pas d'urgence. Si aucun fait daté n'est fourni, "whyNow" est une chaîne vide.
- Tu écris en français, au vouvoiement, sans jargon, sans superlatif, sans promesse de résultat.
- Tu ne sais rien du freelance en dehors de ce qui est fourni : ni sa ville, ni son nom, ni son expérience, ni sa spécialité. L'accroche le présente exactement par le titre fourni, sans rien y ajouter. Si sa ville n'est pas fournie, l'accroche ne le situe nulle part.
- Le titre nomme le défaut ou l'occasion comme on le dirait au commerçant, en une ligne.
- L'accroche téléphonique est une phrase qu'on peut dire telle quelle : elle se présente, cite le fait le plus visible, et pose une question courte. Jamais "je me permets de vous contacter".
- Le constat cite les faits avec leurs valeurs (année, secondes, technologie) plutôt que des adjectifs.
- L'angle propose une action concrète et proportionnée, cohérente avec les services du freelance.

L'e-mail ("email") est lu par le commerçant lui-même, pas par le freelance. Il obéit à d'autres règles :
- "email.subject" : un objet court et calme, comme entre deux personnes qui se connaissent. Jamais de majuscules criardes, jamais de point d'exclamation, jamais « offre » ni « gratuit ».
- "email.hook" : deux ou trois phrases. D'abord comment on est tombé sur l'entreprise, dans son métier et sa ville — en cherchant un restaurant où réserver, un coiffeur pour prendre rendez-vous, un garage, une boutique… selon son activité. Ensuite le fait le plus visible, dit comme un client le verrait (« votre site s'affiche tout petit sur téléphone », « un message d'avertissement apparaît avant même la page », « la page met plusieurs secondes à s'ouvrir »). Enfin ce que ça coûte concrètement à ce métier-là : une réservation qui ne se fait pas, un rendez-vous pris ailleurs, un client qui repart.
- "email.proposal" : une ou deux phrases, ce que le freelance propose de faire, avec des mots de tous les jours, et la promesse la plus petite possible. Elle ne pose pas de question et ne propose ni envoi ni rendez-vous : la demande (un appel, un envoi, un échange) est ajoutée à part, selon ce que le freelance choisit.
- AUCUN mot technique dans l'e-mail. Interdits : HTTPS, SSL, certificat, responsive, SEO, CMS, audit, refonte, stack, framework, hébergement, cache, balise, référencement, HTML, WordPress, serveur, navigateur. On dit « votre site », « sur téléphone », « un message d'avertissement », « la page met longtemps à s'ouvrir », « être trouvé sur Google », « vos clients ».
- L'e-mail ne salue pas et ne présente pas le freelance : « Bonjour », sa présentation et sa signature sont ajoutés à part.`;

function factsForPrompt(input: CardInput): string {
  const o = input.opportunity;
  const e = o.explanation;
  const lines: string[] = [
    `Entreprise : ${o.company.name}`,
    `Ville : ${o.company.city ?? 'inconnue'}`,
    `Activité : ${o.company.industry ?? 'inconnue'}`,
    `Type d'opportunité : ${o.type}`,
    `Téléphone connu : ${o.company.phone ? 'oui' : 'non'}`,
    `Site web : ${o.company.websiteUrl ?? 'aucun'}`,
    `Formulaire de contact : ${o.company.contactFormUrl ?? 'aucun'}`,
    `Services du freelance : ${input.services.length > 0 ? input.services.join(', ') : 'non précisés'}`,
    `Ville du freelance : ${input.freelanceCity?.trim() || 'non fournie — ne pas le situer'}`,
    `Le freelance se présente comme : ${input.freelanceTitle?.trim() || 'développeur web indépendant'}`,
    '',
    'Faits constatés par le moteur (la seule source autorisée) :',
    ...e.signals.map((s) => `- ${s}`),
    '',
    `Relevé du moteur, pourquoi : ${e.why}`,
    `Relevé du moteur, pourquoi maintenant : ${e.whyNow || '(aucun fait daté)'}`,
    `Relevé du moteur, angle : ${e.angle}`,
  ];
  if (e.caveats.length > 0) {
    lines.push('', 'Réserves à respecter :', ...e.caveats.map((c) => `- ${c}`));
  }
  return lines.join('\n');
}

/** Le rédacteur par défaut : Claude, via l'API Claude, en sortie structurée validée. */
export function createClaudeWriter(options: { model?: string; client?: Anthropic; logger?: Logger } = {}): CardWriter {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_WRITING_MODEL;

  return async (input) => {
    const response = await client.messages.parse({
      model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: factsForPrompt(input) }],
      output_config: { format: zodOutputFormat(WrittenCardSchema) },
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('Rédaction refusée par le modèle');
    }
    const parsed = response.parsed_output;
    if (!parsed) throw new Error('Rédaction illisible : sortie non conforme au schéma');
    const card = WrittenCardSchema.parse(parsed);
    // Un mot technique dans l'e-mail : la part e-mail est écartée, la fiche
    // reste. Le brouillon retombe alors sur son texte de secours, qui est
    // moins bon mais ne parle jamais de certificat à un boulanger.
    if (card.email && emailHasJargon(card.email)) {
      options.logger?.warn('Part e-mail écartée : jargon', { subject: card.email.subject });
      delete card.email;
    }
    return card;
  };
}

export interface WritingReport {
  usersExamined: number;
  written: number;
  alreadyWritten: number;
  skipped: number;
  errors: number;
}

export interface WritingOptions {
  userId?: string;
  writer?: CardWriter;
  logger?: Logger;
  signal?: AbortSignal;
  /** Plafond de fiches rédigées par passe : c'est un coût, il se borne. */
  limit?: number;
  /** Réécrit aussi les fiches déjà rédigées — quand la rédaction a changé de règles. */
  rewrite?: boolean;
}

/** Une clé d'API présente rend la rédaction possible ; son absence la saute proprement. */
export function writingAvailable(): boolean {
  return Boolean(process.env['ANTHROPIC_API_KEY'] || process.env['ANTHROPIC_AUTH_TOKEN']);
}

/**
 * Rédige les fiches des dossiers vivants qui n'en ont pas encore.
 *
 * Passe après l'attribution, sur les attributions actives de chaque
 * utilisateur (ou d'un seul). Une fiche déjà rédigée n'est jamais réécrite.
 */
export async function writeCards(db: Db, options: WritingOptions = {}): Promise<WritingReport> {
  const report: WritingReport = { usersExamined: 0, written: 0, alreadyWritten: 0, skipped: 0, errors: 0 };
  const log = options.logger;
  const limit = options.limit ?? 50;

  if (!options.writer && !writingAvailable()) {
    log?.info('Rédaction sautée : aucune clé d’API Claude configurée');
    return report;
  }
  const writer = options.writer ?? createClaudeWriter({ ...(log ? { logger: log } : {}) });

  let userQuery = db.from('assignments').select('user_id').in('status', ['active']);
  if (options.userId) userQuery = userQuery.eq('user_id', options.userId);
  const { data: rows, error } = await userQuery;
  if (error) throw new Error(`writeCards : ${error.message}`);
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];

  for (const userId of userIds) {
    if (options.signal?.aborted || report.written >= limit) break;
    report.usersExamined += 1;

    const [opportunities, preferences, existing, profile, identity] = await Promise.all([
      getTodayOpportunities(db, userId),
      db.from('user_preferences').select('services').eq('user_id', userId).maybeSingle(),
      db.from('assignment_cards').select('assignment_id, card').eq('user_id', userId),
      db.from('profiles').select('city').eq('id', userId).maybeSingle(),
      db.from('email_identities').select('title').eq('user_id', userId).maybeSingle(),
    ]);
    const services = ((preferences.data?.services ?? []) as string[]);
    const freelanceCity = profile.data?.city ?? null;
    const freelanceTitle = identity.data?.title ?? null;
    const written = new Set(
      (existing.data ?? [])
        .filter((c) => (c.card as { written?: unknown } | null)?.written)
        .map((c) => c.assignment_id),
    );

    for (const opportunity of opportunities) {
      if (options.signal?.aborted || report.written >= limit) break;
      if (!options.rewrite && written.has(opportunity.assignmentId)) { report.alreadyWritten += 1; continue; }
      // Un dossier déjà appelé n'a plus besoin d'accroche.
      if (opportunity.contactedAt !== null) { report.skipped += 1; continue; }

      try {
        const card = await writer({ opportunity, services, freelanceCity, freelanceTitle });
        const { error: upsertError } = await db.from('assignment_cards').upsert({
          assignment_id: opportunity.assignmentId,
          user_id: userId,
          card: {
            written: card,
            written_at: new Date().toISOString(),
            model: DEFAULT_WRITING_MODEL,
            // Les faits fournis, figés avec la fiche : ce qui a été dit
            // reste vérifiable même si le relevé change ensuite.
            facts: opportunity.explanation.signals,
          } as unknown as Json,
        }, { onConflict: 'assignment_id' });
        if (upsertError) throw new Error(upsertError.message);
        report.written += 1;
      } catch (cause: unknown) {
        report.errors += 1;
        log?.warn('Fiche non rédigée', {
          assignment_id: opportunity.assignmentId,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }
  }

  log?.info('Rédaction des fiches terminée', {
    users: report.usersExamined, written: report.written,
    already_written: report.alreadyWritten, errors: report.errors,
  });
  return report;
}

