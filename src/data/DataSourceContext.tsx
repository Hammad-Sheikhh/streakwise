import type { ReactNode } from 'react';

import type { DataSource } from './DataSource';
import { DataSourceContext } from './useDataSource';

export function DataSourceProvider({
  dataSource,
  children,
}: {
  dataSource: DataSource;
  children: ReactNode;
}) {
  return <DataSourceContext value={dataSource}>{children}</DataSourceContext>;
}
