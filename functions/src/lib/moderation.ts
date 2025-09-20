/** Basic content moderation placeholder. */
export interface ModerationFlags {
  selfHarm: boolean;
  violence: boolean;
  bullying: boolean;
  sexual: boolean;
}

export function moderatePlainText(text: string): ModerationFlags {
  const t = text.toLowerCase();
  return {
    selfHarm: /(kill myself|end my life|cut myself|hurt myself)/.test(t),
    violence: /(kill them|hurt them|attack)/.test(t),
    bullying: /(loser|worthless|nobody likes you)/.test(t),
    sexual: /(explicit|nsfw)/.test(t)
  };
}
