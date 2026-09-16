import { Chip } from '@mui/material';
export function focusOwnerLabel(owner: string | undefined, staff = false) {
  if (owner === 'SYSTEM') return 'Automated check';
  if (owner === 'CONSULTANT') return staff ? 'Consultant' : 'Your consultant';
  if (owner === 'CLIENT') return staff ? 'Client' : 'You';
  return 'Being confirmed';
}
export function FocusOwner({
  owner,
  staff = false,
}: {
  owner: string | undefined;
  staff?: boolean;
}) {
  return (
    <Chip
      label={'Next step · ' + focusOwnerLabel(owner, staff)}
      size="small"
      sx={{
        alignSelf: 'flex-start',
        color: '#ddf2e7',
        bgcolor: '#ffffff12',
        border: '1px solid #ffffff30',
      }}
    />
  );
}
