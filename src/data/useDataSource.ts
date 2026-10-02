import { createContext, useContext } from 'react';

import type { DataSource } from './DataSource';

export const DataSourceContext = createContext<DataSource | null>(null);

export function useDataSource(): DataSource {
  const dataSource = useContext(DataSourceContext);
  if (!dataSource) throw new Error('useDataSource must be used inside a DataSourceProvider');
  return dataSource;
}
