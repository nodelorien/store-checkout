import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { CATALOGUE_SORTS, type CatalogueSort } from '@/shared/api/types';
import { MAX_SEARCH_LENGTH, SORT_LABELS, resultsLabel } from '../catalogue';

const SEARCH_DELAY_MS = 300;

interface CatalogueToolbarProps {
  search: string;
  sort: CatalogueSort;
  /** Matches for the current search; `null` while unknown. */
  total: number | null;
  onSearch: (search: string) => void;
  onSort: (sort: CatalogueSort) => void;
}

/** Search, order and result count of the catalogue. */
export function CatalogueToolbar({ search, sort, total, onSearch, onSort }: CatalogueToolbarProps) {
  const [draft, setDraft] = useState(search);
  const [applied, setApplied] = useState(search);

  // The address bar changed under us (back button, "Clear search"): follow it.
  if (applied !== search) {
    setApplied(search);
    setDraft(search);
  }

  useEffect(() => {
    const next = draft.trim();
    if (next === search) return undefined;
    // Wait for a pause in typing before asking the API.
    const timer = setTimeout(() => onSearch(next), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, search, onSearch]);

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          type="search"
          size="small"
          label="Search products"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          slotProps={{
            htmlInput: { maxLength: MAX_SEARCH_LENGTH, enterKeyHint: 'search' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" aria-hidden />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <TextField
          select
          size="small"
          label="Sort by"
          value={sort}
          onChange={(event) => onSort(event.target.value as CatalogueSort)}
          // The theme makes text fields full width; beside the search this one has a fixed width.
          fullWidth={false}
          sx={{ width: { xs: '100%', sm: 240 }, flexShrink: 0 }}
        >
          {CATALOGUE_SORTS.map((option) => (
            <MenuItem key={option} value={option}>
              {SORT_LABELS[option]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {/* Announced once the count is known; the loading message has the floor until then. */}
      <Typography
        variant="body2"
        color="text.secondary"
        role={total === null ? undefined : 'status'}
        sx={{ minHeight: '1.5em' }}
      >
        {total === null ? '' : resultsLabel(total, search)}
      </Typography>
    </Stack>
  );
}
