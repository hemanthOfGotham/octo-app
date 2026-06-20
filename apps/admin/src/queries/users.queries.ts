import { db } from '@nao/backend/db';
import type { User } from '@nao/backend/schema';
import s from '@nao/backend/schema';
import { desc, eq, inArray, SQL, sql } from 'drizzle-orm';

export interface AdminUserOrg {
	id: string;
	name: string;
	slug: string;
	role: string;
}

export interface AdminUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
	organizations: AdminUserOrg[];
}

export async function listUsers(params: { search?: string; limit: number }): Promise<AdminUser[]> {
	const where = buildSearchFilter(params.search);

	const users = await db.select().from(s.user).where(where).orderBy(desc(s.user.createdAt)).limit(params.limit);

	return hydrateUsers(users);
}

export async function getUser(userId: string): Promise<AdminUser | null> {
	const users = await db.select().from(s.user).where(eq(s.user.id, userId)).limit(1);
	const [hydrated] = await hydrateUsers(users);
	return hydrated ?? null;
}

export async function setEmailVerified(userId: string, verified: boolean): Promise<AdminUser | null> {
	const [updated] = await db.update(s.user).set({ emailVerified: verified }).where(eq(s.user.id, userId)).returning();
	if (!updated) {
		return null;
	}
	return getUser(userId);
}

function buildSearchFilter(search?: string): SQL | undefined {
	const trimmed = search?.trim().toLowerCase();
	if (!trimmed) {
		return undefined;
	}
	const pattern = `%${trimmed}%`;
	return sql`lower(${s.user.email}) like ${pattern} or lower(${s.user.name}) like ${pattern}`;
}

async function hydrateUsers(users: User[]): Promise<AdminUser[]> {
	if (users.length === 0) {
		return [];
	}

	const ids = users.map((user) => user.id);
	const memberships = await db
		.select({
			userId: s.orgMember.userId,
			role: s.orgMember.role,
			orgId: s.organization.id,
			orgName: s.organization.name,
			orgSlug: s.organization.slug,
		})
		.from(s.orgMember)
		.innerJoin(s.organization, eq(s.orgMember.orgId, s.organization.id))
		.where(inArray(s.orgMember.userId, ids));

	const orgsByUser = new Map<string, AdminUserOrg[]>();
	for (const membership of memberships) {
		const list = orgsByUser.get(membership.userId) ?? [];
		list.push({ id: membership.orgId, name: membership.orgName, slug: membership.orgSlug, role: membership.role });
		orgsByUser.set(membership.userId, list);
	}

	return users.map((user) => ({
		id: user.id,
		name: user.name,
		email: user.email,
		emailVerified: user.emailVerified,
		image: user.image,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
		organizations: orgsByUser.get(user.id) ?? [],
	}));
}
