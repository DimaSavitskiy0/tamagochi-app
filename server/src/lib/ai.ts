import { env } from './env';

// Plain fetch against the Anthropic Messages API, same style as lib/yookassa.ts —
// no SDK dependency for a single call site.
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export function isAiConfigured(): boolean {
  return Boolean(env.anthropicApiKey);
}

type PetSummary = {
  name: string;
  breed: string | null;
  ageYears: number | null;
  hunger: number;
  mood: number;
  health: number;
  recentEntrySummaries: string[];
};

function buildPrompt(pet: PetSummary): string {
  const lines = [
    `Питомец: ${pet.name}${pet.breed ? `, порода ${pet.breed}` : ''}${pet.ageYears ? `, возраст ${pet.ageYears} лет` : ''}.`,
    `Текущие показатели: сытость ${pet.hunger}%, настроение ${pet.mood}%, здоровье ${pet.health}%.`,
  ];
  if (pet.recentEntrySummaries.length > 0) {
    lines.push('Последние записи дневника:', ...pet.recentEntrySummaries.map((s) => `- ${s}`));
  } else {
    lines.push('Дневник пока пуст.');
  }
  return lines.join('\n');
}

// Generates a single short, actionable, Russian-language care tip from the pet's
// current stats and recent diary activity.
export async function generatePetTip(pet: PetSummary): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': env.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      system:
        'Ты — заботливый ветеринарный ассистент в приложении для ухода за питомцем. ' +
        'По данным о питомце дай один короткий, тёплый и конкретный совет на русском языке ' +
        '(1-2 предложения, до 220 символов). Без markdown, без списков, без приветствий — сразу совет.',
      messages: [{ role: 'user', content: buildPrompt(pet) }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API request failed: ${body}`);
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((block) => block.type === 'text')?.text?.trim();
  if (!text) throw new Error('Anthropic API returned no text');
  return text;
}
