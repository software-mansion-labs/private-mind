import {
  ChatSettings,
  Message,
  SourceDocument,
  sourceKind,
} from '../database/chatRepository';
import { Model } from '../database/modelRepository';
import { CUSTOM_PROMPT_GUARD } from '../constants/prompts';
import { type Message as ExecutorchMessage } from 'react-native-executorch';
import {
  estimatePromptTokens,
  getPromptCharBudget,
  getPromptTokenBudget,
} from '../constants/context-window';
import { calendarFacts, mentionsTime } from './calendarFacts';
import {
  detectThreadLanguage,
  type QuestionLanguage,
} from './questionLanguage';
import { detectTopicLanguage } from './web/topicLanguage';
import {
  extractCurrencyTokens,
  extractPriceStatementTokens,
  FOLLOWUP_CONVERSION_MARKERS,
  hasVerifiedProductData,
  splitPriceOutliers,
  TREND_CLAIM_MARKERS,
  hasPeriodMatchedChangeData,
} from './web/figureGrounding';
import { selectRelevantContent } from './web/webResultsToContext';

const CONTEXT_CLOSE_TAG_RESERVE_CHARS = 64;

const surrogateSafeEnd = (text: string, end: number): number => {
  if (end <= 0 || end >= text.length) return end;
  const code = text.charCodeAt(end - 1);
  return code >= 0xd800 && code <= 0xdbff ? end - 1 : end;
};

const CONTEXT_BLOCK =
  /^\n --- ([^:\n]+): (.*?) --- \n ([\s\S]*?) \n --- End of \1 ---$/;

const buildContextBlock = (label: string, name: string, passage: string) =>
  `\n --- ${label}: ${name} --- \n ${passage} \n --- End of ${label} ---`;

const smartTrimContextBlocks = (
  blocks: string[],
  query: string,
  totalBudget: number
): string | null => {
  if (totalBudget <= 0) return null;
  const matches = blocks.map((block) => block.match(CONTEXT_BLOCK));
  if (matches.some((match) => match === null)) return null;

  const weights = blocks.map((_, index) => 1 / (index + 1));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const kept = matches
    .map((match, index) => {
      const [, label, name, passage] = match!;
      const share = Math.floor((totalBudget * weights[index]!) / weightSum);
      const markerOverhead = buildContextBlock(label!, name!, '').length;
      const innerBudget = share - markerOverhead;
      if (innerBudget <= 0) return null;
      const trimmedPassage =
        passage!.length <= innerBudget
          ? passage!
          : selectRelevantContent(passage!, query, innerBudget);
      return buildContextBlock(label!, name!, trimmedPassage);
    })
    .filter((block): block is string => block !== null);

  if (kept.length === 0) return null;
  const candidate = kept.join(' ');
  return candidate.length <= totalBudget ? candidate : null;
};

