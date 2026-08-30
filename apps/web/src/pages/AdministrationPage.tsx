import { Alert, Box, Button, InputAdornment, Stack, Switch, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type ServiceDefinition = {
  serviceType: 'CREDIT_PROFILE_REVIEW' | 'CREDIT_CARD_ROUND' | 'MAJOR_APPLICATION_READINESS';
  price: number;
  currency: string;
  active: boolean;
};

export function AdministrationPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-service-definitions'],
    queryFn: () => apiRequest<{ services: ServiceDefinition[] }>('/api/services/admin/definitions'),
  });
  const review = query.data?.services.find((service) => service.serviceType === 'CREDIT_PROFILE_REVIEW');
  const [price, setPrice] = useState(149);
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (!review) return;
    setPrice(review.price);
    setActive(review.active);
  }, [review]);
  const save = useMutation({
    mutationFn: () => apiRequest('/api/services/admin/definitions/CREDIT_PROFILE_REVIEW', {
      method: 'PATCH',
      body: JSON.stringify({ price, active }),
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-service-definitions'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
      ]);
    },
  });
  return (
    <Stack spacing={3}>
      <PageHeader eyebrow="Administration" title="Service settings" description="Manage client-visible service pricing and availability." />
      <SectionCard variant="elevated">
        <Stack spacing={2.25}>
          <Box>
            <Typography variant="overline" color="primary">MVP service</Typography>
            <Typography variant="h3">Credit Profile Review</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>One-time Review only. Packages and subscriptions are not offered in the MVP.</Typography>
          </Box>
          {query.isLoading ? <LoadingSkeleton /> : query.isError ? <Alert severity="error">Only administrators can manage service pricing.</Alert> : (
            <>
              <TextField
                label="One-time price"
                type="number"
                value={price}
                onChange={(event) => setPrice(Number(event.target.value))}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> }, htmlInput: { min: 0, step: 1 } }}
              />
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 850 }}>Available for purchase</Typography>
                  <Typography variant="body2" color="text.secondary">Controls whether clients can proceed to checkout.</Typography>
                </Box>
                <Switch checked={active} onChange={(event) => setActive(event.target.checked)} />
              </Stack>
              <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || price < 0}>
                {save.isPending ? 'Saving…' : 'Save service settings'}
              </Button>
              {save.isSuccess && <Alert severity="success">Credit Profile Review pricing updated.</Alert>}
              {save.isError && <Alert severity="error">{save.error.message}</Alert>}
            </>
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
