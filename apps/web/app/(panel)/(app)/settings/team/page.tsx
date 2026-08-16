import { getTranslations } from 'next-intl/server';

import { PanelSection, SectionStack } from '@/components/ui/panel-section';
import { requireCapability } from '@/lib/auth';
import { listTeam } from '@/lib/queries';
import { InviteMemberButton } from '@/features/team/components/invite-member-dialog';
import { TeamList } from '@/features/team/components/team-list';

export async function generateMetadata() {
  const t = await getTranslations('team');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

/**
 * Employees (SPEC §5.12, AUDIT.md T8).
 *
 * Owner-only, and guarded here rather than only in the nav: every action on the
 * screen re-checks `team.manage` server-side too, because hiding a link does not
 * stop a POST.
 */
export default async function TeamPage() {
  const { admin, tenant } = await requireCapability('team.manage');
  const t = await getTranslations('team');

  const members = await listTeam(tenant.id);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
        <h1 className="text-title font-semibold text-foreground">
          {t('pageTitle')}
        </h1>
        <InviteMemberButton />
      </div>

      <SectionStack>
        <PanelSection
          flush
          title={t('membersTitle')}
          meta={t('memberCount', { count: members.length })}
        >
          <TeamList
            members={members.map((m) => ({
              ...m,
              // Dates cross the server → client boundary as ISO strings; the
              // row formats them with the viewer's locale.
              lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
              invite: m.invite
                ? {
                    code: m.invite.code,
                    expiresAt: m.invite.expiresAt.toISOString(),
                  }
                : null,
              isSelf: m.id === admin.id,
            }))}
          />
        </PanelSection>

        {/* What the three roles mean, stated once on the screen where the
            decision is made — the owner picking a role for a new hire should
            not have to remember which of them can see revenue. */}
        <PanelSection title={t('rolesTitle')}>
          <dl className="flex flex-col gap-2.5">
            <RoleExplainer role="owner" />
            <RoleExplainer role="manager" />
            <RoleExplainer role="warehouse" />
          </dl>
        </PanelSection>
      </SectionStack>
    </>
  );
}

async function RoleExplainer({ role }: { role: string }) {
  const tRoles = await getTranslations('roles');
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small font-semibold text-foreground">
        {tRoles(role)}
      </dt>
      <dd className="text-small leading-snug text-muted-foreground">
        {tRoles(`${role}Hint`)}
      </dd>
    </div>
  );
}