const getContextInstruction = (
  sources?: SourceDocument[],
  preferred?: SourceDocument[],
  language?: QuestionLanguage | null
): string => {
  const hasWeb = !!sources?.some((source) => sourceKind(source) === 'web');
  const hasDocs = !!sources?.some(
    (source) => sourceKind(source) === 'document'
  );
  const webOnly = hasWeb && !hasDocs;

  const headed = 'each block headed by its number and the page title';
  const overviewNote = preferred?.length
    ? ', with a freshly attached file marked "(Overview)"'
    : '';
  let what: string;
  if (webOnly) {
    what = `excerpts from web pages just retrieved for this question, ${headed}`;
  } else if (hasWeb) {
    what = `excerpts from the user's documents and from web pages just retrieved for this question, ${headed}`;
  } else {
    what = `excerpts from the user's documents, ${headed}${overviewNote}`;
  }

  const scope = webOnly
    ? []
    : [
        'Do not answer about any document that is not in the current <context> block, even if it appeared earlier in the chat — its text is not available to you.',
      ];

  const missing = webOnly ? 'the search results' : 'the sources';
  const fallback = `If the block does not contain the answer, say ${missing} contain no information about it; only then may you add what you know, marked as your own knowledge.`;

  const noLeakedJargon =
    'Never say the word "context" (or its translation) to the user — it is this instruction set\'s internal name for the retrieved block, not something the user knows about. Say "the sources" or "the search results" instead, as used above.';

  const currentTurn = hasWeb
    ? [
        "This block was retrieved for the user's latest message only. Earlier turns may be about a different subject or place — answer the latest message, and never carry a subject over from them.",
      ]
    : [];

  const direct =
    'Answer the question that was asked, directly and first. Do not summarize the pages or add background the question did not ask for.';

  const conflict = hasWeb
    ? [
        'The pages may disagree because some are out of date. Where they conflict, trust the page reporting the newest events — a change, a succession, "X replaces Y" — over a page that states the old fact.',
      ]
    : [];

  const figures =
    'Copy every number, price and date exactly as it is printed in the context. If the context does not state the figure the question asks about, say so — never estimate or invent one. ' +
    'If the question names something that is not mentioned anywhere in the context at all, say you have no current data for it — do not give it a figure, even an approximate or well-known one. ' +
    'When comparing several things, a source block may be tagged [Answers: <query>] — only use its figures for the entity that tag names, never for another entity in the same comparison.';

  const SPECULATIVE_SOURCE_MARKERS =
    /\brumou?rs?\b|\bleak(?:ed|s)?\b|\bspeculat|\brumored\b|\bexpected to\b/i;
  const speculative =
    hasWeb &&
    sources?.some(
      (source) =>
        sourceKind(source) === 'web' &&
        SPECULATIVE_SOURCE_MARKERS.test(source.name)
    )
      ? [
          'Some source titles above signal rumor or speculation ("Rumors", "Leaked", "Expected") rather than a confirmed fact — if that source is the only support for a claim, say it is rumored or unconfirmed rather than stating it as settled, and never phrase it in the past tense as something that already happened.',
        ]
      : [];

  const instruction = [
    'IMPORTANT CONTEXT INFORMATION:',
    `The <context>…</context> block below holds ${what}. It is the ONLY authoritative source for this question — answer strictly from it and prefer it over your own knowledge.`,
    ...currentTurn,
    ...scope,
    fallback,
    noLeakedJargon,
    direct,
    ...conflict,
    figures,
    ...speculative,
    languageInstruction(language),
  ].join('\n');

  return `\n\n${instruction}`;
};

const languageInstruction = (language?: QuestionLanguage | null): string => {
  if (!language) {
    return 'Write the whole answer in the language of the latest user message, and do not switch language or script partway through.';
  }
  const inScript = language.script ? `, written in ${language.script}` : '';
  const noLatin = language.script
    ? ' Never transliterate the answer into the Latin alphabet.'
    : '';
  return `Write the whole answer in ${language.name}${inScript} — the language of the question — and do not switch language or script partway through.${noLatin}`;
};

export const answerLanguageAnchor = (
  language: QuestionLanguage | null
): string =>
  language
    ? ` (Answer in ${language.name}.)`
    : ' (Answer in the same language as this message.)';

const getDateInstruction = (
  sources?: SourceDocument[],
  question?: string
): string => {
  const webSources = (sources ?? []).filter(
    (source) => sourceKind(source) === 'web'
  );
  if (webSources.length === 0 && !(question && mentionsTime(question))) {
    return '';
  }
  const language = detectTopicLanguage(webSources);

  return `\n\nCURRENT DATE — from the device clock, correct, and outranking any date found elsewhere:\n${calendarFacts(language?.code)}\nResolve "today", "tomorrow" and weekday names against those lines, quote them exactly, and never ask the user what day it is.`;
};

const getIntentInstruction = (
  webIntent?: string,
  webSubQueries?: string[]
): string => {
  if (!webIntent) return '';
  if (webSubQueries && webSubQueries.length > 1) {
    const parts = webSubQueries.map((q, i) => `(${i + 1}) ${q}`).join(', ');
    return `Question intent: ${webIntent}. This question has multiple parts — answer every one of them: ${parts}.`;
  }
  return `Question intent: ${webIntent}.`;
};

const getLanguageReminder = (language?: QuestionLanguage | null): string =>
  language
    ? `Answer in ${language.name}, not the sources' language.`
    : "Answer in the user's language, not the sources'.";

const FIGURES_HINT_MAX = 8;

const ANSWERS_TAG = /\[Answers: ([^\]]+)\]/g;

const figureList = (text: string): string[] => {
  const clean = [...new Set(extractPriceStatementTokens(text))];
  const tokens = clean.length > 0 ? clean : extractCurrencyTokens(text);
  return [...new Set(tokens)].slice(0, FIGURES_HINT_MAX);
};

const RANGE_HINT_MIN_FIGURES = 3;
const getRangeHint = (tokenCount: number): string =>
  tokenCount >= RANGE_HINT_MIN_FIGURES
    ? ' These are prices for different variants or listings of the same product, not one figure to quote directly — do not list them out. Respond with ONLY a range (lowest to highest) or ONLY the single most relevant one.'
    : '';

