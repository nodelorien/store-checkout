import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

interface ChartFrameProps {
  title: string;
  /** One sentence saying what the chart shows, for the heading and for assistive technology. */
  description?: string;
  /** The same data as text: every chart can be read as a table. */
  table: ChartTable;
  legend?: ReactNode;
  children: ReactNode;
}

/** A titled card for one chart, with a switch to read its data as a table. */
export function ChartFrame({ title, description, table, legend, children }: ChartFrameProps) {
  const [asTable, setAsTable] = useState(false);

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label={title}
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, minWidth: 0 }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3">{title}</Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
          <Button
            size="small"
            aria-pressed={asTable}
            onClick={() => setAsTable((shown) => !shown)}
            sx={{ flexShrink: 0, minHeight: 36 }}
          >
            {asTable ? 'Show chart' : 'Show table'}
          </Button>
        </Stack>

        {asTable ? (
          <Box sx={{ overflowX: 'auto' }}>
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                fontVariantNumeric: 'tabular-nums',
                '& th, & td': {
                  py: 0.75,
                  px: 1,
                  textAlign: 'right',
                  borderBottom: 1,
                  borderColor: 'divider',
                },
                '& th:first-of-type, & td:first-of-type': { textAlign: 'left', pl: 0 },
                '& th': { color: 'text.secondary', fontWeight: 500, fontSize: '0.875rem' },
              }}
            >
              <thead>
                <tr>
                  {table.columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={String(row[0])}>
                    {row.map((cell, index) =>
                      index === 0 ? (
                        <th key={index} scope="row">
                          {cell}
                        </th>
                      ) : (
                        <td key={index}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        ) : (
          <>
            {legend}
            {children}
          </>
        )}
      </Stack>
    </Paper>
  );
}
