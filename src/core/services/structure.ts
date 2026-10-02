import type { TreeNode } from '../domain/types';
import type { Repository } from '../repo/Repository';

/** All nodes in display order: depth-first, siblings by sort order, then name. */
export async function listTree(repo: Repository): Promise<TreeNode[]> {
  const nodes = await repo.listNodes();
  const childrenOf = new Map<string | null, TreeNode[]>();
  for (const node of nodes) {
    const siblings = childrenOf.get(node.parentId) ?? [];
    siblings.push(node);
    childrenOf.set(node.parentId, siblings);
  }

  const ordered: TreeNode[] = [];
  const visit = (parentId: string | null) => {
    const siblings = (childrenOf.get(parentId) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    for (const node of siblings) {
      ordered.push(node);
      visit(node.id);
    }
  };
  visit(null);
  return ordered;
}