const getOutlierNote = (outliers: string[]): string =>
  outliers.length > 0
    ? ` ${outliers.join(', ')} ${outliers.length > 1 ? 'stand' : 'stands'} far apart from the other figures found — that is more likely a filter default, shipping cost, financing installment, a rate/change value, or an unrelated listing than this product's actual price. Do not use it as the low (or high) end of a range, or as "the" price, unless the source text explicitly ties it to this exact product.`
    : '';

const MIN_TOKENS_FOR_OUTLIER_CHECK = 3;

const outliersAmong = (tokens: string[], context: string): string[] => {
  const pool =
    tokens.length < MIN_TOKENS_FOR_OUTLIER_CHECK
      ? [...new Set([...tokens, ...extractCurrencyTokens(context)])]
      : tokens;
  return splitPriceOutliers(pool).outliers.filter((o) => tokens.includes(o));
};

const getFiguresInstruction = (context: string): string => {
  const tags = [...context.matchAll(ANSWERS_TAG)];
  if (tags.length < 2) {
    const tokens = figureList(context);
    if (tokens.length === 0) return '';
    const outliers = outliersAmong(tokens, context);
    return `Figures found in the sources: ${tokens.join(', ')}. State a price or amount only if it matches one of these — never one from memory.${getRangeHint(tokens.length)}${getOutlierNote(outliers)}`;
  }

  const segments = new Map<string, string>();
  tags.forEach((tag, i) => {
    const start = tag.index!;
    const end = i + 1 < tags.length ? tags[i + 1]!.index! : context.length;
    const query = tag[1]!;
    segments.set(
      query,
      `${segments.get(query) ?? ''} ${context.slice(start, end)}`
    );
  });

  const perEntity = [...segments.entries()]
    .map(([query, text]) => [query, figureList(text)] as const)
    .filter(([, tokens]) => tokens.length > 0)
    .map(([query, tokens]) => `${query} → ${tokens.join(', ')}`);
  if (perEntity.length === 0) return '';
  return `Figures found per entity: ${perEntity.join(' | ')}. Use a figure only for the entity it's listed under — never for another entity in the comparison, and never one from memory. If the question named something with no entry in this list, say you have no current data for it instead of giving it a figure.`;
};

const OPINION_MARKERS =
  /co sądzisz|twoim zdaniem|jak oceniasz|jak ci się podoba|czy warto|what do you think|your (opinion|take|thoughts)|worth (it|buying|getting)|would you recommend|is it (good|worth)/i;

const getOpinionInstruction = (question?: string): string =>
  question && OPINION_MARKERS.test(question)
    ? '\n\nThe question asks for your assessment, not just facts. After grounding the relevant facts in the context above, add a brief, clearly-marked opinion — do not stop at a plain list of specifications or data.'
    : '';

const INVESTMENT_COMPARISON_MARKERS =
  /lepsz(?:a|ą|y|ej|ym) inwestycj|bardziej (?:opłacaln|zyskown)|większ[ay] zwrot|wyższ[ayą] stop[ęa] zwrotu|better investment|more profitable|higher return|which (?:one )?(?:performed|did) better|outperform/i;

const getInvestmentComparisonInstruction = (question?: string): string =>
  question && INVESTMENT_COMPARISON_MARKERS.test(question)
    ? '\n\nWhen judging which option was the better investment, compare the percentage change (return) over the relevant period — a higher current price or value does NOT by itself mean a better investment.'
    : '';

const COMPARISON_MARKERS =
  /czym się różni|jaka jest różnic|różnic\w* (?:między|pomiędzy)|co odróżnia|porówn\w*|\bvs\.?\b|\bversus\b|\bcompare\b|comparison between|difference between|how (?:do|does) .+ differ|what'?s the difference/i;

const getComparisonStructureInstruction = (question?: string): string =>
  question && COMPARISON_MARKERS.test(question)
    ? "\n\nThe question asks how two (or more) things differ. Address each one under its own clear heading or point before any closing remark, so the two sets of facts stay visibly separate — don't blend them into one paragraph, and don't let a fact about one carry into a sentence about the other."
    : '';

const RECENT_EVENT_MARKERS =
  /ostatni(?:ego|m)? mecz|ostatni(?:ego|m)? wynik|najnowszy wynik|last (?:match|game)|latest (?:match|game|result)/i;

