import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId, type PropsWithChildren, type ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  icon?: ReactNode;
}

/** A titled group of fields, exposed to assistive technology as a named group. */
export function FormSection({ title, icon, children }: PropsWithChildren<FormSectionProps>) {
  const titleId = useId();

  return (
    <Box component="section" role="group" aria-labelledby={titleId}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', mb: 2, color: 'primary.main' }}
      >
        {icon}
        <Typography id={titleId} variant="subtitle2" component="h3">
          {title}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}
