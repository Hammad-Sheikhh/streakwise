import { useState } from 'react';
import { Outlet } from 'react-router';

import { DataSourceProvider } from '@/data/DataSourceContext';
import { DemoDataSource } from '@/data/DemoDataSource';

// DEMO-1/4: everything under /demo runs on in-browser data, created fresh on every page load.
export function DemoLayout() {
  const [dataSource] = useState(() => new DemoDataSource());

  return (
    <DataSourceProvider dataSource={dataSource}>
      <div
        role="note"
        className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100 print:hidden"
      >
        Demo — sample data. Changes aren’t saved.
      </div>
      <Outlet />
    </DataSourceProvider>
  );
}
