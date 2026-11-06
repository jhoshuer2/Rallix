/** Setup checklist for a new club admin. Pure: the page passes in simple facts about the club. */
export type SetupFacts = {
  hasLogo: boolean;
  hasCover: boolean;
  hasCourt: boolean;
  hasPlans: boolean;
  hasPayouts: boolean;
  hasInvited: boolean; // an invite link exists, or at least one other member has joined
  hasCompetition: boolean;
  hasClubPage: boolean; // the club wrote something people can read before joining
  hasPassword: boolean; // this admin set a username and password (optional way to sign in)
};

export type SetupStep = { key: "picture" | "clubpage" | "court" | "plans" | "payouts" | "invite" | "competition" | "account"; title: string; hint: string; href: string; done: boolean };

/** The ordered steps, what each is for, and where to do it. A club picture counts as done with a logo OR a cover. */
export function setupSteps(f: SetupFacts): SetupStep[] {
  return [
    { key: "picture", title: "Add your club picture", hint: "A logo or cover people recognise.", href: "/profile/pictures", done: f.hasLogo || f.hasCover },
    { key: "clubpage", title: "Write your club page", hint: "Rules, schedule and dress code people read before they join.", href: "/profile/club-page", done: f.hasClubPage },
    { key: "invite", title: "Invite your players", hint: "Share the invite link in your group chat.", href: "/profile/invite", done: f.hasInvited },
    { key: "plans", title: "Set your fees", hint: "Monthly or yearly dues, if your club charges any.", href: "/membership/subscriptions", done: f.hasPlans },
    { key: "payouts", title: "Choose where fees are paid", hint: "Your bank account for online payments.", href: "/membership/payouts", done: f.hasPayouts },
    { key: "court", title: "Mark your court", hint: "So players can check in when they arrive.", href: "/profile/court", done: f.hasCourt },
    { key: "competition", title: "Start your first competition", hint: "Or skip it and just let people play.", href: "/competition/new", done: f.hasCompetition },
    { key: "account", title: "Set a username and password", hint: "Sign in faster next time. The emailed code still works.", href: "/profile/account", done: f.hasPassword },
  ];
}

export function setupProgress(f: SetupFacts): { done: number; total: number; complete: boolean; next: SetupStep | null; steps: SetupStep[] } {
  const steps = setupSteps(f);
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done === steps.length, next: steps.find((s) => !s.done) ?? null, steps };
}

/** The same idea for a new player: only things they can actually do. */
export type PlayerStartFacts = { hasPhoto: boolean; levelSet: boolean; playedMatch: boolean; alertsOn: boolean; hasPassword: boolean };
export function playerStart(f: PlayerStartFacts): { key: string; title: string; href: string; done: boolean }[] {
  return [
    { key: "photo", title: "Add your photo", href: "/play/me", done: f.hasPhoto },
    { key: "alerts", title: "Turn on arrival alerts", href: "/play/me", done: f.alertsOn },
    { key: "compete", title: "See what you can join", href: "/play/compete", done: f.playedMatch },
    { key: "account", title: "Set a username and password", href: "/play/me/account", done: f.hasPassword },
  ];
}
