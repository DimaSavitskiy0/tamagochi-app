// Shared between the Профиль upsell card and the trial-expired PaywallModal so the
// pitch stays consistent in both places.
//
// Describes what the subscription keeps access to, not feature gates that don't
// exist — nothing here is actually restricted for free/trial users right now (no
// diary entry cap, same charts, same local reminder notifications for everyone).
// The subscription's real value is simply continued access after the 7-day trial
// (see contexts/SubscriptionProvider.tsx's isLocked) — keep the wording honest about
// that instead of implying differentiated perks.
export const PRO_BENEFITS = [
  'Дневник питомца: кормления, прогулки, лекарства',
  'Графики веса и здоровья по дням',
  'Напоминания и календарь дел',
];

export const PRO_PLAN_PRICE_LABEL = '199 ₽ / месяц';
