import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { DEMO_PROFILE, initialsOf } from '../profile';
import { selectOrders } from '../selectors';

const LINKS = [
  { to: '/', label: 'Store', icon: <StorefrontOutlinedIcon fontSize="small" /> },
  { to: '/orders', label: 'My orders', icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
  { to: '/insights', label: 'Insights', icon: <InsightsOutlinedIcon fontSize="small" /> },
] as const;

/** The signed-in customer in the header: avatar, greeting and the account's destinations. */
export function AccountMenu() {
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const orders = useAppSelector(selectOrders).length;
  const firstName = DEMO_PROFILE.name.split(' ')[0];

  return (
    <>
      <ButtonBase
        aria-label={`Account: ${DEMO_PROFILE.name}`}
        aria-haspopup="menu"
        aria-controls={anchor ? menuId : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ gap: 1, p: 0.5, pr: { sm: 1.25 }, minHeight: 44, borderRadius: 999, flexShrink: 0 }}
      >
        <Badge
          color="secondary"
          badgeContent={orders}
          overlap="circular"
          slotProps={{ badge: { 'aria-hidden': true } }}
        >
          <Avatar
            sx={(theme) => ({
              width: 36,
              height: 36,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'common.white',
              backgroundImage: theme.brand.action,
            })}
          >
            {initialsOf(DEMO_PROFILE.name)}
          </Avatar>
        </Badge>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left', lineHeight: 1.15 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            component="span"
            sx={{ display: 'block' }}
          >
            Hello,
          </Typography>
          <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
            {firstName}
          </Typography>
        </Box>
      </ButtonBase>

      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 240 } } }}
      >
        <Box sx={{ px: 2, pt: 1, pb: 1.5 }}>
          <Typography sx={{ fontWeight: 600 }}>{DEMO_PROFILE.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {DEMO_PROFILE.email}
          </Typography>
        </Box>
        <Divider />
        {LINKS.map((link) => (
          <MenuItem
            key={link.to}
            component={RouterLink}
            to={link.to}
            onClick={() => setAnchor(null)}
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon>{link.icon}</ListItemIcon>
            {link.label}
          </MenuItem>
        ))}
        <Divider />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', px: 2, py: 1 }}
        >
          Demo session · this store has no sign-in
        </Typography>
      </Menu>
    </>
  );
}