const getRecentEventCompletenessInstruction = (question?: string): string =>
  question && RECENT_EVENT_MARKERS.test(question)
    ? '\n\nThe question asks about the most recent event, not just its headline figure. If the sources name who else was involved (an opponent, a rival) and when it happened, include those too — a score or result alone does not fully answer "the last match/game" the way it would answer a question that only asked for the number.'
    : '';

const getFollowUpConversionInstruction = (question?: string): string =>
  question && FOLLOWUP_CONVERSION_MARKERS.test(question)
    ? '\n\nThis follow-up asks you to convert or recompute a specific number from your own previous answer earlier in this conversation. Use that exact figure as the base — do not substitute a different or more generic figure just because it appears in the sources below. If a conversion rate is available, apply it and state the actual converted result, not just the rate on its own.'
    : '';

const getTrendGroundingInstruction = (
  question: string | undefined,
  context: string
): string =>
  question &&
  TREND_CLAIM_MARKERS.test(question) &&
  !hasPeriodMatchedChangeData(context)
    ? '\n\nThe sources above give only a current price/value, not how much it changed over a period. If the question asks about a change or percentage gain, say that data is not available — do not infer a trend from a single current figure.'
    : '';

const VARIANT_MARKER = /\b(\d+)\s?(GB|TB)\b/i;

const getVariantGroundingInstruction = (question?: string): string => {
  const match = question?.match(VARIANT_MARKER);
  if (!match) return '';
  const variant = `${match[1]}${match[2]!.toUpperCase()}`;
  return `\n\nThe question asks specifically about the ${variant} variant. Product pages often list prices for several storage sizes, colors or models together in one block — before quoting a price, discount or promotion, confirm the surrounding text names that exact variant; a nearby figure for a different size or model is not the answer, even if it is the closest one on the page.`;
};

const getVerifiedProductInstruction = (context: string): string =>
  hasVerifiedProductData(context)
    ? '\n\nA source block containing "[Verified product data]" states its price, product name and availability directly from that page\'s own structured product data — not text scraped and inferred like the rest of the passage. Treat that figure as ground truth for the exact product it names, and prefer it over any other price found in the same or a different source, unless a different "[Verified product data]" block names the same product with a different figure.'
    : '';

const getWeakRetrievalInstruction = (weak?: boolean): string =>
  weak
    ? "\n\nThis web search's results could not be confidently verified as relevant to the question. If the context above does not clearly answer it, say so plainly rather than stretching what's there into a fuller-sounding answer."
    : '';

const PERIOD_SCOPE_MARKERS =
  /w tym roku|tego roku|w tym sezonie|tego sezonu|dotychczas w (?:tym roku|sezonie)|this year|this season|so far this (?:year|season)/i;
const SUPERLATIVE_MARKERS =
  /najwi[eę]cej|najlepsz|najskuteczniejsz|\brekord|\bmost\b|\bbest\b|\btop\b|\bhighest\b|\bleading\b/i;

const getPeriodScopeInstruction = (question?: string): string =>
  question &&
  PERIOD_SCOPE_MARKERS.test(question) &&
  SUPERLATIVE_MARKERS.test(question)
    ? '\n\nThe question asks for a "most/best" figure within a specific recent window (this year, this season). Pages about who scored or achieved the most usually default to an all-time or career total unless they explicitly mention that same window — do not use an all-time figure to answer a this-year question; if nothing in the context is explicitly scoped to that window, say the sources do not give a figure limited to it.'
    : '';

const getScopeIntegrityInstruction = (): string =>
  '\n\nBefore stating a total or count from a source, check whether that source scopes it to something narrower than the question asks about (e.g. one specific competition, tournament, region, or category rather than the overall figure) — if so, name that narrower scope explicitly instead of presenting the number as the general total.';

const getWebSearchFailedInstruction = (failed?: boolean): string =>
  failed
    ? '\n\nA web search was just attempted for this question because it needs current or verifiable facts, but it found nothing usable. Do not guess a specific fact — a name, date, score, or number — from memory as if it were confirmed; say plainly that you do not have verified current information for this.'
    : '';

// When an earlier turn in this thread searched the web, its <context> block
// carried numbered "Source 1" / "Source 2" labels the model may have cited.
// A later follow-up this app decided did not need a fresh search has no
// such block — but without this reminder a small model keeps citing those
// numbers anyway, imitating its own earlier reply even though nothing here
// backs the numbers up.
const getNoFreshContextInstruction = (hasPriorWebAnswer: boolean): string =>
  hasPriorWebAnswer
    ? '\n\nNo new search results were retrieved for this message — there is no <context> block this time. Answer from the conversation so far, in your own words. Never write "Source 1", "Source 2" or similar numbered citations here; those labels only existed in an earlier message\'s context block, which is not part of this prompt.'
    : '';

