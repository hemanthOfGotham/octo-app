import { db } from '@nao/backend/db';
import s from '@nao/backend/schema';
import { count, desc, isNotNull } from 'drizzle-orm';

export interface AdminOrg {
	id: string;
	name: string;
	slug: string;
	googleAuthDomains: string | null;
	memberCount: number;
	projectCount: number;
	createdAt: Date;
}

export async function listOrgs(limit: number): Promise<AdminOrg[]> {
	const orgs = await db.select().from(s.organization).orderBy(desc(s.organization.createdAt)).limit(limit);
	if (orgs.length === 0) {
		return [];
	}

	const [memberCounts, projectCounts] = await Promise.all([
		db.select({ orgId: s.orgMember.orgId, value: count() }).from(s.orgMember).groupBy(s.orgMember.orgId),
		db
			.select({ orgId: s.project.orgId, value: count() })
			.from(s.project)
			.where(isNotNull(s.project.orgId))
			.groupBy(s.project.orgId),
	]);

	const membersByOrg = toCountMap(memberCounts);
	const projectsByOrg = toCountMap(projectCounts);

	return orgs.map((org) => ({
		id: org.id,
		name: org.name,
		slug: org.slug,
		googleAuthDomains: org.googleAuthDomains,
		memberCount: membersByOrg.get(org.id) ?? 0,
		projectCount: projectsByOrg.get(org.id) ?? 0,
		createdAt: org.createdAt,
	}));
}

function toCountMap(rows: { orgId: string | null; value: number }[]): Map<string, number> {
	const map = new Map<string, number>();
	for (const row of rows) {
		if (row.orgId) {
			map.set(row.orgId, row.value);
		}
	}
	return map;
}
