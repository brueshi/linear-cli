import type { LinearClient, Issue } from '@linear/sdk';

/**
 * Find an issue by its identifier (e.g., "ENG-123") or raw ID.
 * Shared utility to avoid duplication across commands.
 */
export async function findIssueByIdentifier(client: LinearClient, identifier: string): Promise<Issue | null> {
  const normalized = identifier.toUpperCase();

  // Parse identifier format: TEAM-NUMBER (e.g., ENG-123)
  const match = normalized.match(/^([A-Z]+)-(\d+)$/);

  if (match) {
    const [, teamKey, numberStr] = match;
    const issueNumber = parseInt(numberStr, 10);

    const issues = await client.issues({
      filter: {
        team: { key: { eq: teamKey } },
        number: { eq: issueNumber },
      },
      first: 1,
    });

    return issues.nodes[0] || null;
  }

  // Try as a raw number across all teams
  const asNumber = parseInt(identifier, 10);
  if (!isNaN(asNumber)) {
    const issues = await client.issues({
      filter: { number: { eq: asNumber } },
      first: 1,
    });
    return issues.nodes[0] || null;
  }

  // Try as raw UUID
  try {
    return await client.issue(identifier);
  } catch {
    return null;
  }
}

/**
 * Find a project by name or ID
 */
export async function findProject(client: LinearClient, nameOrId: string): Promise<{ id: string; name: string } | null> {
  // Try by ID first if it looks like a UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId);

  if (isUuid) {
    try {
      const project = await client.project(nameOrId);
      if (project) {
        return { id: project.id, name: project.name };
      }
    } catch {
      // Not found by ID, fall through to name search
    }
  }

  // Search by name
  const projects = await client.projects({
    filter: { name: { containsIgnoreCase: nameOrId } },
    first: 1,
  });

  if (projects.nodes.length > 0) {
    return {
      id: projects.nodes[0].id,
      name: projects.nodes[0].name,
    };
  }

  return null;
}

/**
 * Resolve a team by key, returning id and key.
 * Prints available teams and exits if not found.
 */
export async function resolveTeam(
  client: LinearClient,
  teamKey: string,
): Promise<{ id: string; key: string; name: string } | null> {
  const teams = await client.teams();
  const team = teams.nodes.find(t => t.key.toUpperCase() === teamKey.toUpperCase());

  if (team) {
    return { id: team.id, key: team.key, name: team.name };
  }

  return null;
}

/**
 * Get available team keys for error messages
 */
export async function getTeamKeys(client: LinearClient): Promise<string[]> {
  const teams = await client.teams();
  return teams.nodes.map(t => t.key);
}

/**
 * Fuzzy-match a workflow state name against a team's states.
 * Returns the best match or null with available state names for error messages.
 */
export async function resolveWorkflowState(
  client: LinearClient,
  teamId: string,
  stateName: string,
): Promise<{ id: string; name: string; type: string } | { error: string; available: string[] }> {
  const team = await client.team(teamId);
  const states = await team.states();

  // Exact match first
  const exact = states.nodes.find(
    s => s.name.toLowerCase() === stateName.toLowerCase()
  );
  if (exact) {
    return { id: exact.id, name: exact.name, type: exact.type };
  }

  // Partial match
  const partial = states.nodes.find(
    s => s.name.toLowerCase().includes(stateName.toLowerCase())
  );
  if (partial) {
    return { id: partial.id, name: partial.name, type: partial.type };
  }

  return {
    error: `State "${stateName}" not found`,
    available: states.nodes.map(s => s.name),
  };
}