const getPreferredSourceInstruction = (sources?: SourceDocument[]) => {
  if (!sources?.length) return '';

  const sourceNames = sources.map((source) => source.name).join(', ');
  return `

CURRENT ATTACHMENT PRIORITY:
The user just attached: ${sourceNames}. Treat these as the subject of the question — "this file", "the document", "it" refer to them. Base the answer on them; bring in another source only if they lack the answer. You may still use earlier conversation for continuity.`;
};

export const prepareMessagesForLLM = (
  activeChatMessages: Message[],
  context: string[],
  settings: ChatSettings,
  model: Model,
  customSystemPrompt: string = '',
  preferredSourceDocuments?: SourceDocument[],
  sourceDocuments?: SourceDocument[],
  budgetScale: number = 1,
  webIntent?: string,
  webSubQueries?: string[],
  webWeak?: boolean,
  webSearchFailed?: boolean
): ExecutorchMessage[] => {
  const hasContext = context.some((chunk) => chunk.trim().length > 0);
  const question = activeChatMessages.findLast(
    (msg) => msg.role === 'user'
  )?.content;
  const language = detectThreadLanguage(
    activeChatMessages
      .filter((msg) => msg.role === 'user')
      .map((msg) => msg.content)
  );

  let systemPrompt = settings.systemPrompt;

  const trimmedCustomPrompt = customSystemPrompt.trim();
  if (trimmedCustomPrompt) {
    const guardedCustomPrompt = `${CUSTOM_PROMPT_GUARD}\n\n${trimmedCustomPrompt}`;
    systemPrompt = systemPrompt
      ? `${systemPrompt}\n\n${guardedCustomPrompt}`
      : guardedCustomPrompt;
  }

  if (hasContext) {
    const contextText = context.join(' ');
    systemPrompt += getContextInstruction(
      sourceDocuments,
      preferredSourceDocuments,
      language
    );
    systemPrompt += getPreferredSourceInstruction(preferredSourceDocuments);
    systemPrompt += getOpinionInstruction(question);
    systemPrompt += getComparisonStructureInstruction(question);
    systemPrompt += getRecentEventCompletenessInstruction(question);
    systemPrompt += getFollowUpConversionInstruction(question);
    systemPrompt += getInvestmentComparisonInstruction(question);
    systemPrompt += getTrendGroundingInstruction(question, contextText);
    systemPrompt += getVariantGroundingInstruction(question);
    systemPrompt += getVerifiedProductInstruction(contextText);
    systemPrompt += getPeriodScopeInstruction(question);
    systemPrompt += getScopeIntegrityInstruction();
    systemPrompt += getWeakRetrievalInstruction(webWeak);
  } else {
    systemPrompt += `\n\n${languageInstruction(language)}`;
    systemPrompt += getWebSearchFailedInstruction(webSearchFailed);
    const hasPriorWebAnswer = activeChatMessages.some(
      (msg) =>
        msg.role === 'assistant' &&
        msg.sourceDocuments?.some((source) => sourceKind(source) === 'web')
    );
    systemPrompt += getNoFreshContextInstruction(hasPriorWebAnswer);
  }
  systemPrompt += getDateInstruction(sourceDocuments, question);

  const nonEventMessages = activeChatMessages.filter(
    (msg): msg is Message & { role: Exclude<Message['role'], 'event'> } =>
      msg.role !== 'event'
  );
  const lastNonEventMessage = nonEventMessages.at(-1);
  const messagesForLLM =
    lastNonEventMessage?.role === 'assistant' &&
    lastNonEventMessage.content.trim().length === 0
      ? nonEventMessages.slice(0, -1)
      : nonEventMessages;

  const filteredMessages: ExecutorchMessage[] = messagesForLLM.map((msg) => ({
    role: msg.role,
    content: msg.content,
    ...(msg.imagePath ? { mediaPath: msg.imagePath } : {}),
  }));

  const messagesWithSystemPrompt: ExecutorchMessage[] = [
    { role: 'system', content: systemPrompt },
    ...filteredMessages,
  ];

  if (messagesWithSystemPrompt.length <= 1) {
    return messagesWithSystemPrompt;
  }

  const lastMessage = messagesWithSystemPrompt.at(-1)!;

  lastMessage.content += answerLanguageAnchor(language);

  if (settings.thinkingEnabled) {
    lastMessage.content += ' /think';
  } else if (model.thinking) {
    lastMessage.content += ' /no_think';
  }

  const budgetSample = `${messagesWithSystemPrompt[0].content}${context.join(
    ' '
  )}${lastMessage.content}`;
  const budgetChars = Math.floor(
    getPromptCharBudget(model, budgetSample) * budgetScale
  );
  const systemChars = messagesWithSystemPrompt[0].content.length;

  if (hasContext) {
    const safeContext = context
      .map((c) => c.replace(/<\s*\/?\s*context\s*>/gi, ''))
      .join(' ');

    const userText = lastMessage.content;
    const groundingHint = preferredSourceDocuments?.length
      ? 'The question is about the just-attached document(s) in the <context> above.'
      : '';
    const hasWebSource = sourceDocuments?.some(
      (source) => sourceKind(source) === 'web'
    );
    const conflictHint = hasWebSource
      ? 'If the sources above disagree, the one reporting the newest change (a succession, "X replaces Y") is right — a source stating the older fact is out of date.'
      : '';
    const languageHint = hasWebSource ? getLanguageReminder(language) : '';
    const intentHint = getIntentInstruction(webIntent, webSubQueries);
    const wrap = (ctx: string) =>
      [
        `<context>${ctx}</context>`,
        groundingHint,
        conflictHint,
        languageHint,
        hasWebSource ? getFiguresInstruction(ctx) : '',
        intentHint,
        userText,
      ]
        .filter(Boolean)
        .join('\n');

    const availableForLast = Math.max(0, budgetChars - systemChars);
    let finalContext = safeContext;
    if (wrap(finalContext).length > availableForLast) {
      const overhead = wrap('').length;
      const room = Math.max(
        0,
        availableForLast - overhead - CONTEXT_CLOSE_TAG_RESERVE_CHARS
      );

      const smartContext =
        hasWebSource && question
          ? smartTrimContextBlocks(
              context.map((chunk) =>
                chunk.replace(/<\s*\/?\s*context\s*>/gi, '')
              ),
              question,
              room
            )
          : null;

      if (smartContext !== null) {
        finalContext = smartContext;
      } else {
        const hardSlice = safeContext.slice(
          0,
          surrogateSafeEnd(safeContext, room)
        );
        const boundary = Math.max(
          hardSlice.lastIndexOf('\n\n'),
          hardSlice.lastIndexOf('\n ---')
        );
        let sliced = boundary > 0 ? hardSlice.slice(0, boundary) : hardSlice;
        const lastOpenLabel = sliced
          .match(/--- (?!End of )[^:\n]+:/g)
          ?.at(-1)
          ?.slice(4, -1);
        if (
          lastOpenLabel &&
          !sliced.includes(`--- End of ${lastOpenLabel} ---`)
        ) {
          const endMarker = ` \n --- End of ${lastOpenLabel} ---`;
          const allowed =
            room + CONTEXT_CLOSE_TAG_RESERVE_CHARS - endMarker.length;
          if (sliced.length > allowed) {
            sliced = sliced.slice(
              0,
              surrogateSafeEnd(sliced, Math.max(0, allowed))
            );
          }
          finalContext = `${sliced}${endMarker}`;
        } else {
          finalContext = sliced;
        }
      }
    }
    lastMessage.content = wrap(finalContext);
  }

  const mandatoryChars = systemChars + lastMessage.content.length;
  let remainingChars = budgetChars - mandatoryChars;
  const history = messagesWithSystemPrompt.slice(1, -1);
  const keptReversed: ExecutorchMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const cost = history[i].content.length;
    if (remainingChars - cost < 0) {
      break;
    }
    remainingChars -= cost;
    keptReversed.push(history[i]);
  }

  const kept = keptReversed.reverse();
  if (kept.length < history.length) {
    while (kept[0]?.role === 'assistant') {
      kept.shift();
    }
  }

  const finalMessages = [messagesWithSystemPrompt[0], ...kept, lastMessage];

  if (hasContext && budgetScale > 0.75) {
    const assembled = finalMessages.map((msg) => msg.content).join(' ');
    if (estimatePromptTokens(assembled) > getPromptTokenBudget(model)) {
      return prepareMessagesForLLM(
        activeChatMessages,
        context,
        settings,
        model,
        customSystemPrompt,
        preferredSourceDocuments,
        sourceDocuments,
        budgetScale * 0.97,
        webIntent,
        webSubQueries
      );
    }
  }

  return finalMessages;
};
