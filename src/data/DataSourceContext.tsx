import type { ReactNode } from 'react';

import type { DataSource } from './DataSource.js';
import { DataSourceContext } from './useDataSource.js';

export function DataSourceProvider({
  dataSource,
  children,
}: {
  dataSource: DataSource;
  children: ReactNode;
}) {
  return <DataSourceContext value={dataSource}>{children}</DataSourceContext>;
}
